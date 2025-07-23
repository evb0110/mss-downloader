const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
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
    
    const loaders = new SharedManifestLoaders.SharedManifestLoaders();
    
    for (const url of testUrls) {
        console.log(`\nTesting: ${url}`);
        
        try {
            const manifest = await loaders.getManifestForLibrary('vatican', url);
            console.log(`Title: ${manifest.label || 'Unknown'}`);
            console.log(`Pages: ${manifest.images.length}`);
            
            // Test downloading first 10 pages (or all if fewer)
            const pagesToTest = Math.min(10, manifest.images.length);
            const pdfDoc = await PDFDocument.create();
            
            for (let i = 0; i < pagesToTest; i++) {
                const image = manifest.images[i];
                console.log(`  Page ${i + 1}: ${image.url}`);
                
                const imagePath = path.join(outputDir, `temp_${i}.jpg`);
                await downloadImage(image.url, imagePath);
                
                // Get file size
                const stats = fs.statSync(imagePath);
                console.log(`    Downloaded: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                
                // Embed directly as JPEG in PDF
                const jpegImageBytes = fs.readFileSync(imagePath);
                const jpegImage = await pdfDoc.embedJpg(jpegImageBytes);
                const page = pdfDoc.addPage([jpegImage.width, jpegImage.height]);
                page.drawImage(jpegImage, {
                    x: 0,
                    y: 0,
                    width: jpegImage.width,
                    height: jpegImage.height
                });
                
                // Clean up temp file
                fs.unlinkSync(imagePath);
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
                
                // Extract images to verify content
                const imagesDir = path.join(outputDir, 'extracted_images');
                if (!fs.existsSync(imagesDir)) {
                    fs.mkdirSync(imagesDir, { recursive: true });
                }
                
                // Extract first page to verify
                execSync(`pdfimages -j -f 1 -l 1 "${pdfPath}" "${imagesDir}/${pdfName}_page"`, { encoding: 'utf8' });
                console.log('✓ Image extraction successful');
                
                // Check extracted image dimensions
                const extractedFiles = fs.readdirSync(imagesDir).filter(f => f.startsWith(pdfName));
                if (extractedFiles.length > 0) {
                    const firstExtracted = path.join(imagesDir, extractedFiles[0]);
                    const fileInfo = execSync(`file "${firstExtracted}"`, { encoding: 'utf8' });
                    console.log(`✓ First page info: ${fileInfo.trim()}`);
                }
                
                // Clean up extracted images
                extractedFiles.forEach(f => fs.unlinkSync(path.join(imagesDir, f)));
                
            } catch (error) {
                console.log('✗ PDF validation failed:', error.message);
            }
            
        } catch (error) {
            console.error(`✗ Failed: ${error.message}`);
        }
    }
    
    console.log('\n\nTest complete. PDFs saved in:', outputDir);
}

// Run test
testVaticanLibrary().catch(console.error);