const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

async function regressionTest() {
    console.log('🔬 Testing regression on other libraries...\n');
    
    const loaders = new SharedManifestLoaders();
    
    const testCases = [
        { 
            name: 'BNE (Spain)', 
            url: 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
            method: 'loadBneManifest'
        },
        { 
            name: 'Bordeaux', 
            url: 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778',
            method: 'getBordeauxManifest'
        },
        { 
            name: 'Morgan Library', 
            url: 'https://www.themorgan.org/manuscript/185038',
            method: 'getMorganManifest'
        },
        {
            name: 'Vatican',
            url: 'https://digi.vatlib.it/view/MSS_Vat.lat.1',
            method: 'getVaticanManifest'
        }
    ];
    
    let allPassed = true;
    
    for (const test of testCases) {
        try {
            process.stdout.write(`Testing ${test.name}: `);
            const startTime = Date.now();
            
            // Try to detect library and load manifest
            const libraryId = await loaders.detectLibrary(test.url);
            const manifest = await loaders.getManifestForLibrary(libraryId, test.url);
            
            const loadTime = Date.now() - startTime;
            
            if (manifest && manifest.images && manifest.images.length > 0) {
                console.log(`✅ ${manifest.images.length} pages loaded in ${loadTime}ms`);
            } else {
                console.log(`⚠️ No images found`);
                allPassed = false;
            }
        } catch (error) {
            console.log(`❌ ${error.message}`);
            allPassed = false;
        }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (allPassed) {
        console.log('✅ REGRESSION TEST: ALL LIBRARIES WORKING');
    } else {
        console.log('⚠️ REGRESSION TEST: SOME LIBRARIES NEED ATTENTION');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return allPassed;
}

regressionTest().then(passed => {
    process.exit(passed ? 0 : 1);
});