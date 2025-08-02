#!/usr/bin/env node

const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

async function testBNE() {
    const loaders = new SharedManifestLoaders();
    
    console.log('Testing BNE...');
    const url = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    
    try {
        const manifest = await loaders.getManifestForLibrary('bne', url);
        
        console.log('\n=== RESULT ===');
        console.log('Total pages:', manifest.images ? manifest.images.length : 0);
        
        if (manifest.images) {
            console.log('First page:', manifest.images[0]);
            console.log('Last page:', manifest.images[manifest.images.length - 1]);
        }
        
    } catch (error) {
        console.error('ERROR:', error.message);
    }
}

testBNE().catch(console.error);