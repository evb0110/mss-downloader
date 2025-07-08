#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');

async function fetchDirect(url, options = {}) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                'Cache-Control': 'no-cache',
                ...options.headers
            },
            timeout: 30000
        }, (res) => {
            if (res.statusCode >= 400) {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                return;
            }
            resolve(res);
        });
        
        request.on('error', reject);
        request.on('timeout', () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

async function downloadImageBuffer(url) {
    const response = await fetchDirect(url);
    const chunks = [];
    
    for await (const chunk of response) {
        chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
}

async function createFreiburgValidationPdf() {
    console.log('=== Creating Freiburg Maximum Resolution Validation PDF ===');
    
    const outputDir = '.devkit/validation-current/freiburg-max-resolution-validation';
    await fs.promises.mkdir(outputDir, { recursive: true });
    
    const testPages = [
        'https://dl.ub.uni-freiburg.de/diglitData/image/hs360a/4/00000Vorderdeckel.jpg',
        'https://dl.ub.uni-freiburg.de/diglitData/image/hs360a/4/00000Vorderspiegel.jpg',
        'https://dl.ub.uni-freiburg.de/diglitData/image/hs360a/4/0000a.jpg',
        'https://dl.ub.uni-freiburg.de/diglitData/image/hs360a/4/007v.jpg',
        'https://dl.ub.uni-freiburg.de/diglitData/image/hs360a/4/008r.jpg'
    ];
    
    const pdfDoc = await PDFDocument.create();
    
    for (let i = 0; i < testPages.length; i++) {
        const imageUrl = testPages[i];
        const pageName = path.basename(imageUrl, '.jpg');
        
        try {
            console.log(`Downloading page ${i + 1}/${testPages.length}: ${pageName}`);
            
            const imageBuffer = await downloadImageBuffer(imageUrl);
            console.log(`Downloaded ${imageBuffer.length} bytes`);
            
            const image = await pdfDoc.embedJpg(imageBuffer);
            const page = pdfDoc.addPage([image.width, image.height]);
            
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });
            
            console.log(`Added page ${pageName} (${image.width}x${image.height})`);
            
        } catch (error) {
            console.error(`Error processing page ${pageName}:`, error.message);
        }
    }
    
    const pdfBytes = await pdfDoc.save();
    const pdfPath = path.join(outputDir, 'FREIBURG-MAX-RESOLUTION-VALIDATION.pdf');
    
    await fs.promises.writeFile(pdfPath, pdfBytes);
    
    console.log(`\n=== PDF Created Successfully ===`);
    console.log(`File: ${pdfPath}`);
    console.log(`Size: ${Math.round(pdfBytes.length / 1024)} KB`);
    console.log(`Pages: ${testPages.length}`);
    console.log(`Average per page: ${Math.round(pdfBytes.length / testPages.length / 1024)} KB`);
    
    return pdfPath;
}

createFreiburgValidationPdf().then(pdfPath => {
    console.log('\n=== Validation PDF Ready ===');
    console.log(`Please inspect: ${pdfPath}`);
}).catch(error => {
    console.error('Error creating validation PDF:', error);
});