#!/usr/bin/env node

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function quickTest() {
    const loader = new SharedManifestLoaders();
    
    // Test Morgan (#4)
    console.log('\n=== Testing Morgan (#4) ===');
    try {
        const result = await loader.getManifestForLibrary('morgan', 'https://www.themorgan.org/collection/lindau-gospels/thumbs');
        const pages = result.pages || result.images;
        console.log(`✅ Morgan: ${pages ? pages.length : 0} pages`);
    } catch (e) {
        console.log(`❌ Morgan: ${e.message}`);
    }
    
    // Test BNE (#11)
    console.log('\n=== Testing BNE (#11) ===');
    try {
        const result = await loader.getManifestForLibrary('bne', 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1');
        const pages = result.pages || result.images;
        console.log(`✅ BNE: ${pages ? pages.length : 0} pages`);
    } catch (e) {
        console.log(`❌ BNE: ${e.message}`);
    }
    
    // Test Zurich (#10)
    console.log('\n=== Testing Zurich (#10) ===');
    try {
        const result = await loader.getManifestForLibrary('e_manuscripta', 'https://www.e-manuscripta.ch/bau/content/zoom/5157616');
        const pages = result.pages || result.images;
        console.log(`✅ Zurich: ${pages ? pages.length : 0} pages`);
    } catch (e) {
        console.log(`❌ Zurich: ${e.message}`);
    }
    
    console.log('\n=== Summary ===');
    console.log('Morgan, BNE, and Zurich are the critical ones to fix');
}

quickTest();