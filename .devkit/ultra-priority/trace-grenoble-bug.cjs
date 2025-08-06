#!/usr/bin/env node

/**
 * ULTRA-PRIORITY Issue #13 - Deep trace of URL concatenation bug
 * This test will trace EXACTLY where the URL gets malformed
 */

const https = require('https');

// Monkey-patch https.request to see what's being passed
const originalRequest = https.request;
https.request = function(options, callback) {
    console.log('\n🔍 HTTPS.REQUEST INTERCEPTED:');
    console.log('  hostname:', options.hostname);
    console.log('  path:', options.path);
    console.log('  full options:', JSON.stringify({
        hostname: options.hostname,
        path: options.path,
        method: options.method
    }, null, 2));
    
    // Check if hostname is malformed
    if (options.hostname && options.hostname.includes('https://')) {
        console.log('');
        console.log('🚨🚨🚨 CRITICAL BUG FOUND! 🚨🚨🚨');
        console.log('  Malformed hostname being passed to https.request!');
        console.log('  This will cause DNS error: getaddrinfo EAI_AGAIN');
        console.log('');
        console.trace('Stack trace at point of error');
        process.exit(1);
    }
    
    return originalRequest.call(this, options, callback);
};

// Now load the production code
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function traceGrenobleUrl() {
    console.log('🔥 ULTRA-DEEP TRACE: Issue #13 - Finding URL Concatenation Point');
    console.log('━'.repeat(60));
    
    const loaders = new SharedManifestLoaders();
    const userURL = 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';
    
    console.log('📍 Testing exact user URL:', userURL);
    console.log('');
    
    // First, let's see what getGrenobleManifest does
    console.log('Step 1: Calling getGrenobleManifest directly...');
    
    try {
        // Monkey-patch the fetchWithRetry to trace calls
        const originalFetch = loaders.fetchWithRetry.bind(loaders);
        loaders.fetchWithRetry = async function(url, ...args) {
            console.log('\n📡 fetchWithRetry called with URL:', url);
            console.log('  URL type:', typeof url);
            console.log('  URL length:', url.length);
            
            // Check if URL is malformed
            if (url.includes('.frhttps://')) {
                console.log('  ⚠️  URL contains .frhttps:// pattern!');
            }
            
            return originalFetch(url, ...args);
        };
        
        const result = await loaders.getGrenobleManifest(userURL);
        
        console.log('\n✅ SUCCESS: Manifest loaded!');
        console.log('  Pages found:', result.images?.length || 0);
        
    } catch (error) {
        console.log('\n❌ ERROR CAUGHT:');
        console.log('  Type:', error.code || 'Unknown');
        console.log('  Message:', error.message);
        console.log('');
        
        // Check error message for the malformed URL
        if (error.message.includes('pagella.bm-grenoble.frhttps://')) {
            console.log('🔍 FOUND THE BUG!');
            console.log('  The URL is being concatenated somewhere in the flow');
            console.log('  Error contains malformed hostname+URL');
        }
        
        console.log('\nFull stack trace:');
        console.log(error.stack);
    }
}

// Also test the sanitizeUrl function directly
function testSanitizeUrl() {
    console.log('\n' + '='.repeat(60));
    console.log('Testing sanitizeUrl function directly:');
    console.log('='.repeat(60));
    
    const loaders = new SharedManifestLoaders();
    
    const testCases = [
        'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
        'pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
        'pagella.bm-grenoble.fr https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
    ];
    
    for (const testUrl of testCases) {
        console.log('\nTest input:', testUrl);
        const sanitized = loaders.sanitizeUrl(testUrl);
        console.log('Sanitized output:', sanitized);
        console.log('Changed?', testUrl !== sanitized ? 'YES ✅' : 'NO ❌');
    }
}

// Run the tests
console.log('Starting ULTRA-DEEP trace...\n');
testSanitizeUrl();
console.log('\n');
traceGrenobleUrl().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});