const https = require('https');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const outputDir = path.join(__dirname, 'graz-enhanced-validation');

async function downloadWithEnhancedRetry(url, maxRetries = 5) {
    let retryCount = 0;
    
    const attemptDownload = async () => {
        return new Promise((resolve, reject) => {
            const attemptStart = Date.now();
            console.log(`  [Attempt ${retryCount + 1}/${maxRetries}] Downloading...`);
            
            const urlObj = new URL(url);
            const agent = new https.Agent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                maxSockets: 10,
                maxFreeSockets: 5,
                timeout: 120000,
                rejectUnauthorized: false
            });
            
            const options = {
                hostname: urlObj.hostname,
                port: 443,
                path: urlObj.pathname,
                method: 'GET',
                headers: {
                    'Referer': 'https://unipub.uni-graz.at/',
                    'Accept': 'image/jpeg,image/png,image/*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 120000,
                agent: agent
            };
            
            const req = https.request(options, (res) => {
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    const elapsed = Date.now() - attemptStart;
                    const buffer = Buffer.concat(chunks);
                    console.log(`  [Attempt ${retryCount + 1}] Success in ${elapsed}ms, ${buffer.length} bytes`);
                    resolve(buffer);
                });
            });
            
            req.on('error', (error) => {
                const elapsed = Date.now() - attemptStart;
                console.log(`  [Attempt ${retryCount + 1}] Failed after ${elapsed}ms: ${error.code}`);
                
                if (retryCount < maxRetries - 1 && 
                    ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 
                     'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE', 'ECONNABORTED'].includes(error.code)) {
                    retryCount++;
                    const backoff = Math.min(1000 * Math.pow(2, retryCount), 30000);
                    console.log(`  Retrying in ${backoff/1000}s...`);
                    setTimeout(() => {
                        attemptDownload().then(resolve).catch(reject);
                    }, backoff);
                } else {
                    reject(error);
                }
            });
            
            req.on('timeout', () => {
                req.destroy();
                const error = new Error('Socket timeout');
                error.code = 'ETIMEDOUT';
                req.emit('error', error);
            });
            
            req.end();
        });
    };
    
    return attemptDownload();
}

async function createEnhancedGrazPDF(manifestUrl, outputPath) {
    console.log(`\nFetching manifest with enhanced retry logic...`);
    
    // Fetch manifest
    const manifestData = await downloadWithEnhancedRetry(manifestUrl).then(buffer => 
        JSON.parse(buffer.toString())
    );
    
    const canvases = manifestData.sequences?.[0]?.canvases || [];
    const title = manifestData.label || 'Untitled';
    console.log(`Title: ${title}`);
    console.log(`Total pages: ${canvases.length}`);
    
    // Download 10 pages
    console.log(`\nDownloading 10 pages with enhanced retry logic...`);
    
    const pdfDoc = await PDFDocument.create();
    let successCount = 0;
    
    for (let i = 0; i < Math.min(10, canvases.length); i++) {
        const canvas = canvases[i];
        const imageResource = canvas.images?.[0]?.resource;
        if (!imageResource) continue;
        
        let imageUrl = imageResource['@id'];
        if (imageUrl.includes('/webcache/')) {
            const pageId = imageUrl.match(/\/(\d+)$/)?.[1];
            if (pageId) {
                imageUrl = `https://unipub.uni-graz.at/download/webcache/2000/${pageId}`;
            }
        }
        
        try {
            console.log(`\nPage ${i + 1}/10:`);
            const imageData = await downloadWithEnhancedRetry(imageUrl);
            
            let image;
            try {
                image = await pdfDoc.embedJpg(imageData);
            } catch (e) {
                image = await pdfDoc.embedPng(imageData);
            }
            
            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height
            });
            
            successCount++;
        } catch (error) {
            console.log(`  Final failure: ${error.message}`);
        }
    }
    
    if (successCount === 0) {
        throw new Error('No pages could be downloaded');
    }
    
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    
    console.log(`\n✓ PDF created: ${outputPath}`);
    console.log(`  Size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Pages: ${successCount}/10`);
    
    return { success: true, pages: successCount, size: pdfBytes.length };
}

async function validateEnhancedGraz() {
    console.log('=== University of Graz Enhanced Validation ===');
    console.log('Testing with enhanced retry logic:');
    console.log('- 5 retry attempts');
    console.log('- Exponential backoff: 2s, 4s, 8s, 16s, 30s');
    console.log('- 120 second socket timeout');
    console.log('- Connection pooling enabled\n');
    
    const manuscripts = [
        { id: '8224538', name: 'Ms 0771' },
        { id: '5892688', name: 'Ms 0775' }
    ];
    
    for (const ms of manuscripts) {
        console.log('\n' + '='.repeat(60));
        console.log(`Manuscript: ${ms.name} (ID: ${ms.id})`);
        
        try {
            const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${ms.id}/manifest`;
            const outputPath = path.join(outputDir, `graz_${ms.id}_enhanced.pdf`);
            
            await createEnhancedGrazPDF(manifestUrl, outputPath);
        } catch (error) {
            console.log(`\n✗ Failed: ${error.message}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`\nValidation complete! PDFs saved to: ${outputDir}`);
}

validateEnhancedGraz().catch(console.error);