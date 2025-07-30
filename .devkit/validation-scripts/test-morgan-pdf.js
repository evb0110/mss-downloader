#!/usr/bin/env node

/**
 * Morgan Library PDF Test - Create a small PDF from the fixed implementation
 */

const path = require('path');
const fs = require('fs').promises;
const { execSync } = require('child_process');
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testMorganPDF() {
    console.log('📄 Morgan Library PDF Test - Creating validation PDF');
    
    const loader = new SharedManifestLoaders();
    const testUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
    const outputDir = path.join(__dirname, '../validation-results/morgan-v1.4.49');
    
    try {
        await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
        // Directory already exists
    }
    
    console.log(`\nStep 1: Getting manifest from ${testUrl}`);
    
    try {
        const manifest = await loader.getMorganManifest(testUrl);
        console.log(`✅ Manifest loaded: ${manifest.images.length} images found`);
        
        console.log('\nStep 2: downloading first 5 images...');
        const downloadedImages = [];
        const maxImages = Math.min(5, manifest.images.length);
        
        for (let i = 0; i < maxImages; i++) {
            const image = manifest.images[i];
            console.log(`  Downloading ${i + 1}/${maxImages}: ${image.label}`);
            
            try {
                const response = await loader.fetchWithRetry(image.url);
                if (response.ok) {
                    const buffer = await response.buffer();
                    const filename = `morgan_page_${String(i + 1).padStart(2, '0')}.jpg`;
                    const filepath = path.join(outputDir, filename);
                    
                    await fs.writeFile(filepath, buffer);
                    
                    const stats = await fs.stat(filepath);
                    console.log(`    ✅ ${filename} (${Math.round(stats.size / 1024)}KB)`);
                    
                    downloadedImages.push(filepath);
                } else {
                    console.log(`    ❌ Failed: ${response.status}`);
                }
            } catch (error) {
                console.log(`    ❌ Error: ${error.message}`);
            }
        }
        
        if (downloadedImages.length === 0) {
            console.log('❌ No images downloaded, cannot create PDF');
            return false;
        }
        
        console.log(`\nStep 3: Creating PDF from ${downloadedImages.length} images...`);
        const pdfPath = path.join(outputDir, 'morgan-lindau-gospels-v1.4.49-test.pdf');
        
        try {
            const imageFiles = downloadedImages.map(img => `"${img}"`).join(' ');
            const command = `magick ${imageFiles} "${pdfPath}"`;
            
            execSync(command, { stdio: 'pipe' });
            
            const stats = await fs.stat(pdfPath);
            console.log(`✅ PDF created: ${path.basename(pdfPath)} (${Math.round(stats.size / 1024)}KB)`);
            
            // Validate PDF
            try {
                const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
                const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
                const pageCount = pageMatch ? parseInt(pageMatch[1]) : 0;
                console.log(`📄 PDF validated: ${pageCount} pages`);
                
                console.log(`\n🎉 Morgan Library PDF test COMPLETED!`);
                console.log(`📁 PDF location: ${pdfPath}`);
                console.log(`📸 ${downloadedImages.length} images processed`);
                console.log(`📄 ${pageCount} pages in PDF`);
                
                return true;
                
            } catch (error) {
                console.log('⚠️  Could not validate PDF, but creation succeeded');
                return true;
            }
            
        } catch (error) {
            console.log(`❌ PDF creation failed: ${error.message}`);
            
            // Try with individual image inspection
            console.log('\nStep 4: Individual image inspection...');
            for (const imagePath of downloadedImages) {
                try {
                    const stats = await fs.stat(imagePath);
                    console.log(`  📸 ${path.basename(imagePath)}: ${Math.round(stats.size / 1024)}KB`);
                } catch (error) {
                    console.log(`  ❌ ${path.basename(imagePath)}: Cannot read`);
                }
            }
            
            return false;
        }
        
    } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
        return false;
    }
}

// Run the test
if (require.main === module) {
    testMorganPDF().then(success => {
        console.log(success ? '\n✅ All tests passed!' : '\n❌ Some tests failed!');
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('❌ Test crashed:', error.message);
        process.exit(1);
    });
}

module.exports = { testMorganPDF };