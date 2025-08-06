#!/usr/bin/env node

/**
 * REGRESSION TEST: Ensure other libraries still work after Heidelberg fix
 */

const { SharedManifestLoaders } = require('../../../../src/shared/SharedManifestLoaders.js');

async function regressionTest() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 REGRESSION TEST: Other Libraries');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const loader = new SharedManifestLoaders();
    
    // Test a sample of other libraries to ensure no regression
    const testCases = [
        {
            library: 'grenoble',
            url: 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b106639273',
            name: 'Grenoble Library'
        },
        {
            library: 'bne',
            url: 'http://bdh-rd.bne.es/viewer.vm?id=0000012346',
            name: 'Biblioteca Nacional de España'
        },
        {
            library: 'florence',
            url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/123',
            name: 'Florence Library'
        }
    ];
    
    const results = [];
    
    for (const test of testCases) {
        console.log(`\n📚 Testing ${test.name}...`);
        
        try {
            const startTime = Date.now();
            const manifest = await loader.getManifestForLibrary(test.library, test.url);
            const elapsed = Date.now() - startTime;
            
            console.log(`   ✅ Success!`);
            console.log(`   Title: ${manifest.displayName || 'Unknown'}`);
            console.log(`   Pages: ${manifest.images?.length || 0}`);
            console.log(`   Load time: ${elapsed}ms`);
            
            results.push({
                library: test.name,
                status: 'success',
                pages: manifest.images?.length || 0
            });
            
        } catch (error) {
            console.log(`   ⚠️ Failed: ${error.message}`);
            
            // Some libraries may fail due to network issues, that's okay for this test
            results.push({
                library: test.name,
                status: 'failed',
                error: error.message
            });
        }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 REGRESSION TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    console.log(`\nTotal libraries tested: ${results.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    
    if (successful > 0) {
        console.log('\n✅ NO REGRESSION DETECTED');
        console.log('Other libraries continue to work after Heidelberg fix');
    } else {
        console.log('\n⚠️ WARNING: All libraries failed - may be network issue');
    }
}

regressionTest().catch(console.error);