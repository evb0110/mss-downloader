#!/usr/bin/env node

/**
 * Test script for Issue #11 - BNE library only detecting 100 pages instead of 438
 * Tests with the EXACT URL: https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1
 * Uses PRODUCTION CODE from SharedManifestLoaders.js
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testBNEPageDetection() {
    console.log('🔍 Testing Issue #11 - BNE Page Detection');
    console.log('=========================================\n');

    const testUrl = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    console.log(`📖 Testing URL: ${testUrl}`);
    console.log(`📋 Expected: 438 pages`);
    console.log(`❌ Current issue: Only detecting 100 pages\n`);

    try {
        const loaders = new SharedManifestLoaders();
        
        console.log('⏳ Loading BNE manifest using production code...\n');
        const manifest = await loaders.getBNEManifest(testUrl);
        
        const detectedPages = manifest.images.length;
        console.log(`📊 RESULT: Detected ${detectedPages} pages`);
        
        if (detectedPages === 100) {
            console.log(`❌ BUG CONFIRMED: Only detecting 100 pages (hardcoded limit)`);
            console.log(`🎯 Expected: 438 pages`);
            console.log(`🔧 Fix needed: Remove hardcoded 100 page limit in direct PDF access branch`);
        } else if (detectedPages === 438) {
            console.log(`✅ SUCCESS: Correctly detected all 438 pages`);
        } else {
            console.log(`⚠️  UNEXPECTED: Detected ${detectedPages} pages (expected 438)`);
        }
        
        // Show first and last few pages
        console.log('\n📋 Page Sample:');
        console.log('First 3 pages:');
        for (let i = 0; i < Math.min(3, manifest.images.length); i++) {
            console.log(`  Page ${i+1}: ${manifest.images[i].label}`);
        }
        
        if (manifest.images.length > 3) {
            console.log('Last 3 pages:');
            const start = Math.max(0, manifest.images.length - 3);
            for (let i = start; i < manifest.images.length; i++) {
                console.log(`  Page ${i+1}: ${manifest.images[i].label}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
if (require.main === module) {
    testBNEPageDetection().catch(console.error);
}

module.exports = { testBNEPageDetection };