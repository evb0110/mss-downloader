#!/usr/bin/env node

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function checkManifest() {
    const loaders = new SharedManifestLoaders();
    
    // Test Graz
    console.log('Testing Graz manifest structure...');
    const grazManifest = await loaders.getManifestForLibrary('graz', 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688');
    
    console.log('Graz manifest type:', typeof grazManifest);
    console.log('Is array?', Array.isArray(grazManifest));
    
    if (Array.isArray(grazManifest)) {
        console.log('Array length:', grazManifest.length);
        if (grazManifest.length > 0) {
            console.log('First item:', grazManifest[0]);
        }
    } else {
        console.log('Keys:', Object.keys(grazManifest || {}));
        if (grazManifest && grazManifest.images) {
            console.log('Images length:', grazManifest.images.length);
            if (grazManifest.images.length > 0) {
                console.log('First image:', grazManifest.images[0]);
            }
        }
    }
}

checkManifest().catch(console.error);