const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const https = require('https');

// Import SharedManifestLoaders
const SharedManifestLoaders = require('../src/shared/SharedManifestLoaders.js');

// Utility function to download image
async function downloadImage(url, outputPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(outputPath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', reject);
    });
}

// Test Vatican Library implementation
async function testVaticanLibrary() {
    console.log('Testing Vatican Library manuscript download...\n');
    
    const testUrls = [
        'https://digi.vatlib.it/view/MSS_Vat.lat.1',
        'https://digi.vatlib.it/view/MSS_Vat.lat.2',
        'https://digi.vatlib.it/view/MSS_Vat.gr.1'
    ];
    
    const outputDir = '.devkit/validation-results/vatican';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const loaders = new SharedManifestLoaders();
    
    for (const url of testUrls) {
        console.log(`\nTesting: ${url}`);
        
        try {
            const manifest = await loaders.getManifestForLibrary('vatican', url);
            console.log(`Title: ${manifest.label || 'Unknown'}`);
            console.log(`Pages: ${manifest.sequences[0].canvases.length}`);
            
            // Test downloading first 10 pages (or all if fewer)
            const pagesToTest = Math.min(10, manifest.sequences[0].canvases.length);
            const pdfDoc = await PDFDocument.create();
            
            for (let i = 0; i < pagesToTest; i++) {
                const canvas = manifest.sequences[0].canvases[i];
                const imageUrl = canvas.images[0].resource['@id'];
                
                console.log(`  Page ${i + 1}: ${imageUrl}`);
                
                const imagePath = path.join(outputDir, `temp_${i}.jpg`);
                await downloadImage(imageUrl, imagePath);
                
                // Convert to PNG if needed and embed in PDF
                const pngPath = path.join(outputDir, `temp_${i}.png`);
                await sharp(imagePath).png().toFile(pngPath);
                
                const pngImage = await pdfDoc.embedPng(fs.readFileSync(pngPath));
                const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
                page.drawImage(pngImage, {
                    x: 0,
                    y: 0,
                    width: pngImage.width,
                    height: pngImage.height
                });
                
                // Clean up temp files
                fs.unlinkSync(imagePath);
                fs.unlinkSync(pngPath);
            }
            
            // Save PDF
            const pdfName = url.split('/').pop() + '.pdf';
            const pdfPath = path.join(outputDir, pdfName);
            const pdfBytes = await pdfDoc.save();
            fs.writeFileSync(pdfPath, pdfBytes);
            
            console.log(`✓ Created ${pdfName} with ${pagesToTest} pages`);
            
            // Verify with poppler
            const { execSync } = require('child_process');
            try {
                const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
                console.log('✓ PDF validation passed');
            } catch (error) {
                console.log('✗ PDF validation failed');
            }
            
        } catch (error) {
            console.error(`✗ Failed: ${error.message}`);
        }
    }
    
    console.log('\n\nTest complete. PDFs saved in:', outputDir);
}

// Run test
testVaticanLibrary().catch(console.error);