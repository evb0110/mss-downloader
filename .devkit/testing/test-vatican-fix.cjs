#!/usr/bin/env node

/**
 * Test Vatican Library and other critical loaders
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testVatican() {
    const loaders = new SharedManifestLoaders();
    const url = 'https://digi.vatlib.it/view/MSS_Vat.lat.1';
    
    try {
        console.log('Testing Vatican Library fix...');
        console.log('URL:', url);
        
        const manifest = await loaders.getManifestForLibrary('vatican', url);
        
        if (!manifest || !manifest.images) {
            throw new Error('No manifest or images returned');
        }
        
        console.log('✅ Vatican Library FIXED!');
        console.log(`   Pages: ${manifest.images.length}`);
        console.log(`   Label: ${manifest.label || manifest.displayName}`);
        console.log(`   First image: ${manifest.images[0].url.substring(0, 100)}...`);
        
        return true;
    } catch (error) {
        console.error('❌ Vatican Library still broken:', error.message);
        return false;
    }
}

async function testOtherLibraries() {
    const loaders = new SharedManifestLoaders();
    
    // Test a few other libraries that should work
    const tests = [
        { library: 'bdl', url: 'https://bibliotecadigital.rah.es/bibliodig/i18n/consulta/registro.cmd?id=40' },
        { library: 'bne', url: 'http://bdh.bne.es/bnesearch/detalle/bdh0000051784' },
        { library: 'bodleian', url: 'https://digital.bodleian.ox.ac.uk/objects/ae9f6cca-ae5c-4149-8fe4-95e6eca1f73c/' },
        { library: 'heidelberg', url: 'https://digi.ub.uni-heidelberg.de/diglit/cpg311/0001' }
    ];
    
    console.log('\nTesting other critical libraries...');
    let allPassed = true;
    
    for (const { library, url } of tests) {
        try {
            console.log(`\nTesting ${library}...`);
            const manifest = await loaders.getManifestForLibrary(library, url);
            const pageCount = manifest.images?.length || manifest.pageCount || 0;
            console.log(`✅ ${library}: ${pageCount} pages`);
        } catch (error) {
            console.error(`❌ ${library}: ${error.message}`);
            allPassed = false;
        }
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return allPassed;
}

async function main() {
    console.log('Testing library loaders after refactor fix...\n');
    
    const vaticanFixed = await testVatican();
    const othersWork = await testOtherLibraries();
    
    console.log('\n========== SUMMARY ==========');
    if (vaticanFixed && othersWork) {
        console.log('🎉 All critical libraries working!');
        process.exit(0);
    } else {
        console.log('⚠️ Some libraries still have issues');
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});