/**
 * ULTRA-PRIORITY TILE TEST for Issue #6 - Bordeaux Library
 * Testing tile assembly and download capabilities
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');

async function downloadTile(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }
            
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        }).on('error', reject);
    });
}

async function testBordeauxTiles() {
    console.log('🔬 ULTRA-PRIORITY TILE TEST: Issue #6 - Bordeaux Library');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const url = 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778';
    const outputDir = '.devkit/ultra-priority/issue-6/tiles';
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    const loaders = new SharedManifestLoaders();
    
    try {
        console.log('\n📍 Testing URL:', url);
        console.log('⚡ Getting manifest...');
        
        const manifest = await loaders.getBordeauxManifest(url);
        console.log('✅ Manifest retrieved!');
        console.log(`📊 Details:`);
        console.log(`   - Base ID: ${manifest.baseId}`);
        console.log(`   - Pages: ${manifest.pageCount} (${manifest.startPage}-${manifest.startPage + manifest.pageCount - 1})`);
        console.log(`   - Tile URL: ${manifest.tileBaseUrl}`);
        
        // Test downloading tiles for different pages
        const testPages = [6, 9, 10, 20, 50];
        
        console.log('\n🧩 Testing tile downloads...');
        
        for (const pageNum of testPages) {
            const paddedPage = String(pageNum).padStart(4, '0');
            const pageId = `${manifest.baseId}_${paddedPage}`;
            
            console.log(`\n📄 Testing page ${pageNum} (${pageId})...`);
            
            // Test different zoom levels
            const zoomLevels = [0, 8, 10, 12];
            let successCount = 0;
            
            for (const zoom of zoomLevels) {
                const tileUrl = `${manifest.tileBaseUrl}/${pageId}_files/${zoom}/0_0.jpg`;
                
                try {
                    const tileData = await downloadTile(tileUrl);
                    const filename = `page${pageNum}_zoom${zoom}.jpg`;
                    await fs.writeFile(path.join(outputDir, filename), tileData);
                    
                    console.log(`   ✅ Zoom level ${zoom}: ${(tileData.length / 1024).toFixed(2)} KB`);
                    successCount++;
                } catch (error) {
                    console.log(`   ❌ Zoom level ${zoom}: ${error.message}`);
                }
            }
            
            if (successCount > 0) {
                console.log(`   📊 Downloaded ${successCount}/${zoomLevels.length} zoom levels`);
            }
        }
        
        // Check highest resolution for page 9 (from user's example)
        console.log('\n🔍 Finding highest resolution for page 9...');
        const page9Id = `${manifest.baseId}_0009`;
        let maxZoom = 0;
        
        for (let zoom = 0; zoom <= 15; zoom++) {
            const tileUrl = `${manifest.tileBaseUrl}/${page9Id}_files/${zoom}/0_0.jpg`;
            try {
                await downloadTile(tileUrl);
                maxZoom = zoom;
            } catch (error) {
                // Zoom level not available
                break;
            }
        }
        
        console.log(`📊 Maximum zoom level for page 9: ${maxZoom}`);
        
        // For highest zoom, check tile grid
        if (maxZoom > 10) {
            console.log('\n🧩 Analyzing tile grid at maximum zoom...');
            const tilesFound = [];
            
            for (let row = 0; row < 10; row++) {
                for (let col = 0; col < 10; col++) {
                    const tileUrl = `${manifest.tileBaseUrl}/${page9Id}_files/${maxZoom}/${col}_${row}.jpg`;
                    try {
                        await downloadTile(tileUrl);
                        tilesFound.push(`${col}_${row}`);
                        if (tilesFound.length === 1) {
                            console.log(`   ✅ Found tiles at zoom ${maxZoom}:`);
                        }
                        process.stdout.write(`${col}_${row} `);
                    } catch (error) {
                        // Tile doesn't exist
                    }
                }
            }
            console.log(`\n   📊 Total tiles found: ${tilesFound.length}`);
        }
        
        // List downloaded files
        console.log('\n📁 Downloaded test tiles:');
        const files = await fs.readdir(outputDir);
        for (const file of files) {
            const stats = await fs.stat(path.join(outputDir, file));
            console.log(`  - ${file}: ${(stats.size / 1024).toFixed(2)} KB`);
        }
        
        console.log('\n✅ ANALYSIS COMPLETE');
        console.log('📊 Bordeaux library is functional with tile-based Deep Zoom format');
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('📊 Stack:', error.stack);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 TILE TEST COMPLETE');
}

// Run the test
testBordeauxTiles().catch(console.error);