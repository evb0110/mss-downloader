/**
 * ULTRA-PRIORITY TEST for Issue #6 - Bordeaux Library
 * Testing with actual production code to reproduce and fix the issue
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

async function testBordeauxIssue() {
    console.log('🔬 ULTRA-PRIORITY TEST: Issue #6 - Bordeaux Library');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // User's exact URLs from issue #6
    const testUrls = [
        'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778',
        'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778/v0001.simple.selectedTab=thumbnail.hidesidebar'
    ];
    
    const loaders = new SharedManifestLoaders();
    
    for (const url of testUrls) {
        console.log(`\n📍 Testing URL: ${url}`);
        console.log('────────────────────────────────────────────────');
        
        try {
            console.log('⚡ Attempting to get Bordeaux manifest...');
            const manifest = await loaders.getBordeauxManifest(url);
            
            if (manifest) {
                console.log('✅ Manifest retrieved successfully!');
                console.log('📊 Manifest details:');
                console.log(`  - Type: ${manifest.type}`);
                console.log(`  - Base ID: ${manifest.baseId}`);
                console.log(`  - Public ID: ${manifest.publicId}`);
                console.log(`  - Page Count: ${manifest.pageCount}`);
                console.log(`  - Start Page: ${manifest.startPage}`);
                console.log(`  - Tile Base URL: ${manifest.tileBaseUrl}`);
                
                // Test if tiles are accessible
                if (manifest.baseId) {
                    const testTileUrl = `${manifest.tileBaseUrl}/${manifest.baseId}_0001_files/0/0_0.jpg`;
                    console.log(`\n🔍 Testing tile accessibility: ${testTileUrl}`);
                    
                    const https = require('https');
                    const testTile = await new Promise((resolve) => {
                        https.get(testTileUrl, (res) => {
                            if (res.statusCode === 200) {
                                console.log('✅ Tile is accessible!');
                                resolve(true);
                            } else {
                                console.log(`⚠️ Tile returned status: ${res.statusCode}`);
                                resolve(false);
                            }
                        }).on('error', (err) => {
                            console.log(`❌ Error accessing tile: ${err.message}`);
                            resolve(false);
                        });
                    });
                }
            }
        } catch (error) {
            console.error('❌ ERROR:', error.message);
            console.error('📊 Error stack:', error.stack);
            
            // This is the expected error we need to fix
            if (error.message.includes('Invalid Bordeaux URL format')) {
                console.log('\n🔴 ISSUE REPRODUCED: URL pattern not recognized');
                console.log('📝 Root cause: The URL pattern with full domain is not handled');
                console.log('💡 Solution needed: Update URL pattern matching to handle full URLs');
            }
        }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 TEST ANALYSIS COMPLETE');
}

// Run the test
testBordeauxIssue().catch(console.error);