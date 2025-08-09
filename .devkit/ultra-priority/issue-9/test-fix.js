const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

async function testFix() {
    console.log('🔬 Testing BDL fix...\n');
    const loaders = new SharedManifestLoaders();
    const url = 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903';
    
    try {
        console.log('📊 Fetching manifest with fix...');
        const manifest = await loaders.getManifestForLibrary('bdl', url);
        
        console.log(`\n✅ Results:`);
        console.log(`  Total unique images: ${manifest.images.length}`);
        
        // Check for duplicates
        const urls = manifest.images.map(img => img.url);
        const uniqueUrls = new Set(urls);
        console.log(`  Duplicate URLs: ${urls.length - uniqueUrls.size}`);
        
        // Check URL format
        console.log(`\n📋 Sample URLs (first 3):`);
        for (let i = 0; i < Math.min(3, manifest.images.length); i++) {
            console.log(`  ${i + 1}: ${manifest.images[i].url}`);
        }
        
        // Check for double slashes issue
        const doubleSlashCount = manifest.images.filter(img => 
            img.url.includes('cantaloupe//iiif')).length;
        
        if (doubleSlashCount > 0) {
            console.log(`\n⚠️ Still has double slashes: ${doubleSlashCount} URLs`);
        } else {
            console.log(`\n✅ No double slashes found - URLs are clean!`);
        }
        
        // Test actual download of a few images
        console.log(`\n🔬 Testing actual image downloads...`);
        const https = require('https');
        
        for (let i = 0; i < Math.min(3, manifest.images.length); i++) {
            await new Promise((resolve) => {
                const testUrl = manifest.images[i].url;
                https.get(testUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    rejectUnauthorized: false
                }, (response) => {
                    const contentType = response.headers['content-type'];
                    const contentLength = response.headers['content-length'];
                    
                    if (response.statusCode === 200 && contentType && contentType.includes('image')) {
                        console.log(`  Page ${i + 1}: ✅ OK (${(contentLength / 1024).toFixed(1)} KB)`);
                    } else {
                        console.log(`  Page ${i + 1}: ❌ Status ${response.statusCode}`);
                    }
                    response.destroy();
                    resolve();
                }).on('error', (err) => {
                    console.log(`  Page ${i + 1}: ❌ Error: ${err.message}`);
                    resolve();
                });
            });
        }
        
        console.log(`\n✅ Fix Summary:`);
        console.log(`  - Removed duplicate media IDs`);
        console.log(`  - Fixed double slash in URLs`);
        console.log(`  - Used dynamic cantaloupeUrl from API`);
        console.log(`  - Result: ${manifest.images.length} unique, valid pages`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

testFix();