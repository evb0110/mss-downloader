#!/usr/bin/env node

/**
 * Ultra-Priority Issue #21 Reproduction Script
 * Testing Vatican Library custom page range error
 * URL: https://digi.vatlib.it/view/MSS_Pal.lat.515
 * Error: "Cannot access 'library2' before initialization"
 * Expected: Download pages 162-322 only
 * Actual: Either downloads all or shows error
 */

const { SharedManifestLoaders } = require('../../../../src/shared/SharedManifestLoaders.js');

console.log('🔥 ULTRA-PRIORITY ISSUE #21 REPRODUCTION TEST');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

async function reproduceIssue() {
    const url = 'https://digi.vatlib.it/view/MSS_Pal.lat.515';
    const customRange = { start: 162, end: 322 };
    
    console.log('Test Configuration:');
    console.log(`  URL: ${url}`);
    console.log(`  Custom Range: ${customRange.start}-${customRange.end}`);
    console.log('');
    
    const loaders = new SharedManifestLoaders();
    loaders.userAgent = 'Mozilla/5.0';
    
    try {
        console.log('Step 1: Detecting library...');
        const library = loaders.detectLibrary(url);
        console.log(`  Detected: ${library}`);
        
        if (library !== 'vatican') {
            throw new Error(`Expected 'vatican' but got '${library}'`);
        }
        
        console.log('\nStep 2: Loading manifest...');
        const startTime = Date.now();
        const manifest = await loaders.getManifest(url);
        const loadTime = Date.now() - startTime;
        
        console.log(`  Load time: ${loadTime}ms`);
        console.log(`  Total pages found: ${manifest.images ? manifest.images.length : 0}`);
        
        if (manifest.images && manifest.images.length > 0) {
            console.log(`  First page: ${manifest.images[0].label}`);
            console.log(`  Last page: ${manifest.images[manifest.images.length - 1].label}`);
        }
        
        console.log('\nStep 3: Testing custom range extraction...');
        const rangeImages = manifest.images ? 
            manifest.images.slice(customRange.start - 1, customRange.end) : [];
        
        console.log(`  Pages in custom range: ${rangeImages.length}`);
        console.log(`  Expected: ${customRange.end - customRange.start + 1}`);
        
        if (rangeImages.length > 0) {
            console.log(`  First page in range: ${rangeImages[0].label}`);
            console.log(`  Last page in range: ${rangeImages[rangeImages.length - 1].label}`);
        }
        
        console.log('\n✅ MANIFEST LOADING SUCCESS');
        console.log('No "library2" initialization error occurred');
        
        // Test for potential duplication issues
        console.log('\nStep 4: Testing for duplication issues...');
        const manifest2 = await loaders.getManifest(url);
        if (manifest2.images.length !== manifest.images.length) {
            console.log('⚠️  WARNING: Manifest duplication detected!');
            console.log(`  First load: ${manifest.images.length} pages`);
            console.log(`  Second load: ${manifest2.images.length} pages`);
        } else {
            console.log('  No duplication issues detected');
        }
        
    } catch (error) {
        console.error('\n❌ ERROR REPRODUCED:');
        console.error(`  Type: ${error.name}`);
        console.error(`  Message: ${error.message}`);
        console.error(`  Stack trace:`);
        console.error(error.stack);
        
        if (error.message.includes('library2')) {
            console.error('\n🎯 CRITICAL: "library2" initialization error detected!');
            console.error('This is the exact error reported by the user.');
        }
    }
}

// Run the reproduction test
reproduceIssue().then(() => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST COMPLETE');
}).catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});