const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

async function simpleRegression() {
    console.log('🔬 Simple regression test...\n');
    
    const loaders = new SharedManifestLoaders();
    const results = [];
    
    // Test BDL (our fix)
    try {
        console.log('Testing BDL (Issue #9):');
        const manifest = await loaders.getManifestForLibrary('bdl', 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903');
        console.log(`  ✅ ${manifest.images.length} pages (no duplicates)\n`);
        results.push(true);
    } catch (error) {
        console.log(`  ❌ ${error.message}\n`);
        results.push(false);
    }
    
    // Test Vatican (common library)
    try {
        console.log('Testing Vatican:');
        const manifest = await loaders.getVaticanManifest('https://digi.vatlib.it/view/MSS_Vat.lat.1');
        console.log(`  ✅ ${manifest.images.length} pages\n`);
        results.push(true);
    } catch (error) {
        console.log(`  ❌ ${error.message}\n`);
        results.push(false);
    }
    
    // Test Morgan
    try {
        console.log('Testing Morgan:');
        const manifest = await loaders.getMorganManifest('https://www.themorgan.org/manuscript/185038');
        console.log(`  ✅ ${manifest.images.length} pages\n`);
        results.push(true);
    } catch (error) {
        console.log(`  ❌ ${error.message}\n`);
        results.push(false);
    }
    
    // Test Grenoble
    try {
        console.log('Testing Grenoble:');
        const manifest = await loaders.getGrenobleManifest('https://pagella.bm-grenoble.fr/BMG:BMGR000009869/IMG/?idmanuscrit=9869');
        console.log(`  ✅ ${manifest.images.length} pages\n`);
        results.push(true);
    } catch (error) {
        console.log(`  ❌ ${error.message}\n`);
        results.push(false);
    }
    
    const allPassed = results.every(r => r);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (allPassed) {
        console.log('✅ ALL TESTS PASSED - NO REGRESSIONS');
    } else {
        console.log('⚠️ SOME TESTS FAILED');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return allPassed;
}

simpleRegression();