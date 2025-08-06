#!/usr/bin/env node

/**
 * ULTRA-PRIORITY TEST: Verify fix for Issue #13 - Grenoble URL concatenation
 * Tests with multiple URL variations to ensure comprehensive fix
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

async function testGrenobleFixComprehensively() {
    console.log('🔥 ULTRA-PRIORITY FIX VALIDATION TEST 🔥');
    console.log('=' .repeat(60));
    
    const loaders = new SharedManifestLoaders();
    
    // Test cases covering all possible malformation patterns
    const testCases = [
        {
            name: 'Normal Grenoble URL',
            url: 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
            shouldWork: true
        },
        {
            name: 'Malformed URL (hostname concatenated)',
            url: 'pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
            shouldWork: true // Should be auto-fixed
        },
        {
            name: 'Malformed URL (.fr pattern)',
            url: 'pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k',
            shouldWork: true // Should be auto-fixed
        },
        {
            name: 'Malformed URL (no protocol separator)',
            url: 'pagella.bm-grenoble.frhttpspagella.bm-grenoble.fr/ark:/12148/btv1b10663927k',
            shouldWork: false // Too malformed to fix
        }
    ];
    
    let passedTests = 0;
    let failedTests = 0;
    
    for (const testCase of testCases) {
        console.log(`\n${'-'.repeat(60)}`);
        console.log(`Testing: ${testCase.name}`);
        console.log(`URL: ${testCase.url}`);
        console.log(`Expected: ${testCase.shouldWork ? 'SUCCESS' : 'FAILURE'}`);
        
        try {
            // Test URL sanitization
            const sanitized = loaders.sanitizeUrl(testCase.url);
            console.log(`Sanitized: ${sanitized}`);
            
            // Test library recognition
            const library = loaders.recognizeLibrary(sanitized);
            console.log(`Library: ${library}`);
            
            if (library === 'grenoble') {
                console.log(`✅ PASS: Library correctly recognized`);
                
                // Try to get manifest (just the start)
                console.log('Attempting manifest fetch...');
                const manifest = await loaders.getManifest(sanitized);
                
                if (manifest && manifest.images) {
                    console.log(`✅ PASS: Manifest fetched, ${manifest.images.length} pages found`);
                    passedTests++;
                } else {
                    console.log(`❌ FAIL: No manifest data`);
                    failedTests++;
                }
            } else if (testCase.shouldWork) {
                console.log(`❌ FAIL: Library not recognized (got: ${library})`);
                failedTests++;
            } else {
                console.log(`✅ PASS: Correctly failed as expected`);
                passedTests++;
            }
        } catch (error) {
            if (testCase.shouldWork) {
                console.error(`❌ FAIL: ${error.message}`);
                failedTests++;
            } else {
                console.log(`✅ PASS: Correctly failed with error: ${error.message}`);
                passedTests++;
            }
        }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('TEST RESULTS:');
    console.log(`✅ Passed: ${passedTests}/${testCases.length}`);
    console.log(`❌ Failed: ${failedTests}/${testCases.length}`);
    
    if (failedTests === 0) {
        console.log('\n🎉 ALL TESTS PASSED! Fix is working correctly.');
    } else {
        console.log('\n⚠️ Some tests failed. Additional fixes may be needed.');
    }
    
    // Additional stress test with parallel requests
    console.log(`\n${'='.repeat(60)}`);
    console.log('STRESS TEST: Testing parallel requests...');
    
    const normalUrl = 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
        promises.push(
            loaders.getManifest(normalUrl)
                .then(() => ({ success: true, index: i }))
                .catch(err => ({ success: false, index: i, error: err.message }))
        );
    }
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    
    console.log(`Parallel requests: ${successCount}/5 successful`);
    
    if (successCount === 5) {
        console.log('✅ All parallel requests succeeded!');
    } else {
        console.log('⚠️ Some parallel requests failed:');
        results.filter(r => !r.success).forEach(r => {
            console.log(`  - Request ${r.index}: ${r.error}`);
        });
    }
}

// Run the test
testGrenobleFixComprehensively().catch(console.error);