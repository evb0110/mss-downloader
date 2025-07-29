#!/usr/bin/env node

const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

async function testHHUCollections() {
    console.log('Testing HHU fix with different collections...');
    
    const loader = new SharedManifestLoaders();
    
    // Test URLs for different collections (these are example patterns)
    const testUrls = [
        'https://digital.ulb.hhu.de/ms/content/titleinfo/9400252',  // /ms/ collection (reported issue)
        'https://digital.ulb.hhu.de/content/titleinfo/7938251',     // regular content
        'https://digital.ulb.hhu.de/hs/content/titleinfo/259994'   // /hs/ collection
    ];
    
    let allSuccess = true;
    
    for (const testUrl of testUrls) {
        try {
            console.log(`\nTesting: ${testUrl}`);
            const result = await loader.getHHUManifest(testUrl);
            console.log(`✅ SUCCESS - Found ${result.images.length} images - ${result.displayName}`);
        } catch (error) {
            console.log(`❌ FAILED: ${error.message}`);
            allSuccess = false;
        }
    }
    
    return allSuccess;
}

testHHUCollections().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test script error:', error);
    process.exit(1);
});