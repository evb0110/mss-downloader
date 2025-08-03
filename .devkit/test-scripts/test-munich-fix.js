#!/usr/bin/env node

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testMunichFix() {
    const loaders = new SharedManifestLoaders();
    const munichUrl = 'https://www.digitale-sammlungen.de/en/view/bsb10193966?page=1';
    
    console.log('Testing Munich library fix...');
    console.log('URL:', munichUrl);
    
    try {
        const manifest = await loaders.getManifestForLibrary('munich', munichUrl);
        console.log('✅ SUCCESS: Munich manifest loaded');
        console.log('Type:', manifest.type);
        console.log('Total pages:', manifest.totalPages);
        console.log('Images:', manifest.images ? manifest.images.length : 'N/A');
        return true;
    } catch (error) {
        console.log('❌ FAILED:', error.message);
        if (error.message.includes('validImagePaths is not defined')) {
            console.log('⚠️  STILL GETTING SCOPE ERROR!');
        }
        return false;
    }
}

testMunichFix().then(success => {
    process.exit(success ? 0 : 1);
});