#!/usr/bin/env node

/**
 * Test Bordeaux issue with actual production code
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

const testUrl = 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778';

async function testBordeaux() {
    console.log('Testing Bordeaux URL processing...\n');
    
    const loaders = new SharedManifestLoaders();
    
    try {
        const manifest = await loaders.getBordeauxManifest(testUrl);
        
        console.log('Manifest structure:');
        console.log(JSON.stringify(manifest, null, 2));
        
        console.log('\nChecking manifest properties:');
        console.log('- type:', manifest.type);
        console.log('- requiresTileProcessor:', manifest.requiresTileProcessor);
        console.log('- tileConfig:', manifest.tileConfig);
        console.log('- tileConfig.baseId:', manifest.tileConfig?.baseId);
        
        if (manifest.images) {
            console.log('- images:', Array.isArray(manifest.images) ? `Array with ${manifest.images.length} items` : 'Not an array');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

testBordeaux();