#!/usr/bin/env node

const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

async function testHHUFix() {
    console.log('Testing HHU regression fix...');
    
    const loader = new SharedManifestLoaders();
    const testUrl = 'https://digital.ulb.hhu.de/ms/content/titleinfo/9400252';
    
    try {
        console.log(`Testing URL: ${testUrl}`);
        const result = await loader.getHHUManifest(testUrl);
        
        console.log('✅ SUCCESS!');
        console.log(`- Found ${result.images.length} images`);
        console.log(`- Display name: ${result.displayName}`);
        console.log(`- First image URL: ${result.images[0]?.url}`);
        
        // Test that the first image URL is accessible
        if (result.images.length > 0) {
            console.log('\nTesting first image URL...');
            const response = await loader.fetchWithRetry(result.images[0].url, {}, 1);
            if (response.ok) {
                console.log('✅ First image URL is accessible');
            } else {
                console.log(`❌ First image URL returned: ${response.status}`);
            }
        }
        
    } catch (error) {
        console.log('❌ FAILED:', error.message);
        return false;
    }
    
    return true;
}

testHHUFix().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test script error:', error);
    process.exit(1);
});