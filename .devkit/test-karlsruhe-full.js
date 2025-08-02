#!/usr/bin/env node

const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

async function testKarlsruhe() {
    const loaders = new SharedManifestLoaders();
    
    console.log('Testing Karlsruhe with proxy URL...');
    const url = 'https://i3f.vls.io/?collection=i3fblbk&id=https%3A%2F%2Fdigital.blb-karlsruhe.de%2Fi3f%2Fv20%2F3069001%2Fmanifest';
    
    try {
        const manifest = await loaders.getManifestForLibrary('karlsruhe', url);
        
        console.log('\n=== RESULT ===');
        console.log('Total pages:', manifest.images ? manifest.images.length : 0);
        
        if (manifest.images) {
            console.log('First page:', manifest.images[0]);
            console.log('Last page:', manifest.images[manifest.images.length - 1]);
            
            if (manifest.images.length === 431) {
                console.log('\n✅ SUCCESS! All 431 pages loaded!');
            } else {
                console.log(`\n⚠️  WARNING: Expected 431 pages but got ${manifest.images.length}`);
            }
        }
        
    } catch (error) {
        console.error('ERROR:', error.message);
    }
}

testKarlsruhe().catch(console.error);