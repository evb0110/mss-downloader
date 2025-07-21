const https = require('https');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

// Create output directory
const outputDir = path.join(__dirname, 'graz-validation-pdfs');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function downloadImage(url, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await new Promise((resolve, reject) => {
                const urlObj = new URL(url);
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
                    timeout: 60000,
                    rejectUnauthorized: false
                };
                
                const req = https.request(options, (res) => {
                    const chunks = [];
                    res.on('data', chunk => chunks.push(chunk));
                    res.on('end', () => {
                        resolve(Buffer.concat(chunks));
                    });
                });
                
                req.on('error', reject);
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
                
                req.end();
            });
        } catch (error) {
            if (attempt === retries - 1) throw error;
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

async function createGrazPDF(manifestUrl, outputPath, maxPages = 10) {
    console.log(`\nFetching manifest: ${manifestUrl}`);
    
    // Fetch manifest
    const manifestData = await new Promise((resolve, reject) => {
        https.get(manifestUrl, { 
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            },
            rejectUnauthorized: false
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
    
    const canvases = manifestData.sequences?.[0]?.canvases || [];
    const title = manifestData.label || 'Untitled';
    console.log(`Title: ${title}`);
    console.log(`Total pages: ${canvases.length}`);
    
    // Download pages
    const pagesToDownload = Math.min(maxPages, canvases.length);
    console.log(`Downloading ${pagesToDownload} pages...`);
    
    const pdfDoc = await PDFDocument.create();
    let successCount = 0;
    
    for (let i = 0; i < pagesToDownload; i++) {
        const canvas = canvases[i];
        const imageResource = canvas.images?.[0]?.resource;
        if (!imageResource) continue;
        
        // Get highest resolution URL
        let imageUrl = imageResource['@id'];
        if (imageUrl.includes('/webcache/')) {
            const pageId = imageUrl.match(/\/(\d+)$/)?.[1];
            if (pageId) {
                imageUrl = `https://unipub.uni-graz.at/download/webcache/2000/${pageId}`;
            }
        }
        
        try {
            console.log(`  Page ${i + 1}/${pagesToDownload}: Downloading...`);
            const imageData = await downloadImage(imageUrl);
            console.log(`  Page ${i + 1}/${pagesToDownload}: ${imageData.length} bytes`);
            
            // Embed in PDF
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
            console.log(`  Page ${i + 1}: Failed - ${error.message}`);
        }
    }
    
    if (successCount === 0) {
        throw new Error('No pages could be downloaded');
    }
    
    // Save PDF
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    
    console.log(`✓ PDF created: ${outputPath}`);
    console.log(`  Size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Pages: ${successCount}/${pagesToDownload}`);
    
    return { success: true, pages: successCount, size: pdfBytes.length };
}

async function validateGrazPDFs() {
    console.log('=== University of Graz PDF Validation ===');
    console.log(`Output directory: ${outputDir}\n`);
    
    const manuscripts = [
        { id: '8224538', url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538' },
        { id: '5892688', url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688' }
    ];
    
    for (const manuscript of manuscripts) {
        console.log('\n' + '='.repeat(60));
        console.log(`URL: ${manuscript.url}`);
        
        try {
            const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${manuscript.id}/manifest`;
            const outputPath = path.join(outputDir, `graz_${manuscript.id}.pdf`);
            
            await createGrazPDF(manifestUrl, outputPath, 10);
        } catch (error) {
            console.log(`✗ FAILED: ${error.message}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`\nValidation complete! Check PDFs in: ${outputDir}`);
}

validateGrazPDFs().catch(console.error);