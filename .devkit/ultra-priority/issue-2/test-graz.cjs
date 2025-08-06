#!/usr/bin/env node

/**
 * ULTRA-PRIORITY TEST: Issue #2 - University of Graz
 * Testing the exact user URL for infinite loading issue
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');
const fs = require('fs');
const path = require('path');

console.log('\n🔥 ULTRA-PRIORITY TEST: Issue #2 - University of Graz');
console.log('━'.repeat(60));

async function testGrazURL() {
    const loader = new SharedManifestLoaders();
    const userURL = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688';
    
    console.log('\n📍 Testing exact user URL:', userURL);
    console.log('User reported: "бесконечно грузит манифест" (infinitely loading manifest)');
    console.log('User reported: JavaScript errors, "reply was never sent"\n');
    
    console.log('User system info:');
    console.log('- Platform: Windows');
    console.log('- Version: 1.4.61');
    console.log('- Last attempt: 2025-08-02\n');
    
    try {
        console.log('🔄 Attempting to load manifest...');
        const startTime = Date.now();
        
        // Set a reasonable timeout for the test
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT: Manifest loading took more than 30 seconds')), 30000);
        });
        
        const manifestPromise = loader.getGrazManifest(userURL);
        
        const manifest = await Promise.race([manifestPromise, timeoutPromise]);
        
        const loadTime = Date.now() - startTime;
        console.log(`\n✅ SUCCESS! Manifest loaded in ${loadTime}ms`);
        console.log('📚 Manuscript Details:');
        console.log('   Title:', manifest.displayName || 'Unknown');
        console.log('   Pages found:', manifest.images.length);
        
        if (manifest.images.length > 0) {
            console.log('   First page URL:', manifest.images[0].url);
            console.log('   Last page URL:', manifest.images[manifest.images.length - 1].url);
            
            // Check URL format
            const sampleUrl = manifest.images[0].url;
            if (sampleUrl.includes('/webcache/')) {
                console.log('   URL type: Webcache format');
            } else if (sampleUrl.includes('/full/full/')) {
                console.log('   URL type: IIIF format');
            }
        }
        
        console.log('\n🎉 GRAZ IS WORKING IN BACKEND!');
        console.log('The issue might be in the frontend IPC communication');
        
        return true;
        
    } catch (error) {
        console.log('\n❌ ERROR: Failed to load manifest');
        console.log('Error type:', error.name);
        console.log('Error message:', error.message);
        
        if (error.message.includes('TIMEOUT')) {
            console.log('\n🔴 CRITICAL: Same issue as user reported!');
            console.log('Manifest loading is hanging/timing out');
            console.log('This confirms the infinite loading problem');
        } else if (error.message.includes('reply was never sent')) {
            console.log('\n🔴 CRITICAL: IPC communication error!');
            console.log('This is the exact error user reported');
        } else {
            console.log('\n⚠️ Different error than user reported');
            console.log('User error: Infinite loading / timeout');
            console.log('Current error:', error.message);
        }
        
        // Try to fetch the manifest URL directly
        console.log('\n🔍 Debugging: Trying direct manifest fetch...');
        const manuscriptId = userURL.match(/\/(\d+)$/)?.[1];
        if (manuscriptId) {
            const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${manuscriptId}/manifest`;
            console.log('Direct manifest URL:', manifestUrl);
            
            try {
                const https = require('https');
                const testFetch = await new Promise((resolve, reject) => {
                    https.get(manifestUrl, (res) => {
                        if (res.statusCode === 200) {
                            resolve('Server responded with 200 OK');
                        } else {
                            reject(`Server responded with ${res.statusCode}`);
                        }
                    }).on('error', reject);
                });
                console.log('Direct fetch result:', testFetch);
            } catch (fetchErr) {
                console.log('Direct fetch failed:', fetchErr.message);
            }
        }
        
        return false;
    }
}

// Run the test
testGrazURL()
    .then(success => {
        if (success) {
            console.log('\n📊 CONCLUSION: Issue #2 backend works, frontend issue likely');
            console.log('ACTION: Check IPC communication and timeout handling');
        } else {
            console.log('\n📊 CONCLUSION: Issue #2 needs fixing in manifest loader');
            console.log('ACTION: Implement robust timeout and error handling');
        }
    })
    .catch(err => {
        console.error('\n💥 Unexpected error:', err);
        process.exit(1);
    });