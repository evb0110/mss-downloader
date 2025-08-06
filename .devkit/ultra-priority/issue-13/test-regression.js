#!/usr/bin/env node

/**
 * REGRESSION TEST: Ensure fix doesn't break other libraries
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

async function testOtherLibraries() {
    console.log('🔥 REGRESSION TEST - OTHER LIBRARIES 🔥\n');
    
    const loaders = new SharedManifestLoaders();
    
    const testLibraries = [
        {
            name: 'Vatican',
            url: 'https://digi.vatlib.it/view/MSS_Vat.lat.3225',
            method: 'getVaticanManifest'
        },
        {
            name: 'Munich',
            url: 'https://www.digitale-sammlungen.de/view/bsb00003409?page=5',
            method: 'getMunichManifest'  
        },
        {
            name: 'Gallica BNF',
            url: 'https://gallica.bnf.fr/ark:/12148/btv1b8449691v/f1.highres',
            method: 'getManifestForLibrary',
            libraryId: 'gallica'
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of testLibraries) {
        console.log(`Testing ${test.name}...`);
        console.log(`URL: ${test.url}`);
        
        try {
            let manifest;
            if (test.libraryId) {
                manifest = await loaders[test.method](test.libraryId, test.url);
            } else {
                manifest = await loaders[test.method](test.url);
            }
            
            if (manifest && manifest.images && manifest.images.length > 0) {
                console.log(`✅ SUCCESS: ${manifest.images.length} pages found`);
                passed++;
            } else {
                console.log(`❌ FAIL: No pages found`);
                failed++;
            }
        } catch (error) {
            console.error(`❌ ERROR: ${error.message}`);
            failed++;
        }
        
        console.log('-'.repeat(60));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('REGRESSION TEST RESULTS:');
    console.log(`✅ Passed: ${passed}/${testLibraries.length}`);
    console.log(`❌ Failed: ${failed}/${testLibraries.length}`);
    
    if (failed === 0) {
        console.log('\n🎉 NO REGRESSIONS! All libraries working correctly.');
    } else {
        console.log('\n⚠️ Some libraries may have issues.');
    }
}

testOtherLibraries().catch(console.error);