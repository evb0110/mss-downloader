/**
 * Test script for Bordeaux direct tile access without DZI XML
 * This validates the approach of probing tiles to determine dimensions
 */

const https = require('https');
const fs = require('fs').promises;
const path = require('path');

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (response) => {
            if (response.statusCode === 404) {
                resolve({ exists: false });
                return;
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode} for ${url}`));
                return;
            }
            
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve({ exists: true, size: buffer.length, buffer });
            });
            response.on('error', reject);
        }).on('error', reject);
    });
}

async function probeTileStructure(baseUrl) {
    console.log('🔍 Probing tile structure for:', baseUrl);
    
    // Known Bordeaux tile parameters from analysis
    const tileSize = 256;
    const overlap = 1;
    const format = 'jpg';
    
    // Find the highest zoom level by testing levels
    let maxLevel = 0;
    for (let level = 15; level >= 0; level--) {
        const testUrl = `${baseUrl}_files/${level}/0_0.${format}`;
        try {
            const result = await fetchUrl(testUrl);
            if (result.exists) {
                maxLevel = level;
                console.log(`✅ Found max level: ${level}`);
                break;
            }
        } catch (error) {
            // Continue searching
        }
    }
    
    // Probe tiles at max level to determine grid size
    let maxCol = 0;
    let maxRow = 0;
    
    // Find max column
    for (let col = 0; col < 100; col++) {
        const testUrl = `${baseUrl}_files/${maxLevel}/${col}_0.${format}`;
        try {
            const result = await fetchUrl(testUrl);
            if (!result.exists) break;
            maxCol = col;
        } catch (error) {
            break;
        }
    }
    
    // Find max row
    for (let row = 0; row < 100; row++) {
        const testUrl = `${baseUrl}_files/${maxLevel}/0_${row}.${format}`;
        try {
            const result = await fetchUrl(testUrl);
            if (!result.exists) break;
            maxRow = row;
        } catch (error) {
            break;
        }
    }
    
    console.log(`📐 Grid size at level ${maxLevel}: ${maxCol + 1} x ${maxRow + 1} tiles`);
    
    // Calculate approximate dimensions
    const scale = Math.pow(2, maxLevel);
    const approxWidth = (maxCol + 1) * tileSize;
    const approxHeight = (maxRow + 1) * tileSize;
    
    console.log(`📏 Approximate dimensions: ${approxWidth} x ${approxHeight} pixels`);
    console.log(`🔍 Scale factor: ${scale}`);
    
    return {
        maxLevel,
        tileSize,
        overlap,
        format,
        gridCols: maxCol + 1,
        gridRows: maxRow + 1,
        approxWidth,
        approxHeight,
        baseUrl
    };
}

async function downloadSampleTiles(tileInfo) {
    const outputDir = path.join(__dirname, '.devkit/validation/bordeaux-tiles', new Date().toISOString().split('T')[0]);
    await fs.mkdir(outputDir, { recursive: true });
    
    console.log('\n📥 Downloading sample tiles...');
    
    // Download tiles from different levels
    const samples = [
        { level: tileInfo.maxLevel, col: 0, row: 0, desc: 'Top-left at max zoom' },
        { level: tileInfo.maxLevel, col: Math.floor(tileInfo.gridCols / 2), row: Math.floor(tileInfo.gridRows / 2), desc: 'Center at max zoom' },
        { level: Math.max(0, tileInfo.maxLevel - 2), col: 0, row: 0, desc: 'Top-left at lower zoom' },
        { level: 0, col: 0, row: 0, desc: 'Level 0 (lowest zoom)' }
    ];
    
    for (const sample of samples) {
        const url = `${tileInfo.baseUrl}_files/${sample.level}/${sample.col}_${sample.row}.${tileInfo.format}`;
        try {
            const result = await fetchUrl(url);
            if (result.exists) {
                const filename = `level${sample.level}_${sample.col}_${sample.row}.jpg`;
                await fs.writeFile(path.join(outputDir, filename), result.buffer);
                console.log(`  ✅ ${sample.desc}: ${filename} (${(result.size / 1024).toFixed(1)} KB)`);
            }
        } catch (error) {
            console.log(`  ❌ Failed to download ${sample.desc}`);
        }
    }
    
    // Save tile structure info
    const infoPath = path.join(outputDir, 'tile-structure.json');
    await fs.writeFile(infoPath, JSON.stringify(tileInfo, null, 2));
    console.log(`\n📄 Tile structure saved to: tile-structure.json`);
    
    return outputDir;
}

async function testBordeauxDirectTiles() {
    console.log('🧪 Testing Bordeaux Direct Tile Access\n');
    
    // Test manuscript: 330636101_MS0778_0009
    const baseUrl = 'https://selene.bordeaux.fr/in/dz/330636101_MS0778_0009';
    
    try {
        // Probe tile structure
        const tileInfo = await probeTileStructure(baseUrl);
        
        // Download sample tiles
        const outputDir = await downloadSampleTiles(tileInfo);
        
        console.log(`\n✅ Test complete! Check results in: ${outputDir}`);
        
        // Return structure for use in manifest
        console.log('\n📋 Manifest structure for direct tile access:');
        console.log(JSON.stringify({
            type: 'tiles',
            tileInfo: {
                baseUrl,
                maxLevel: tileInfo.maxLevel,
                tileSize: tileInfo.tileSize,
                overlap: tileInfo.overlap,
                format: tileInfo.format,
                gridSize: {
                    cols: tileInfo.gridCols,
                    rows: tileInfo.gridRows
                },
                estimatedDimensions: {
                    width: tileInfo.approxWidth,
                    height: tileInfo.approxHeight
                }
            }
        }, null, 2));
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testBordeauxDirectTiles().catch(console.error);