#!/usr/bin/env node

/**
 * Test all library loaders after refactor fix
 * Tests a sample URL from each library to ensure no more broken methods
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

const TEST_URLS = [
    { library: 'vatican', url: 'https://digi.vatlib.it/view/MSS_Vat.lat.1' },
    { library: 'gallica', url: 'https://gallica.bnf.fr/ark:/12148/btv1b84539771' },
    { library: 'bl', url: 'https://www.bl.uk/manuscripts/Viewer.aspx?ref=add_ms_10289_fs001r' },
    { library: 'cambridge', url: 'https://cudl.lib.cam.ac.uk/view/MS-II-00006-00032/1' },
    { library: 'morgan', url: 'https://www.themorgan.org/manuscript/77322' },
    { library: 'munich', url: 'https://mdz-nbn-resolving.de/details:bsb00075074' },
    { library: 'bodleian', url: 'https://digital.bodleian.ox.ac.uk/objects/ae9f6cca-ae5c-4149-8fe4-95e6eca1f73c/' },
    { library: 'heidelberg', url: 'https://digi.ub.uni-heidelberg.de/diglit/cpg311/0001' },
    { library: 'graz', url: 'https://sosa2.uni-graz.at/sosa/katalog/katalogisate/45019' },
    { library: 'cecilia', url: 'https://media.santacecilia.it/books/BNCR_SALA_MIAN_10#/sthash.zSdvyGQp.dpbs' },
    { library: 'grenoble', url: 'https://pagella.bm-grenoble.fr/BMG/doc/SYRACUSE/962590/ms-502-res' }
];

async function testLibrary(library, url) {
    const loaders = new SharedManifestLoaders();
    try {
        console.log(`\n[${library.toUpperCase()}] Testing ${url}...`);
        const manifest = await loaders.getManifestForLibrary(library, url);
        
        if (!manifest) {
            throw new Error('No manifest returned');
        }
        
        // Check for basic manifest structure
        const pageCount = manifest.images?.length || manifest.pageCount || 0;
        const hasLabel = manifest.label || manifest.displayName;
        
        console.log(`✅ ${library}: SUCCESS - ${pageCount} pages, label: "${hasLabel}"`);
        
        // Show sample image URL if available
        if (manifest.images && manifest.images[0]) {
            console.log(`   Sample image: ${manifest.images[0].url.substring(0, 100)}...`);
        }
        
        return { library, status: 'success', pageCount, label: hasLabel };
    } catch (error) {
        console.error(`❌ ${library}: FAILED - ${error.message}`);
        return { library, status: 'failed', error: error.message };
    }
}

async function testAllLibraries() {
    console.log('Testing all library loaders after refactor fix...');
    console.log('================================================');
    
    const results = [];
    
    // Test sequentially to avoid overwhelming servers
    for (const { library, url } of TEST_URLS) {
        const result = await testLibrary(library, url);
        results.push(result);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Summary
    console.log('\n\n=== TEST SUMMARY ===');
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');
    
    console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
    successful.forEach(r => {
        console.log(`   - ${r.library}: ${r.pageCount} pages`);
    });
    
    if (failed.length > 0) {
        console.log(`\n❌ Failed: ${failed.length}/${results.length}`);
        failed.forEach(r => {
            console.log(`   - ${r.library}: ${r.error}`);
        });
    }
    
    // Overall status
    const allPassed = failed.length === 0;
    console.log(`\n${allPassed ? '🎉 ALL TESTS PASSED!' : '⚠️ SOME TESTS FAILED'}`);
    
    process.exit(allPassed ? 0 : 1);
}

// Run tests
testAllLibraries().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});