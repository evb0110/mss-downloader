#!/usr/bin/env node

/**
 * ULTRA-PRIORITY Issue #13 - Grenoble URL Concatenation Bug
 * Testing with PRODUCTION CODE - NO ISOLATED SCRIPTS
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testGrenobleWithProductionCode() {
    console.log('🔥 ULTRA-PRIORITY TEST: Issue #13 - Grenoble URL Concatenation');
    console.log('━'.repeat(60));
    
    const loaders = new SharedManifestLoaders();
    const userURL = 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';
    
    console.log('📍 Testing exact user URL:', userURL);
    console.log('⚙️  Using PRODUCTION SharedManifestLoaders');
    console.log('');
    
    try {
        // Test URL parsing first
        console.log('Step 1: Parsing manuscript URL...');
        const parsed = new URL(userURL);
        console.log('  ✅ URL parsed successfully');
        console.log('  - hostname:', parsed.hostname);
        console.log('  - pathname:', parsed.pathname);
        console.log('');
        
        // Now test with production loader
        console.log('Step 2: Loading manifest with production code...');
        console.log('  Calling loadManifest()...');
        
        const startTime = Date.now();
        const result = await loaders.loadManifest(userURL);
        const elapsed = Date.now() - startTime;
        
        console.log(`  ✅ Manifest loaded successfully in ${elapsed}ms`);
        console.log('');
        console.log('📊 Manifest Details:');
        console.log('  - Pages found:', result.pages?.length || 0);
        console.log('  - Title:', result.title || 'N/A');
        console.log('  - Library:', result.library || 'N/A');
        
        if (result.pages && result.pages.length > 0) {
            console.log('');
            console.log('📄 Sample pages:');
            console.log('  Page 1:', result.pages[0].url);
            if (result.pages.length > 1) {
                console.log('  Page 2:', result.pages[1].url);
            }
            if (result.pages.length > 10) {
                console.log('  Page 10:', result.pages[9].url);
            }
        }
        
        console.log('');
        console.log('✅ SUCCESS: Grenoble URL works correctly!');
        console.log('🎯 Issue #13 appears to be RESOLVED in current code');
        
    } catch (error) {
        console.log('');
        console.log('❌ ERROR REPRODUCED - Issue #13 still exists!');
        console.log('');
        console.log('📍 Error Details:');
        console.log('  - Type:', error.code || 'Unknown');
        console.log('  - Message:', error.message);
        
        // Check if this is the concatenation error
        if (error.message.includes('pagella.bm-grenoble.frhttps://')) {
            console.log('');
            console.log('🚨 CRITICAL: URL CONCATENATION BUG CONFIRMED!');
            console.log('  The hostname is being concatenated with the full URL');
            console.log('  Result:', error.message.match(/pagella\.bm-grenoble\.fr[^s]*/)?.[0]);
            console.log('');
            console.log('🔍 This confirms the bug is STILL PRESENT despite 4 "fixes"');
        }
        
        console.log('');
        console.log('📋 Full Error Stack:');
        console.log(error.stack);
        
        console.log('');
        console.log('⚠️  FAILURE: Issue #13 needs a REAL fix!');
        process.exit(1);
    }
}

// Run the test
console.log('Starting ULTRA-PRIORITY test for Issue #13...\n');
testGrenobleWithProductionCode().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});