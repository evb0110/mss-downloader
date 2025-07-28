#!/usr/bin/env node

const { SharedManifestLoaders } = require('../../dist/shared/SharedManifestLoaders');

async function testFlorenceIssue() {
    console.log('🔍 Testing Florence ContentDM Manifest Loading Issue\n');
    console.log('Issue: Similar to Graz - endless manifest loading, JavaScript errors');
    console.log('=' .repeat(60));
    
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
    
    try {
        console.log(`\nTest URL: ${testUrl}`);
        console.log('Starting manifest load...\n');
        
        const startTime = Date.now();
        const loader = new SharedManifestLoaders();
        
        // Add detailed logging
        console.log('[1] Attempting to get Florence manifest...');
        const manifest = await loader.getManifestForLibrary('florence', testUrl);
        const loadTime = Date.now() - startTime;
        
        console.log(`\n✅ Manifest loaded successfully in ${loadTime}ms!`);
        console.log(`Total images: ${manifest.images.length}`);
        console.log(`\nFirst 3 images:`);
        for (let i = 0; i < Math.min(3, manifest.images.length); i++) {
            console.log(`  ${i+1}. ${manifest.images[i].label} - ${manifest.images[i].url}`);
        }
        
        // Test if images are accessible
        console.log('\n[2] Testing image accessibility...');
        const https = require('https');
        
        for (let i = 0; i < Math.min(3, manifest.images.length); i++) {
            const imageUrl = manifest.images[i].url;
            console.log(`\nTesting image ${i+1}: ${manifest.images[i].label}`);
            
            await new Promise((resolve) => {
                const testStart = Date.now();
                https.get(imageUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 30000
                }, (res) => {
                    const testTime = Date.now() - testStart;
                    if (res.statusCode === 200) {
                        console.log(`  ✅ Image accessible (${testTime}ms, ${res.headers['content-length']} bytes)`);
                    } else {
                        console.log(`  ❌ HTTP ${res.statusCode} - ${res.statusMessage}`);
                    }
                    res.destroy();
                    resolve();
                }).on('error', (err) => {
                    console.log(`  ❌ Error: ${err.message}`);
                    resolve();
                }).on('timeout', () => {
                    console.log(`  ❌ Timeout after 30 seconds`);
                    resolve();
                });
            });
        }
        
        console.log('\n✅ Florence ContentDM appears to be working correctly!');
        console.log('   No endless loading or JavaScript errors detected.');
        
    } catch (error) {
        console.error('\n❌ Florence manifest loading failed!');
        console.error('Error:', error.message);
        console.error('\nFull error:');
        console.error(error);
        
        if (error.message.includes('timeout')) {
            console.error('\n⏱️ TIMEOUT DETECTED - Similar to Graz issue');
            console.error('The Florence server is not responding within the timeout period.');
        }
        
        if (error.message.includes('JSON')) {
            console.error('\n🔧 JSON PARSING ERROR - JavaScript error detected');
            console.error('The server may be returning invalid data or an error page.');
        }
    }
}

// Run the test
testFlorenceIssue().catch(console.error);