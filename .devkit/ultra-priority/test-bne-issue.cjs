#!/usr/bin/env node

/**
 * ULTRA-PRIORITY Test Script for Issue #11 - BNE hanging
 * URL: https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1
 * This test uses ACTUAL production code to reproduce the issue
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testBNEIssue() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔬 ULTRA-DEEP BNE ISSUE REPRODUCTION TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Issue #11: висит на калькуляции (hanging on calculation)');
    console.log('URL: https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1');
    console.log('Previous fix attempts: 6\n');
    
    const loader = new SharedManifestLoaders();
    const url = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    
    console.log('Starting test with timeout monitoring...');
    console.log('If this hangs, we\'ll know where the problem is.\n');
    
    const startTime = Date.now();
    let lastLogTime = startTime;
    
    // Monitor progress every 2 seconds
    const monitor = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        console.log(`⏱️  Still running... ${elapsed} seconds elapsed`);
        
        if (elapsed > 30) {
            console.error('❌ TEST HANGING - Process has been running for over 30 seconds!');
            console.error('This confirms the user\'s report - the process hangs.');
            clearInterval(monitor);
            process.exit(1);
        }
    }, 2000);
    
    try {
        console.log('Calling getBNEManifest...');
        const result = await loader.getBNEManifest(url);
        
        clearInterval(monitor);
        const totalTime = Date.now() - startTime;
        
        console.log(`\n✅ getBNEManifest completed in ${totalTime}ms`);
        console.log(`Images found: ${result.images ? result.images.length : 0}`);
        
        if (result.images && result.images.length > 0) {
            console.log(`First image URL: ${result.images[0].url}`);
            console.log(`Last image URL: ${result.images[result.images.length - 1].url}`);
            
            // Test if the URLs are actually accessible
            console.log('\nTesting URL accessibility...');
            const testUrl = result.images[0].url;
            console.log(`Testing: ${testUrl}`);
            
            const testStartTime = Date.now();
            try {
                const response = await loader.fetchWithRetry(testUrl, {
                    method: 'HEAD',
                    timeout: 10000
                });
                const testTime = Date.now() - testStartTime;
                console.log(`✅ URL test completed in ${testTime}ms - Status: ${response.status}`);
            } catch (error) {
                console.error(`❌ URL test failed: ${error.message}`);
            }
        }
        
    } catch (error) {
        clearInterval(monitor);
        const totalTime = Date.now() - startTime;
        
        console.error(`\n❌ Error occurred after ${totalTime}ms:`);
        console.error(`Error type: ${error.constructor.name}`);
        console.error(`Error message: ${error.message}`);
        
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        
        process.exit(1);
    }
}

// Run the test
testBNEIssue().catch(error => {
    console.error('Uncaught error:', error);
    process.exit(1);
});