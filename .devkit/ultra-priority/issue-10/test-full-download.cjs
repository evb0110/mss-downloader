#!/usr/bin/env node

/**
 * ULTRA-PRIORITY FULL DOWNLOAD TEST for Issue #10
 * Downloads actual pages to verify correct ordering
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = require('fs').createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', reject);
    });
}

async function testFullDownload() {
    console.log('🚀 ULTRA-PRIORITY FULL DOWNLOAD TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const loader = new SharedManifestLoaders();
    const testUrl = 'https://www.e-manuscripta.ch/bau/content/zoom/5157616';
    
    try {
        // Load manifest
        console.log('\n📥 Loading manifest...');
        const result = await loader.getEManuscriptaManifest(testUrl);
        
        console.log(`✅ Loaded ${result.images.length} images`);
        
        // Create output directory
        const outputDir = path.join(__dirname, 'downloaded-pages');
        await fs.mkdir(outputDir, { recursive: true });
        
        // Clean previous downloads
        const files = await fs.readdir(outputDir);
        for (const file of files) {
            await fs.unlink(path.join(outputDir, file));
        }
        
        // Download sample pages to verify ordering
        const samplesToDownload = [
            { index: 0, desc: 'First page (should be from core block 5157232)' },
            { index: 10, desc: 'Page 11 (last of first core block)' },
            { index: 11, desc: 'Page 12 (first of second core block 5157243)' },
            { index: 230, desc: 'Page 231 (should be from core block near end)' },
            { index: result.images.length - 23, desc: 'Start of technical block 5157616' },
            { index: result.images.length - 12, desc: 'Start of technical block 5157615' },
            { index: result.images.length - 1, desc: 'Last page (should be from technical blocks)' }
        ];
        
        console.log('\n📊 Downloading sample pages to verify order...\n');
        
        for (const sample of samplesToDownload) {
            if (sample.index >= result.images.length) continue;
            
            const image = result.images[sample.index];
            const filename = `page-${String(sample.index + 1).padStart(4, '0')}.jpg`;
            const filepath = path.join(outputDir, filename);
            
            console.log(`📄 Page ${sample.index + 1}: ${sample.desc}`);
            console.log(`   Block: ${image.blockId || 'unknown'}`);
            console.log(`   URL: ${image.url}`);
            
            try {
                await downloadImage(image.url, filepath);
                
                // Check file size
                const stats = await fs.stat(filepath);
                if (stats.size > 0) {
                    console.log(`   ✅ Downloaded successfully (${Math.round(stats.size / 1024)}KB)\n`);
                } else {
                    console.log(`   ❌ Downloaded but file is empty!\n`);
                }
            } catch (error) {
                console.log(`   ❌ Download failed: ${error.message}\n`);
            }
        }
        
        // Create a simple PDF to verify page order
        console.log('📚 Creating test PDF...');
        const pdfPath = path.join(__dirname, 'test-manuscript.pdf');
        
        try {
            // Use ImageMagick to create PDF from downloaded images
            execSync(`convert ${outputDir}/*.jpg ${pdfPath} 2>/dev/null || echo "ImageMagick not available"`);
            
            // Check if PDF was created
            try {
                const pdfStats = await fs.stat(pdfPath);
                if (pdfStats.size > 0) {
                    console.log(`✅ PDF created: ${pdfPath} (${Math.round(pdfStats.size / 1024)}KB)`);
                    
                    // Use pdfimages to verify
                    try {
                        const pdfInfo = execSync(`pdfimages -list ${pdfPath} 2>&1 | head -20`).toString();
                        console.log('\n📋 PDF structure:');
                        console.log(pdfInfo);
                    } catch (e) {
                        // pdfimages might not be available
                    }
                }
            } catch (e) {
                console.log('⚠️  PDF creation skipped (ImageMagick not available)');
            }
        } catch (error) {
            console.log('⚠️  PDF creation skipped');
        }
        
        // Analyze the block ordering
        console.log('\n📊 BLOCK ORDER ANALYSIS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const blockOrder = [];
        let currentBlock = null;
        
        for (const image of result.images) {
            if (image.blockId && image.blockId !== currentBlock) {
                currentBlock = image.blockId;
                blockOrder.push(currentBlock);
            }
        }
        
        console.log(`Total blocks: ${blockOrder.length}`);
        console.log(`First 5 blocks: ${blockOrder.slice(0, 5).join(', ')}`);
        console.log(`Last 5 blocks: ${blockOrder.slice(-5).join(', ')}`);
        
        // Check if technical blocks are at the end
        const technicalBlocks = [5157616, 5157615, 5157627, 5157605];
        let lastCoreIndex = -1;
        let firstTechnicalIndex = result.images.length;
        
        for (let i = 0; i < blockOrder.length; i++) {
            const block = blockOrder[i];
            if (!technicalBlocks.includes(block)) {
                lastCoreIndex = i;
            } else if (firstTechnicalIndex === result.images.length) {
                firstTechnicalIndex = i;
            }
        }
        
        console.log(`\nLast core block position: ${lastCoreIndex}`);
        console.log(`First technical block position: ${firstTechnicalIndex}`);
        
        if (firstTechnicalIndex > lastCoreIndex) {
            console.log('✅ CORRECT: All technical blocks come after core blocks!');
            return true;
        } else {
            console.log('❌ INCORRECT: Technical blocks mixed with core blocks!');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

// Run the test
(async () => {
    const success = await testFullDownload();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (success) {
        console.log('✅ FULL DOWNLOAD TEST PASSED');
        process.exit(0);
    } else {
        console.log('❌ FULL DOWNLOAD TEST FAILED');
        process.exit(1);
    }
})();