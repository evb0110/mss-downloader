const { SharedManifestLoaders } = require('./src/shared/SharedManifestLoaders.js');
const fs = require('fs');
const path = require('path');

// Test URL from user report
const testUrl = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538';

async function testGrazFix() {
    console.log('Testing University of Graz manifest loading fix...\n');
    
    const loaders = new SharedManifestLoaders();
    
    try {
        console.log('Testing URL:', testUrl);
        console.log('Starting manifest load...\n');
        
        const startTime = Date.now();
        
        // Set a reasonable timeout for the test
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Test timeout after 2 minutes')), 120000);
        });
        
        const manifest = await Promise.race([
            loaders.getGrazManifest(testUrl),
            timeoutPromise
        ]);
        
        const elapsed = Date.now() - startTime;
        
        console.log(`\nManifest loaded successfully in ${(elapsed / 1000).toFixed(1)} seconds`);
        console.log('Manuscript title:', manifest.displayName);
        console.log('Total pages found:', manifest.images.length);
        
        // Show first few pages
        console.log('\nFirst 5 pages:');
        for (let i = 0; i < Math.min(5, manifest.images.length); i++) {
            console.log(`  ${i + 1}. ${manifest.images[i].label} - ${manifest.images[i].url}`);
        }
        
        // Test if images are accessible
        console.log('\nTesting image accessibility...');
        const testImageUrl = manifest.images[0].url;
        
        try {
            const https = require('https');
            await new Promise((resolve, reject) => {
                https.get(testImageUrl, { 
                    headers: { 
                        'User-Agent': 'Mozilla/5.0' 
                    },
                    timeout: 30000 
                }, (res) => {
                    if (res.statusCode === 200) {
                        console.log('✓ First image is accessible (status 200)');
                        resolve();
                    } else {
                        reject(new Error(`Image returned status ${res.statusCode}`));
                    }
                }).on('error', reject);
            });
        } catch (imgError) {
            console.error('✗ Failed to access first image:', imgError.message);
        }
        
        console.log('\n✓ University of Graz fix is working properly!');
        
    } catch (error) {
        console.error('\n✗ Test failed:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    }
}

// Run the test
testGrazFix().catch(console.error);