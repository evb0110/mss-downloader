const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

// Libraries mentioned in the error logs
const librariesToTest = {
    // From logs - should work
    loc: 'https://www.loc.gov/item/2023698924/',
    
    // From logs - had errors  
    verona: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
    graz: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
    
    // Test a few more critical ones
    grenoble: 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b8452250v',
    karlsruhe: 'https://digital.blb-karlsruhe.de/urn/urn:nbn:de:bsz:31-83476/titleinfo/4299854',
    bne: 'https://bdh-rd.bne.es/viewer.vm?id=0000008456',
    florence: 'https://teca.bmlonline.it/digital/collection/plutei/id/263'
};

async function testLibrary(libraryId, url) {
    const loader = new SharedManifestLoaders();
    console.log(`\nTesting ${libraryId.toUpperCase()}...`);
    console.log(`URL: ${url}`);
    
    try {
        const startTime = Date.now();
        const manifest = await loader.getManifestForLibrary(libraryId, url);
        const loadTime = Date.now() - startTime;
        
        console.log(`✅ SUCCESS - Loaded in ${loadTime}ms`);
        console.log(`   Display Name: ${manifest.displayName || 'N/A'}`);
        console.log(`   Pages: ${manifest.images ? manifest.images.length : 0}`);
        if (manifest.images && manifest.images.length > 0) {
            console.log(`   First image URL: ${manifest.images[0].url}`);
        }
        
        return { success: true, error: null };
    } catch (error) {
        console.log(`❌ FAILED - ${error.message}`);
        console.log(`   Error type: ${error.constructor.name}`);
        if (error.stack) {
            const stackLines = error.stack.split('\n').slice(1, 3);
            console.log(`   Location: ${stackLines.join('\n   ')}`);
        }
        
        return { success: false, error: error.message };
    }
}

async function runTests() {
    console.log('Testing libraries from error logs...');
    
    const results = {};
    
    for (const [libraryId, url] of Object.entries(librariesToTest)) {
        results[libraryId] = await testLibrary(libraryId, url);
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Summary
    console.log('\n=== SUMMARY ===');
    const working = Object.entries(results).filter(([_, r]) => r.success);
    const failing = Object.entries(results).filter(([_, r]) => !r.success);
    
    console.log(`\nWORKING: ${working.length}/${Object.keys(results).length}`);
    working.forEach(([lib, _]) => console.log(`  ✅ ${lib}`));
    
    console.log(`\nFAILING: ${failing.length}/${Object.keys(results).length}`);
    failing.forEach(([lib, r]) => console.log(`  ❌ ${lib} - ${r.error}`));
}

runTests().catch(console.error);