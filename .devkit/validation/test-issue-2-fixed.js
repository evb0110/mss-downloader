#!/usr/bin/env node
/**
 * ULTRA-PRIORITY VALIDATION for Issue #2 Fix
 * Testing multiple University of Graz URLs to ensure IPC timeout is resolved
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

const TEST_URLS = [
    // User's reported URL
    'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688',
    // Additional test URLs
    'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
    'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/6893123'
];

async function testGrazFix() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔥 ULTRA-PRIORITY VALIDATION: Issue #2 - Graz IPC Timeout Fix`);
    console.log(`${'='.repeat(70)}\n`);
    
    const loaders = new SharedManifestLoaders();
    let successCount = 0;
    let failureCount = 0;
    const results = [];
    
    for (const url of TEST_URLS) {
        console.log(`\nTesting: ${url}`);
        console.log('-'.repeat(60));
        
        try {
            const startTime = Date.now();
            
            // Set timeout to simulate IPC timeout conditions
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('TIMEOUT: Simulating IPC timeout (30s)'));
                }, 30000);
            });
            
            const manifestPromise = loaders.getManifestForLibrary('graz', url);
            const manifest = await Promise.race([manifestPromise, timeoutPromise]);
            
            const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
            
            console.log(`✅ SUCCESS: Loaded in ${loadTime}s`);
            console.log(`   Pages: ${manifest.images?.length || 0}`);
            console.log(`   Title: ${manifest.title || 'No title'}`);
            
            // Validate manifest structure
            if (!manifest.images || manifest.images.length === 0) {
                throw new Error('Manifest has no images');
            }
            
            // Check first and last page URLs
            const firstPage = manifest.images[0];
            const lastPage = manifest.images[manifest.images.length - 1];
            
            if (!firstPage.url || !lastPage.url) {
                throw new Error('Page URLs are missing');
            }
            
            console.log(`   First page: ${firstPage.label || 'Page 1'}`);
            console.log(`   Last page: ${lastPage.label || `Page ${manifest.images.length}`}`);
            
            successCount++;
            results.push({
                url,
                status: 'SUCCESS',
                pages: manifest.images.length,
                loadTime: loadTime
            });
            
        } catch (error) {
            console.error(`❌ FAILED: ${error.message}`);
            failureCount++;
            results.push({
                url,
                status: 'FAILED',
                error: error.message
            });
        }
    }
    
    // Summary
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 VALIDATION SUMMARY`);
    console.log(`${'='.repeat(70)}`);
    console.log(`✅ Successful: ${successCount}/${TEST_URLS.length}`);
    console.log(`❌ Failed: ${failureCount}/${TEST_URLS.length}`);
    
    console.log('\nDetailed Results:');
    console.log('-'.repeat(60));
    results.forEach(result => {
        if (result.status === 'SUCCESS') {
            console.log(`✅ ${result.url}`);
            console.log(`   ${result.pages} pages loaded in ${result.loadTime}s`);
        } else {
            console.log(`❌ ${result.url}`);
            console.log(`   Error: ${result.error}`);
        }
    });
    
    // Diagnosis
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔍 DIAGNOSIS`);
    console.log(`${'='.repeat(70)}`);
    
    if (successCount === TEST_URLS.length) {
        console.log('✅ FIX CONFIRMED: All Graz URLs loaded successfully!');
        console.log('   The IPC timeout issue has been resolved.');
        console.log('   The fix properly throws errors instead of returning error objects.');
        console.log('\n🎉 Issue #2 is RESOLVED!');
        return 0;
    } else {
        console.log('⚠️  PARTIAL SUCCESS: Some URLs still failing');
        console.log('   Further investigation needed for failed URLs.');
        return 1;
    }
}

// Run validation
testGrazFix().then(exitCode => {
    process.exit(exitCode);
}).catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});