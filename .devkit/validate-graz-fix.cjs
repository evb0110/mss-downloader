const { PDFDocument } = require('pdf-lib');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');

// Mock electron before importing service
const { app } = require('electron');
if (!app) {
    // Create minimal electron mock
    const ElectronMock = require('../dist/main/preload.js');
}

const testUrls = [
    'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
    'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688'
];

async function downloadImageWithRetry(url, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log(`  Downloading image (attempt ${attempt + 1}/${maxRetries}): ${url}`);
            const startTime = Date.now();
            
            return new Promise((resolve, reject) => {
                const urlObj = new URL(url);
                const options = {
                    hostname: urlObj.hostname,
                    port: 443,
                    path: urlObj.pathname,
                    method: 'GET',
                    headers: {
                        'Referer': 'https://unipub.uni-graz.at/',
                        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Connection': 'keep-alive'
                    },
                    timeout: 60000,
                    rejectUnauthorized: false
                };
                
                const req = https.request(options, (res) => {
                    const chunks = [];
                    res.on('data', chunk => chunks.push(chunk));
                    res.on('end', () => {
                        const elapsed = Date.now() - startTime;
                        const buffer = Buffer.concat(chunks);
                        console.log(`  Downloaded ${buffer.length} bytes in ${elapsed}ms`);
                        resolve(buffer);
                    });
                });
                
                req.on('error', (err) => {
                    console.log(`  Error: ${err.code} - ${err.message}`);
                    reject(err);
                });
                
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });
                
                req.end();
            });
        } catch (error) {
            console.log(`  Attempt ${attempt + 1} failed:`, error.message);
            if (attempt === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        }
    }
}

async function validateGrazFix() {
    console.log('=== University of Graz ETIMEDOUT Fix Validation ===\n');
    
    const outputDir = path.join(__dirname, 'graz-validation-' + new Date().toISOString().split('T')[0]);
    await fs.mkdir(outputDir, { recursive: true });
    
    const service = new EnhancedManuscriptDownloaderService();
    const results = [];
    
    for (const url of testUrls) {
        console.log(`\nTesting: ${url}`);
        console.log('=' . repeat(60));
        
        try {
            // Parse manuscript URL
            console.log('\n1. Parsing manuscript URL...');
            const startTime = Date.now();
            const manuscript = await service.parseManuscriptUrl(url);
            const parseTime = Date.now() - startTime;
            
            console.log(`✓ Parsed successfully in ${parseTime}ms`);
            console.log(`  Title: ${manuscript.title}`);
            console.log(`  Pages: ${manuscript.pages}`);
            console.log(`  Library: ${manuscript.library}`);
            
            // Download sample pages
            console.log('\n2. Downloading sample pages...');
            const pagesToTest = Math.min(10, manuscript.pages);
            const images = [];
            let successCount = 0;
            
            for (let i = 0; i < pagesToTest; i++) {
                const pageUrl = manuscript.pageLinks[i];
                try {
                    const imageData = await downloadImageWithRetry(pageUrl);
                    images.push(imageData);
                    successCount++;
                    console.log(`✓ Page ${i + 1}/${pagesToTest}: ${imageData.length} bytes`);
                } catch (error) {
                    console.log(`✗ Page ${i + 1}/${pagesToTest}: ${error.message}`);
                }
            }
            
            if (images.length === 0) {
                throw new Error('No pages could be downloaded');
            }
            
            // Create PDF
            console.log('\n3. Creating PDF from downloaded pages...');
            const pdfDoc = await PDFDocument.create();
            
            for (const imageData of images) {
                let image;
                try {
                    // Try as JPEG first
                    image = await pdfDoc.embedJpg(imageData);
                } catch (e) {
                    try {
                        // Try as PNG if JPEG fails
                        image = await pdfDoc.embedPng(imageData);
                    } catch (e2) {
                        console.log('  Warning: Could not embed image, skipping');
                        continue;
                    }
                }
                
                const page = pdfDoc.addPage([image.width, image.height]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: image.width,
                    height: image.height,
                });
            }
            
            // Save PDF
            const pdfBytes = await pdfDoc.save();
            const manuscriptId = url.match(/\/(\d+)$/)?.[1] || 'unknown';
            const pdfPath = path.join(outputDir, `graz_${manuscriptId}.pdf`);
            await fs.writeFile(pdfPath, pdfBytes);
            
            console.log(`✓ PDF created: ${pdfPath} (${pdfBytes.length} bytes)`);
            
            results.push({
                url,
                status: 'SUCCESS',
                title: manuscript.title,
                pages: manuscript.pages,
                downloadedPages: successCount,
                pdfSize: pdfBytes.length,
                parseTime
            });
            
        } catch (error) {
            console.log(`\n✗ ERROR: ${error.message}`);
            results.push({
                url,
                status: 'FAILED',
                error: error.message
            });
        }
    }
    
    // Summary
    console.log('\n\n=== VALIDATION SUMMARY ===');
    console.log(`Output directory: ${outputDir}`);
    console.log('\nResults:');
    
    for (const result of results) {
        console.log(`\n${result.url}:`);
        if (result.status === 'SUCCESS') {
            console.log(`  ✓ SUCCESS`);
            console.log(`  - Title: ${result.title}`);
            console.log(`  - Pages: ${result.downloadedPages}/${result.pages} downloaded`);
            console.log(`  - PDF size: ${(result.pdfSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  - Parse time: ${result.parseTime}ms`);
        } else {
            console.log(`  ✗ FAILED: ${result.error}`);
        }
    }
    
    const successCount = results.filter(r => r.status === 'SUCCESS').length;
    console.log(`\n✓ Success rate: ${successCount}/${results.length} (${(successCount/results.length*100).toFixed(0)}%)`);
    
    if (successCount === results.length) {
        console.log('\n🎉 All Graz manuscripts validated successfully!');
    } else {
        console.log('\n⚠️  Some manuscripts failed validation.');
    }
}

validateGrazFix().catch(console.error);