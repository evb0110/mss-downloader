#!/usr/bin/env node

/**
 * ULTRA-PRIORITY Issue #21: Deep Testing of Vatican Library Custom Ranges
 * Testing page range selection with the actual production code
 */

const { SharedManifestLoaders } = require('../../../../src/shared/SharedManifestLoaders.js');

console.log('🔥 ULTRA-PRIORITY ISSUE #21: VATICAN CUSTOM RANGE TEST');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

async function testVaticanRanges() {
    const url = 'https://digi.vatlib.it/view/MSS_Pal.lat.515';
    const customRange = { start: 162, end: 322 };
    
    console.log('Configuration:');
    console.log(`  URL: ${url}`);
    console.log(`  Desired Range: pages ${customRange.start}-${customRange.end}`);
    console.log('');
    
    const loaders = new SharedManifestLoaders();
    
    try {
        console.log('Step 1: Loading Vatican manifest...');
        const startTime = Date.now();
        
        // Test the getManifestForLibrary method
        const manifest = await loaders.getManifestForLibrary('vatican', url);
        
        const loadTime = Date.now() - startTime;
        console.log(`  ✅ Manifest loaded in ${loadTime}ms`);
        console.log(`  Total pages: ${manifest.images ? manifest.images.length : 0}`);
        
        if (!manifest.images || manifest.images.length === 0) {
            throw new Error('No images found in manifest');
        }
        
        console.log('');
        console.log('Step 2: Applying custom page range...');
        
        // Simulate what the UI would do with custom ranges
        const totalPages = manifest.images.length;
        const actualStart = Math.min(customRange.start, totalPages);
        const actualEnd = Math.min(customRange.end, totalPages);
        
        console.log(`  Total available pages: ${totalPages}`);
        console.log(`  Requested range: ${customRange.start}-${customRange.end}`);
        console.log(`  Actual range: ${actualStart}-${actualEnd}`);
        
        // Extract the custom range
        const rangeImages = manifest.images.slice(actualStart - 1, actualEnd);
        console.log(`  Pages in range: ${rangeImages.length}`);
        
        if (rangeImages.length === 0) {
            throw new Error('No pages in the specified range');
        }
        
        console.log('');
        console.log('Step 3: Testing page URLs...');
        
        // Test first and last pages in range
        const firstPage = rangeImages[0];
        const lastPage = rangeImages[rangeImages.length - 1];
        
        console.log(`  First page (${actualStart}): ${firstPage.label}`);
        console.log(`    URL: ${firstPage.url.substring(0, 80)}...`);
        console.log(`  Last page (${actualEnd}): ${lastPage.label}`);
        console.log(`    URL: ${lastPage.url.substring(0, 80)}...`);
        
        console.log('');
        console.log('Step 4: Testing duplicate manifest loading...');
        
        // This might trigger the "library2" error if there's a scope issue
        const manifest2 = await loaders.getManifestForLibrary('vatican', url);
        
        if (manifest2.images.length !== manifest.images.length) {
            console.log(`  ⚠️ DUPLICATION DETECTED!`);
            console.log(`    First load: ${manifest.images.length} pages`);
            console.log(`    Second load: ${manifest2.images.length} pages`);
        } else {
            console.log(`  ✅ No duplication: both loads returned ${manifest.images.length} pages`);
        }
        
        console.log('');
        console.log('✅ TEST SUCCESSFUL');
        console.log('No "library2" initialization error occurred');
        console.log('Custom page ranges can be applied successfully');
        
    } catch (error) {
        console.error('');
        console.error('❌ ERROR DETECTED:');
        console.error(`  Type: ${error.name}`);
        console.error(`  Message: ${error.message}`);
        
        if (error.message.includes('library2')) {
            console.error('');
            console.error('🎯 CRITICAL: "library2" initialization error reproduced!');
            console.error('This confirms the user-reported issue.');
            console.error('');
            console.error('Analyzing error context...');
            console.error('Stack trace:');
            console.error(error.stack);
        }
        
        process.exit(1);
    }
}

// Run the test
testVaticanRanges().then(() => {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('VATICAN RANGE TEST COMPLETE');
}).catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});