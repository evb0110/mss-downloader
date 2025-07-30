#!/usr/bin/env node

/**
 * Test Bordeaux library with current implementation to identify issues
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testBordeauxCurrent() {
    console.log('=== Testing Bordeaux library with current implementation ===\n');
    
    const loader = new SharedManifestLoaders();
    const testUrl = 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778';
    
    try {
        console.log('Testing URL:', testUrl);
        console.log('Attempting to get manifest...\n');
        
        const manifest = await loader.getBordeauxManifest(testUrl);
        
        console.log('Manifest structure:');
        console.log('- Type:', manifest.type);
        console.log('- Base ID:', manifest.baseId);
        console.log('- Public ID:', manifest.publicId);
        console.log('- Start Page:', manifest.startPage);
        console.log('- Page Count:', manifest.pageCount);
        console.log('- Requires Tile Processor:', manifest.requiresTileProcessor);
        
        if (manifest.images) {
            console.log('\nFound', manifest.images.length, 'regular images:');
            manifest.images.slice(0, 5).forEach((img, i) => {
                console.log(`  ${i + 1}. ${img.label}: ${img.url}`);
            });
        }
        
        return manifest;
        
    } catch (error) {
        console.error('ERROR:', error.message);
        console.error('Stack:', error.stack);
        return null;
    }
}

if (require.main === module) {
    testBordeauxCurrent().then(() => {
        console.log('\n=== Test completed ===');
    });
}

module.exports = { testBordeauxCurrent };