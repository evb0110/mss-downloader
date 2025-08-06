#!/usr/bin/env node

/**
 * Test the final fix for Issue #13
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testFix() {
    console.log('🔥 TESTING FINAL FIX FOR ISSUE #13');
    console.log('━'.repeat(60));
    
    const loaders = new SharedManifestLoaders();
    
    // Test cases
    const testCases = [
        {
            name: 'Normal Grenoble URL',
            url: 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
            shouldWork: true
        },
        {
            name: 'Malformed URL (concatenated)',
            url: 'pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
            shouldWork: true // Should be fixed by sanitization
        },
        {
            name: 'Different Grenoble manuscript',
            url: 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10722633d',
            shouldWork: true
        }
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
        console.log(`\n📋 Test: ${testCase.name}`);
        console.log(`   URL: ${testCase.url.slice(0, 80)}...`);
        
        try {
            const result = await loaders.getGrenobleManifest(testCase.url);
            
            if (testCase.shouldWork) {
                console.log(`   ✅ SUCCESS: ${result.images?.length || 0} pages found`);
            } else {
                console.log(`   ❌ UNEXPECTED SUCCESS (should have failed)`);
                allPassed = false;
            }
        } catch (error) {
            if (!testCase.shouldWork) {
                console.log(`   ✅ EXPECTED FAILURE: ${error.message.slice(0, 50)}`);
            } else {
                console.log(`   ❌ FAILED: ${error.message}`);
                
                // Check if it's the concatenation error
                if (error.message.includes('pagella.bm-grenoble.frhttps://')) {
                    console.log('   🚨 URL CONCATENATION BUG STILL PRESENT!');
                }
                allPassed = false;
            }
        }
    }
    
    // Test other libraries for regression
    console.log('\n' + '='.repeat(60));
    console.log('📋 REGRESSION TESTING OTHER LIBRARIES');
    console.log('='.repeat(60));
    
    const otherLibraries = [
        {
            name: 'Vatican',
            url: 'https://digi.vatlib.it/view/MSS_Vat.lat.1',
            method: 'getVaticanManifest'
        },
        {
            name: 'Munich',
            url: 'https://digitale-sammlungen.de/de/view/bsb00087441',
            method: 'getMunichManifest'
        }
    ];
    
    for (const lib of otherLibraries) {
        console.log(`\nTesting ${lib.name}...`);
        
        try {
            const result = await loaders[lib.method](lib.url);
            console.log(`  ✅ ${lib.name}: ${result.images?.length || 0} pages`);
        } catch (error) {
            console.log(`  ❌ ${lib.name} FAILED: ${error.message.slice(0, 50)}`);
            allPassed = false;
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL RESULTS');
    console.log('='.repeat(60));
    
    if (allPassed) {
        console.log('\n✅ ALL TESTS PASSED!');
        console.log('');
        console.log('The fix successfully:');
        console.log('  1. Handles normal Grenoble URLs');
        console.log('  2. Fixes malformed concatenated URLs');
        console.log('  3. Works with multiple Grenoble manuscripts');
        console.log('  4. Does not break other libraries');
        console.log('');
        console.log('🎯 Issue #13 appears to be FIXED!');
    } else {
        console.log('\n❌ SOME TESTS FAILED');
        console.log('The fix needs more work.');
    }
    
    return allPassed ? 0 : 1;
}

// Run test
testFix().then(exitCode => {
    process.exit(exitCode);
}).catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});