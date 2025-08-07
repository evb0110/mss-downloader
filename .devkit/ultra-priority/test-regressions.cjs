#!/usr/bin/env node

/**
 * Regression test for other libraries after BNE fix
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔬 REGRESSION TEST: Other Libraries');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

const testLibraries = [
    {
        name: 'Vatican',
        url: 'https://digi.vatlib.it/view/MSS_Pal.lat.1071',
        method: 'getVaticanManifest'
    },
    {
        name: 'Morgan',
        url: 'https://www.themorgan.org/collection/Bible-Historiale-of-Guyart-des-Moulins/1',
        method: 'getMorganManifest'
    },
    {
        name: 'Florence',
        url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/1',
        method: 'getFlorenceManifest'
    },
    {
        name: 'Grenoble',
        url: 'https://pagella.bm-grenoble.fr/BMG.html?fn=ViewerSkin&doc=FONDS_VIC/Ms1042/Ms1042',
        method: 'getGrenobleManifest'
    },
    {
        name: 'Manchester',
        url: 'https://luna.manchester.ac.uk/luna/servlet/detail/Manchester~91~1~3315~100113',
        method: 'getManchesterManifest'
    }
];

async function testLibrary(library) {
    const loaders = new SharedManifestLoaders();
    
    console.log(`Testing ${library.name}...`);
    const startTime = Date.now();
    
    try {
        const result = await loaders[library.method](library.url);
        const elapsed = Date.now() - startTime;
        
        const pageCount = result.images ? result.images.length : 
                         result.pageLinks ? result.pageLinks.length : 0;
        
        console.log(`  ✅ Success in ${elapsed}ms - ${pageCount} pages found`);
        return true;
        
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.log(`  ❌ Failed after ${elapsed}ms: ${error.message}`);
        return false;
    }
}

async function runRegressionTests() {
    let successCount = 0;
    let failCount = 0;
    
    for (const library of testLibraries) {
        const success = await testLibrary(library);
        if (success) {
            successCount++;
        } else {
            failCount++;
        }
    }
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 REGRESSION TEST RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Passed: ${successCount}/${testLibraries.length}`);
    console.log(`❌ Failed: ${failCount}/${testLibraries.length}`);
    
    if (failCount === 0) {
        console.log('');
        console.log('🎉 No regressions detected!');
        console.log('All libraries continue to work correctly.');
    } else {
        console.log('');
        console.log('⚠️  WARNING: Some libraries failed!');
        console.log('The BNE fix may have introduced regressions.');
    }
}

runRegressionTests();