#!/usr/bin/env node

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

console.log('\n=== ISSUE #19 FINAL TEST ===\n');

async function test() {
    const userURL = 'https://digi.ub.uni-heidelberg.de/diglit/salVIII2';
    console.log('Testing:', userURL);
    
    try {
        const loader = new SharedManifestLoaders();
        const manifest = await loader.getHeidelbergManifest(userURL);
        
        console.log('\nSUCCESS! Heidelberg works perfectly:');
        console.log('- Title:', manifest.displayName);
        console.log('- Pages:', manifest.images.length);
        console.log('- First image:', manifest.images[0].url);
        
        console.log('\nCONCLUSION: Heidelberg IS WORKING in v1.4.90');
        console.log('User needs to UPDATE from v1.4.86 to v1.4.90');
        
    } catch (error) {
        console.log('ERROR:', error.message);
    }
}

test();