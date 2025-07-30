#!/usr/bin/env node

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function debugManifest() {
    const loaders = new SharedManifestLoaders();
    
    console.log('Testing Graz manifest structure...');
    try {
        const result = await loaders.getGrazManifest('https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538');
        console.log('Graz result:', {
            hasImages: !!result.images,
            imageCount: result.images ? result.images.length : 0,
            firstImage: result.images && result.images[0] ? result.images[0] : 'none',
            keys: Object.keys(result)
        });
    } catch (e) {
        console.error('Graz error:', e.message);
    }
    
    console.log('\nTesting Verona manifest structure...');
    try {
        const result = await loaders.getVeronaManifest('https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15');
        console.log('Verona result:', {
            hasImages: !!result.images,
            imageCount: result.images ? result.images.length : 0,
            firstImage: result.images && result.images[0] ? result.images[0] : 'none',
            keys: Object.keys(result)
        });
    } catch (e) {
        console.error('Verona error:', e.message);
    }
}

debugManifest();