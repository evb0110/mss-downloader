#!/usr/bin/env node

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function validateMunichFix() {
    console.log('=== VALIDATING MUNICH FIX ===\n');
    
    const loaders = new SharedManifestLoaders();
    const testUrls = [
        'https://www.digitale-sammlungen.de/en/view/bsb00050763?page=1',
        'https://www.digitale-sammlungen.de/en/view/bsb10193966?page=1'
    ];
    
    let allPassed = true;
    
    for (const url of testUrls) {
        console.log(`Testing: ${url}`);
        try {
            const manifest = await loaders.getManifestForLibrary('munich', url);
            console.log(`✅ SUCCESS: Loaded ${manifest.images.length} pages`);
            console.log(`   Type: ${manifest.type || 'iiif'}`);
            console.log(`   Sample image: ${manifest.images[0].url}\n`);
        } catch (error) {
            console.log(`❌ FAILED: ${error.message}`);
            if (error.message.includes('validImagePaths')) {
                console.log('   ⚠️  SCOPE ERROR STILL PRESENT!\n');
                allPassed = false;
            }
        }
    }
    
    if (allPassed) {
        console.log('✅ ALL TESTS PASSED - Munich fix verified!');
    } else {
        console.log('❌ TESTS FAILED - Issue not fully resolved');
    }
    
    return allPassed;
}

validateMunichFix().then(success => {
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error('Validation error:', err);
    process.exit(1);
});