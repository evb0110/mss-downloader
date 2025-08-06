#!/usr/bin/env node

/**
 * ULTRA-PRIORITY TEST: Simple test for Issue #13 fix
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

async function testGrenobleSimple() {
    console.log('🔥 TESTING GRENOBLE FIX 🔥\n');
    
    const loaders = new SharedManifestLoaders();
    
    // Test URL sanitization
    console.log('Testing URL sanitization:');
    
    const testUrls = [
        'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
        'pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
        'pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k'
    ];
    
    for (const url of testUrls) {
        console.log(`\nOriginal: ${url}`);
        const sanitized = loaders.sanitizeUrl(url);
        console.log(`Sanitized: ${sanitized}`);
        console.log(`✅ Fixed: ${sanitized.startsWith('https://pagella.bm-grenoble.fr')}`);
    }
    
    // Test actual manifest fetching
    console.log('\n' + '='.repeat(60));
    console.log('Testing manifest fetch with normal URL:');
    
    try {
        const normalUrl = 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';
        const manifest = await loaders.getGrenobleManifest(normalUrl);
        console.log(`✅ SUCCESS: Found ${manifest.images?.length || 0} pages`);
    } catch (error) {
        console.error(`❌ ERROR: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Testing manifest fetch with MALFORMED URL:');
    
    try {
        const malformedUrl = 'pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';
        const sanitized = loaders.sanitizeUrl(malformedUrl);
        console.log(`Sanitized URL: ${sanitized}`);
        const manifest = await loaders.getGrenobleManifest(sanitized);
        console.log(`✅ SUCCESS: Found ${manifest.images?.length || 0} pages`);
        console.log('🎉 FIX VERIFIED: Malformed URL was handled correctly!');
    } catch (error) {
        console.error(`❌ ERROR: ${error.message}`);
        console.error('⚠️ Fix may not be complete');
    }
}

testGrenobleSimple().catch(console.error);