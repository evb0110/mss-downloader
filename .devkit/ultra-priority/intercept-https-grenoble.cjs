#!/usr/bin/env node

/**
 * ULTRA-PRIORITY Issue #13 - Intercept HTTPS calls to find the bug
 */

const Module = require('module');
const originalRequire = Module.prototype.require;

// Track all requires to find where https is loaded
const httpsInstances = new Set();

Module.prototype.require = function(id) {
    const result = originalRequire.apply(this, arguments);
    
    if (id === 'https') {
        // Intercept https module
        if (!httpsInstances.has(result)) {
            httpsInstances.add(result);
            
            const originalRequest = result.request;
            result.request = function(options, callback) {
                console.log('\n🔍 HTTPS.REQUEST CALLED:');
                console.log('  typeof options:', typeof options);
                
                if (typeof options === 'string') {
                    console.log('  ⚠️  STRING URL passed:', options);
                    if (options.includes('pagella.bm-grenoble.fr') && options.includes('https://')) {
                        console.log('  🚨 MALFORMED URL DETECTED IN STRING!');
                    }
                } else if (typeof options === 'object') {
                    console.log('  hostname:', options.hostname);
                    console.log('  host:', options.host);
                    console.log('  path:', options.path);
                    
                    if (options.hostname && options.hostname.includes('https://')) {
                        console.log('');
                        console.log('🚨🚨🚨 BUG FOUND! Malformed hostname:', options.hostname);
                        console.log('Stack trace:');
                        console.trace();
                        
                        // Try to fix it
                        const fixedHostname = options.hostname.replace(/https?:\/\/.*$/, '');
                        console.log('  Attempting to fix hostname to:', fixedHostname);
                        options.hostname = fixedHostname;
                    }
                    
                    if (options.host && options.host.includes('https://')) {
                        console.log('');
                        console.log('🚨🚨🚨 BUG FOUND! Malformed host:', options.host);
                    }
                }
                
                return originalRequest.apply(this, arguments);
            };
        }
    }
    
    return result;
};

// Now load and test
console.log('🔥 ULTRA-DEEP HTTPS INTERCEPTION TEST');
console.log('━'.repeat(60));

async function testWithInterception() {
    // Load SharedManifestLoaders AFTER interceptor is set up
    const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
    
    const loaders = new SharedManifestLoaders();
    const userURL = 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';
    
    console.log('\n📍 Testing URL:', userURL);
    
    try {
        const result = await loaders.getGrenobleManifest(userURL);
        console.log('\n✅ Success! Pages found:', result.images?.length);
    } catch (error) {
        console.log('\n❌ Error:', error.message);
        
        // Check if error message contains the concatenated string
        if (error.message.includes('pagella.bm-grenoble.frhttps://')) {
            console.log('\n🔍 Error message contains concatenated hostname+URL');
            console.log('This might be in the error message formatting, not the actual request');
        }
    }
    
    // Test with malformed URL
    console.log('\n' + '='.repeat(60));
    console.log('Testing with intentionally malformed URL:');
    
    const malformedUrl = 'pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';
    
    // Test if fetchUrl handles it
    try {
        console.log('Calling fetchUrl with malformed URL:', malformedUrl);
        const response = await loaders.fetchWithRetry(malformedUrl);
        console.log('Response status:', response.status);
    } catch (error) {
        console.log('Error with malformed URL:', error.message);
    }
}

testWithInterception().catch(console.error);