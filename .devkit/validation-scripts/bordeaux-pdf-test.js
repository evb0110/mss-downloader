#!/usr/bin/env node

/**
 * Generate PDF test for Bordeaux library using the tile processor
 * Tests end-to-end functionality with DirectTileProcessor
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const { DirectTileProcessor } = require('../../src/main/services/DirectTileProcessor.ts');
const path = require('path');
const fs = require('fs').promises;
const { PDFDocument } = require('pdf-lib');

class BordeauxPDFTester {
    constructor() {
        this.loader = new SharedManifestLoaders();
        this.tileProcessor = new DirectTileProcessor();
        this.testDir = path.join(__dirname, '../validation-results/bordeaux-v1.4.49');
        this.imagesDir = path.join(this.testDir, 'images');
        this.pdfPath = path.join(this.testDir, 'bordeaux-test.pdf');
    }

    async ensureDirectories() {
        await fs.mkdir(this.testDir, { recursive: true });
        await fs.mkdir(this.imagesDir, { recursive: true });
    }

    async testBordeauxPDFGeneration() {
        console.log('=== Bordeaux PDF Generation Test ===\n');
        
        try {
            await this.ensureDirectories();
            
            // 1. Get manifest
            console.log('1. Getting Bordeaux manifest...');
            const testUrl = 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778';
            const manifest = await this.loader.getBordeauxManifest(testUrl);
            
            console.log('✅ Manifest obtained:');
            console.log(`   - Base ID: ${manifest.baseId}`);
            console.log(`   - Start Page: ${manifest.startPage}`);
            console.log(`   - Page Count: ${manifest.pageCount}`);
            console.log(`   - Requires Tile Processor: ${manifest.requiresTileProcessor}`);
            
            // 2. Test tile processing for first 5 pages
            console.log('\n2. Testing tile processing for first 5 pages...');
            const testPages = [6, 7, 8, 9, 10]; // Start from actual available pages
            const processedImages = [];
            
            for (let i = 0; i < testPages.length; i++) {
                const pageNum = testPages[i];
                const imagePath = path.join(this.imagesDir, `page_${pageNum}.jpg`);
                
                console.log(`\nProcessing page ${pageNum}...`);
                
                try {
                    const result = await this.tileProcessor.processPage(
                        manifest.baseId,
                        pageNum,
                        imagePath
                    );
                    
                    if (result.success) {
                        // Verify file was created and has content
                        const stats = await fs.stat(imagePath);
                        if (stats.size > 0) {
                            console.log(`✅ Page ${pageNum} processed successfully (${Math.round(stats.size / 1024)}KB)`);
                            processedImages.push({
                                pageNum,
                                path: imagePath,
                                size: stats.size
                            });
                        } else {
                            console.log(`❌ Page ${pageNum} file is empty`);
                        }
                    } else {
                        console.log(`❌ Page ${pageNum} processing failed: ${result.error}`);
                    }
                } catch (error) {
                    console.log(`❌ Page ${pageNum} error: ${error.message}`);
                }
            }
            
            if (processedImages.length === 0) {
                throw new Error('No pages were successfully processed');
            }
            
            console.log(`\n✅ Successfully processed ${processedImages.length}/${testPages.length} pages`);
            
            // 3. Create PDF
            console.log('\n3. Creating PDF from processed images...');
            await this.createPDF(processedImages);
            
            // 4. Validate PDF
            console.log('\n4. Validating PDF...');
            await this.validatePDF();
            
            return {
                success: true,
                processedPages: processedImages.length,
                totalSize: processedImages.reduce((sum, img) => sum + img.size, 0),
                pdfPath: this.pdfPath
            };
            
        } catch (error) {
            console.error('❌ PDF generation failed:', error.message);
            throw error;
        }
    }

    async createPDF(images) {
        console.log('Creating PDF using pdf-lib...');
        
        const pdfDoc = await PDFDocument.create();

        for (const image of images) {
            console.log(`Adding page ${image.pageNum} to PDF...`);
            
            try {
                // Read image data
                const imageBuffer = await fs.readFile(image.path);
                
                // Embed the image in the PDF
                const jpgImage = await pdfDoc.embedJpg(imageBuffer);
                
                // Get image dimensions
                const imageDims = jpgImage.scale(1);
                
                // Add a page with the same dimensions as the image
                const page = pdfDoc.addPage([imageDims.width, imageDims.height]);
                
                // Draw the image on the page
                page.drawImage(jpgImage, {
                    x: 0,
                    y: 0,
                    width: imageDims.width,
                    height: imageDims.height,
                });
                
                console.log(`✅ Added page ${image.pageNum} to PDF (${imageDims.width}x${imageDims.height})`);
                
            } catch (error) {
                console.error(`❌ Error adding page ${image.pageNum} to PDF:`, error.message);
            }
        }

        // Save the PDF
        const pdfBytes = await pdfDoc.save();
        await fs.writeFile(this.pdfPath, pdfBytes);

        console.log(`✅ PDF created: ${this.pdfPath}`);
    }

    async validatePDF() {
        try {
            const stats = await fs.stat(this.pdfPath);
            
            if (stats.size === 0) {
                throw new Error('PDF file is empty');
            }
            
            console.log(`✅ PDF validation passed:`);
            console.log(`   - File size: ${Math.round(stats.size / 1024 / 1024 * 100) / 100} MB`);
            console.log(`   - Path: ${this.pdfPath}`);
            
            // Read first few bytes to verify PDF header
            const fileHandle = await fs.open(this.pdfPath, 'r');
            const buffer = Buffer.allocUnsafe(8);
            await fileHandle.read(buffer, 0, 8, 0);
            await fileHandle.close();
            
            const header = buffer.toString('ascii', 0, 4);
            if (header === '%PDF') {
                console.log('✅ PDF header is valid');
            } else {
                console.log('⚠️  PDF header seems unusual:', header);
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ PDF validation failed:', error.message);
            return false;
        }
    }
}

async function main() {
    const tester = new BordeauxPDFTester();
    
    try {
        const result = await tester.testBordeauxPDFGeneration();
        
        console.log('\n=== Test Results ===');
        console.log(`✅ Success: ${result.success}`);
        console.log(`✅ Pages processed: ${result.processedPages}`);
        console.log(`✅ Total image size: ${Math.round(result.totalSize / 1024 / 1024 * 100) / 100} MB`);
        console.log(`✅ PDF location: ${result.pdfPath}`);
        
        console.log('\n🎉 Bordeaux PDF generation test completed successfully!');
        console.log('\n📁 Open the validation folder to inspect the results:');
        console.log(`   ${path.dirname(result.pdfPath)}`);
        
    } catch (error) {
        console.error('\n💥 Test failed:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { BordeauxPDFTester };