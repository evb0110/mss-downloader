#!/usr/bin/env node

/**
 * ULTRA-PRIORITY Issue #13 - Reproduce EXACT error message
 */

const dns = require('dns');
const https = require('https');

console.log('🔥 REPRODUCING EXACT ERROR MESSAGE');
console.log('━'.repeat(60));

// Test 1: Try to reproduce the exact error format
console.log('\nTest 1: DNS lookup with malformed hostname');
const malformedHostname = 'pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';

dns.lookup(malformedHostname, (err, address) => {
    if (err) {
        console.log('DNS Error:', err.message);
        console.log('Error code:', err.code);
        console.log('Hostname in error:', err.hostname);
        
        if (err.message.includes('pagella.bm-grenoble.frhttps://')) {
            console.log('✅ REPRODUCED: Error message contains concatenated string!');
        }
    } else {
        console.log('Unexpectedly resolved to:', address);
    }
});

// Test 2: Try with https.request
setTimeout(() => {
    console.log('\nTest 2: HTTPS request with malformed hostname in options');
    
    try {
        const req = https.request({
            hostname: malformedHostname,
            path: '/',
            method: 'GET'
        }, (res) => {
            console.log('Unexpected success');
        });
        
        req.on('error', (err) => {
            console.log('HTTPS Error:', err.message);
            console.log('Error code:', err.code);
            
            if (err.message.includes('pagella.bm-grenoble.frhttps://')) {
                console.log('✅ REPRODUCED via https.request!');
            }
        });
        
        req.end();
    } catch (err) {
        console.log('Caught error:', err.message);
    }
}, 1000);

// Test 3: Check how Node formats the error
setTimeout(() => {
    console.log('\nTest 3: Checking Node.js error formatting');
    
    // Simulate what happens in SharedManifestLoaders
    const url = 'pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';
    
    // Try to create URL object
    try {
        const urlObj = new URL(url);
        console.log('URL parsed successfully (unexpected)');
        console.log('  hostname:', urlObj.hostname);
    } catch (err) {
        console.log('URL parsing error:', err.message);
        
        // This is what might happen if URL parsing fails but code continues
        // and tries to use the original string as hostname
        const fallbackHostname = url.split('/')[0];
        console.log('Fallback hostname extraction:', fallbackHostname);
        
        if (fallbackHostname === malformedHostname) {
            console.log('⚠️  This could lead to the malformed hostname being used!');
        }
    }
}, 2000);

// Test 4: Check if the issue is in URL vs hostname confusion
setTimeout(() => {
    console.log('\nTest 4: Testing URL/hostname confusion');
    
    const testUrl = 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';
    
    // What if code accidentally passes URL where hostname is expected?
    console.log('If URL is passed as hostname:');
    console.log('  Input:', testUrl);
    console.log('  Would become:', testUrl); // This would fail
    
    // What if hostname and URL are concatenated?
    const hostname = 'pagella.bm-grenoble.fr';
    const accidentalConcat = hostname + testUrl; // Bug scenario
    console.log('\nAccidental concatenation:');
    console.log('  Result:', accidentalConcat);
    
    if (accidentalConcat === malformedHostname) {
        console.log('  ✅ THIS MATCHES THE ERROR PATTERN!');
        console.log('  The bug is: hostname + url concatenation somewhere in the code');
    }
}, 3000);