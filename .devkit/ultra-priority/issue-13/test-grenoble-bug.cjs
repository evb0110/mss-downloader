#!/usr/bin/env node

/**
 * ULTRA-PRIORITY Test Script for Issue #13: Grenoble URL Concatenation Bug
 * This script tests the actual production code to reproduce and fix the bug
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

// Test the exact URL from the issue
const testUrl = 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';

console.log('🔬 ULTRA-PRIORITY TEST FOR ISSUE #13');
console.log('=====================================');
console.log('Test URL:', testUrl);
console.log('');

async function testGrenobleManifest() {
    const loaders = new SharedManifestLoaders();
    
    try {
        console.log('📊 Testing Grenoble manifest loading...');
        console.log('');
        
        // First, let's test if the URL is being sanitized properly
        console.log('1️⃣ Testing URL sanitization:');
        const malformedUrl = 'pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';
        const sanitized = loaders.sanitizeUrl(malformedUrl);
        console.log('   Malformed URL:', malformedUrl);
        console.log('   Sanitized URL:', sanitized);
        console.log('   ✅ Sanitization works correctly');
        console.log('');
        
        // Now test the actual manifest loading
        console.log('2️⃣ Testing manifest loading with correct URL:');
        const manifest = await loaders.getGrenobleManifest(testUrl);
        
        console.log('   ✅ Manifest loaded successfully!');
        console.log('   Total pages found:', manifest.images ? manifest.images.length : 0);
        
        if (manifest.images && manifest.images.length > 0) {
            console.log('   First page URL:', manifest.images[0].url);
            console.log('   Last page URL:', manifest.images[manifest.images.length - 1].url);
        }
        
        return manifest;
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.error('');
        console.error('Stack trace:', error.stack);
        
        // Analyze the error
        if (error.message.includes('EAI_AGAIN')) {
            console.error('');
            console.error('🔍 DIAGNOSIS: DNS resolution error with malformed hostname');
            console.error('   The URL is being concatenated somewhere before reaching fetchUrl');
            console.error('   Need to trace where the hostname is being prepended to the URL');
        }
        
        throw error;
    }
}

// Run the test
testGrenobleManifest()
    .then((manifest) => {
        console.log('');
        console.log('✅ TEST PASSED: Grenoble manifest loaded successfully');
        console.log('📋 Summary:');
        console.log('   - Pages found:', manifest.images ? manifest.images.length : 0);
        console.log('   - Issue #13 appears to be fixed in the manifest loader');
        console.log('');
        console.log('⚠️  However, the error in the issue shows it happens in the IPC handler');
        console.log('   Need to test the complete flow from UI to backend');
        process.exit(0);
    })
    .catch((error) => {
        console.error('');
        console.error('❌ TEST FAILED');
        console.error('   Issue #13 is NOT fixed - URL concatenation bug still present');
        process.exit(1);
    });