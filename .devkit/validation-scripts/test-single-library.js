#!/usr/bin/env node

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testLibrary(libraryName, libraryId, url) {
    console.log(`\nTesting ${libraryName}...`);
    console.log(`URL: ${url}`);
    
    const loader = new SharedManifestLoaders();
    
    try {
        const startTime = Date.now();
        const manifest = await loader.getManifestForLibrary(libraryId, url);
        const duration = Date.now() - startTime;
        
        if (!manifest || !manifest.images || manifest.images.length === 0) {
            console.log(`❌ FAILED: No images found`);
            return false;
        }
        
        console.log(`✅ SUCCESS: Found ${manifest.images.length} pages (${(duration/1000).toFixed(2)}s)`);
        
        // Test downloading first page only
        console.log(`Testing first page URL: ${manifest.images[0].url}`);
        
        return true;
    } catch (error) {
        console.log(`❌ FAILED: ${error.message}`);
        return false;
    }
}

async function runTests() {
    const tests = [
        { name: 'Graz UniPub', id: 'graz', url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538' },
        { name: 'Graz GAMS', id: 'gams', url: 'https://gams.uni-graz.at/context:corema.a1' },
        { name: 'Verona', id: 'verona', url: 'https://www.nuovabibliotecamanoscritta.it/Generale/manoscritto/scheda/id/1093' },
        { name: 'Morgan', id: 'morgan', url: 'https://www.themorgan.org/manuscript/76854' },
        { name: 'Florence', id: 'florence', url: 'https://www.bmlonline.it/s/itBMLO0000000000/item/174871' },
        { name: 'Bordeaux', id: 'bordeaux', url: 'https://bvmm.irht.cnrs.fr/consult/consult.php?REPRODUCTION_ID=11556' }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        const result = await testLibrary(test.name, test.id, test.url);
        if (result) passed++;
        else failed++;
    }
    
    console.log(`\n========== SUMMARY ==========`);
    console.log(`Total: ${tests.length}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);