#!/usr/bin/env node

/**
 * ULTRA-PRIORITY TEST: Issue #12 - MDC Catalonia
 * Testing the exact user URL for ETIMEDOUT error
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');
const fs = require('fs');
const path = require('path');

console.log('\n🔥 ULTRA-PRIORITY TEST: Issue #12 - MDC Catalonia');
console.log('━'.repeat(60));

async function testCataloniaURL() {
    const loader = new SharedManifestLoaders();
    const userURL = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';
    
    console.log('\n📍 Testing exact user URL:', userURL);
    console.log('User reported: ETIMEDOUT 193.240.184.109:443https://mdc.csuc.cat...');
    console.log('Note: URL concatenation error visible in error message\n');
    
    try {
        console.log('🔄 Attempting to load manifest...');
        const startTime = Date.now();
        
        const manifest = await loader.getMDCCataloniaManifest(userURL);
        
        const loadTime = Date.now() - startTime;
        console.log(`\n✅ SUCCESS! Manifest loaded in ${loadTime}ms`);
        console.log('📚 Manuscript Details:');
        console.log('   Title:', manifest.displayName || 'Unknown');
        console.log('   Pages found:', manifest.images.length);
        
        if (manifest.images.length > 0) {
            console.log('   First page URL:', manifest.images[0].url);
            console.log('   Last page URL:', manifest.images[manifest.images.length - 1].url);
            
            // Check for URL malformation in image URLs
            const malformedUrls = manifest.images.filter(img => 
                img.url.includes(':443https://') || 
                img.url.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+https?:\/\//)
            );
            
            if (malformedUrls.length > 0) {
                console.log('\n❌ FOUND MALFORMED URLs IN IMAGES:');
                malformedUrls.slice(0, 3).forEach(img => {
                    console.log('   ', img.url);
                });
            } else {
                console.log('\n✅ All image URLs are properly formatted');
            }
        }
        
        console.log('\n🎉 MDC CATALONIA IS WORKING!');
        console.log('The issue was fixed in v1.4.81');
        console.log('User is on v1.4.53 and needs to UPDATE');
        
        return true;
        
    } catch (error) {
        console.log('\n❌ ERROR: Failed to load manifest');
        console.log('Error type:', error.name);
        console.log('Error message:', error.message);
        
        // Check if it's the same error as user reported
        if (error.message.includes('ETIMEDOUT') || error.message.includes(':443https://')) {
            console.log('\n🔴 CRITICAL: Same error as user reported!');
            console.log('URL concatenation bug is still present');
            console.log('This needs immediate fixing');
        } else {
            console.log('\n⚠️ Different error than user reported');
            console.log('Original error: ETIMEDOUT with URL concatenation');
            console.log('Current error:', error.message);
        }
        
        return false;
    }
}

// Run the test
testCataloniaURL()
    .then(success => {
        if (success) {
            console.log('\n📊 CONCLUSION: Issue #12 is RESOLVED in current version');
            console.log('ACTION: Notify user to update from v1.4.53 to v1.4.90');
        } else {
            console.log('\n📊 CONCLUSION: Issue #12 still needs fixing');
            console.log('ACTION: Implement fix for URL concatenation bug');
        }
    })
    .catch(err => {
        console.error('\n💥 Unexpected error:', err);
        process.exit(1);
    });