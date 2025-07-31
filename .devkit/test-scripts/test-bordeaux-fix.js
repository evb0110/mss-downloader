#!/usr/bin/env node

/**
 * Test Bordeaux fix using ACTUAL production code
 * This mimics exactly what the Electron app does
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

const BORDEAUX_URL = 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778';

async function downloadTile(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
                return;
            }
            
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        }).on('error', reject);
    });
}

async function testBordeaux() {
    console.log('Testing Bordeaux with production code...\n');
    
    try {
        // Step 1: Use SharedManifestLoaders to get manifest (like production)
        const manifestLoaders = new SharedManifestLoaders();
        const rawManifest = await manifestLoaders.getBordeauxManifest(BORDEAUX_URL);
        
        console.log('Raw manifest from SharedManifestLoaders:', JSON.stringify(rawManifest, null, 2));
        
        // Step 2: Simulate what SharedManifestAdapter does
        if (rawManifest.requiresTileProcessor && rawManifest.tileConfig) {
            console.log('\nManifest requires tile processor');
            console.log('Tile config:', JSON.stringify(rawManifest.tileConfig, null, 2));
            
            // Step 3: Test actual tile download
            const tileConfig = rawManifest.tileConfig;
            const pageNum = tileConfig.startPage;
            const pageId = `${tileConfig.baseId}_${String(pageNum).padStart(4, '0')}`;
            
            // Try to probe the tile structure
            const testUrl = `${tileConfig.tileBaseUrl}/${pageId}_files/12/0_0.jpg`;
            console.log(`\nTesting tile URL: ${testUrl}`);
            
            try {
                const tileData = await downloadTile(testUrl);
                console.log(`✅ SUCCESS: Downloaded test tile (${tileData.length} bytes)`);
                
                // This proves tiles are accessible
                return { success: true, message: 'Bordeaux tiles are accessible!' };
            } catch (error) {
                console.log(`❌ FAILED to download tile: ${error.message}`);
                
                // Try different zoom levels
                console.log('\nTrying different zoom levels...');
                for (let level = 14; level >= 8; level--) {
                    const altUrl = `${tileConfig.tileBaseUrl}/${pageId}_files/${level}/0_0.jpg`;
                    try {
                        const tileData = await downloadTile(altUrl);
                        console.log(`✅ Found tiles at level ${level} (${tileData.length} bytes)`);
                        return { success: true, message: `Bordeaux tiles found at level ${level}!` };
                    } catch (err) {
                        // Continue trying
                    }
                }
                
                return { success: false, error: 'Could not find valid tiles' };
            }
        } else {
            console.log('❌ Manifest does not have tile processor config');
            return { success: false, error: 'Missing tile processor config' };
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        return { success: false, error: error.message };
    }
}

// Run test
testBordeaux().then(result => {
    console.log('\n=== Test Result ===');
    console.log(result);
    process.exit(result.success ? 0 : 1);
});