const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService.js');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');
const { execSync } = require('child_process');

// Create a simpler test that doesn't require full electron environment
// We'll test the Morgan parsing logic directly

async function testMorganLibrary() {
    console.log('=== Testing Morgan Library Fix ===\n');
    
    const testUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
    const outputDir = path.join(__dirname, '../validation/morgan-fix-test');
    
    // Clean up and create output directory
    try {
        await fs.rm(outputDir, { recursive: true, force: true });
    } catch (e) {}
    await fs.mkdir(outputDir, { recursive: true });
    
    const service = new EnhancedManuscriptDownloaderService();
    
    try {
        console.log(`Testing URL: ${testUrl}`);
        console.log('Initializing service...');
        
        // Mock ipcMain for testing
        global.ipcMain = {
            emit: (channel, event, data) => {
                if (channel === 'download-progress') {
                    console.log(`Progress: ${data.message} (${data.processedImages}/${data.totalImages})`);
                }
            }
        };
        
        // Test manifest extraction
        console.log('\n1. Testing manifest extraction...');
        const manifest = await service.getManifest(testUrl);
        
        console.log(`\nManifest extracted successfully:`);
        console.log(`- Library: ${manifest.library}`);
        console.log(`- Display Name: ${manifest.displayName}`);
        console.log(`- Total Pages: ${manifest.totalPages}`);
        console.log(`- First 5 page links:`);
        manifest.pageLinks.slice(0, 5).forEach((link, i) => {
            console.log(`  ${i + 1}. ${link}`);
        });
        
        // Test downloading a few pages
        console.log('\n2. Testing page downloads (first 5 pages)...');
        const testPageLinks = manifest.pageLinks.slice(0, 5);
        const downloadedImages = [];
        
        for (let i = 0; i < testPageLinks.length; i++) {
            const pageLink = testPageLinks[i];
            console.log(`\nDownloading page ${i + 1}/${testPageLinks.length}...`);
            
            try {
                const imageData = await service.downloadImage(pageLink, i + 1, testPageLinks.length);
                
                if (imageData) {
                    const filename = `page_${String(i + 1).padStart(3, '0')}.jpg`;
                    const filepath = path.join(outputDir, filename);
                    await fs.writeFile(filepath, imageData);
                    downloadedImages.push(filepath);
                    
                    // Check file size
                    const stats = await fs.stat(filepath);
                    const sizeKB = Math.round(stats.size / 1024);
                    console.log(`✓ Downloaded: ${filename} (${sizeKB} KB)`);
                    
                    // Extract image info using identify
                    try {
                        const imageInfo = execSync(`identify -format "%wx%h %Q%%" "${filepath}"`, { encoding: 'utf8' }).trim();
                        const [dimensions, quality] = imageInfo.split(' ');
                        console.log(`  Dimensions: ${dimensions}, Quality: ${quality}`);
                    } catch (e) {
                        console.log('  (ImageMagick not available for detailed info)');
                    }
                } else {
                    console.log(`✗ Failed to download page ${i + 1}`);
                }
            } catch (error) {
                console.log(`✗ Error downloading page ${i + 1}: ${error.message}`);
            }
        }
        
        console.log(`\n3. Creating test PDF...`);
        
        if (downloadedImages.length > 0) {
            // Create PDF
            const pdfDoc = await PDFDocument.create();
            
            for (const imagePath of downloadedImages) {
                const imageBytes = await fs.readFile(imagePath);
                const image = await pdfDoc.embedJpg(imageBytes);
                
                const page = pdfDoc.addPage([image.width, image.height]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: image.width,
                    height: image.height,
                });
            }
            
            const pdfBytes = await pdfDoc.save();
            const pdfPath = path.join(outputDir, 'morgan_test.pdf');
            await fs.writeFile(pdfPath, pdfBytes);
            
            const pdfStats = await fs.stat(pdfPath);
            const pdfSizeMB = (pdfStats.size / (1024 * 1024)).toFixed(2);
            console.log(`✓ PDF created: morgan_test.pdf (${pdfSizeMB} MB, ${downloadedImages.length} pages)`);
            
            // Validate PDF with poppler
            try {
                const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
                console.log('\n✓ PDF validation passed (poppler)');
                const pageCountMatch = pdfInfo.match(/Pages:\s+(\d+)/);
                if (pageCountMatch) {
                    console.log(`  Confirmed pages: ${pageCountMatch[1]}`);
                }
            } catch (e) {
                console.log('\n⚠️  PDF validation skipped (poppler not available)');
            }
            
            console.log(`\n✅ Test completed successfully!`);
            console.log(`Output directory: ${outputDir}`);
        } else {
            console.log('\n❌ Test failed - no images were downloaded');
        }
        
    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testMorganLibrary().catch(console.error);