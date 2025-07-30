#!/usr/bin/env node

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testLibrary(name, url) {
    const loaders = new SharedManifestLoaders();
    console.log(`\n[${name}] Testing with URL: ${url}`);
    
    try {
        const startTime = Date.now();
        let result;
        
        switch(name) {
            case 'morgan':
                result = await loaders.getMorganManifest(url);
                break;
            case 'florence':
                result = await loaders.getFlorenceManifest(url);
                break;
            case 'bordeaux':
                result = await loaders.getBordeauxManifest(url);
                break;
        }
        
        const elapsed = Date.now() - startTime;
        
        if (result) {
            console.log(`✅ SUCCESS in ${elapsed}ms`);
            console.log(`Pages: ${result.images ? result.images.length : result.pageCount || 0}`);
            if (result.images && result.images[0]) {
                console.log(`First page: ${result.images[0].url}`);
            }
            console.log(`Result keys:`, Object.keys(result));
        }
    } catch (error) {
        console.log(`❌ FAILED: ${error.message}`);
    }
}

async function main() {
    // Test remaining libraries
    await testLibrary('morgan', 'https://www.themorgan.org/collection/lindau-gospels/thumbs');
    await testLibrary('florence', 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/');
    await testLibrary('bordeaux', 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778');
}

main();