#!/usr/bin/env node

/**
 * Test the updated production code with simplified e-manuscripta implementation
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testUpdatedProduction() {
    const testUrl = 'https://www.e-manuscripta.ch/bau/content/zoom/5157616';
    const loader = new SharedManifestLoaders();
    
    console.log('='.repeat(80));
    console.log('🚀 TESTING UPDATED PRODUCTION CODE');
    console.log('='.repeat(80));
    console.log();
    
    try {
        const startTime = Date.now();
        const result = await loader.getEManuscriptaManifest(testUrl);
        const elapsed = Date.now() - startTime;
        
        console.log('\n📊 Results:');
        console.log(`  Pages found: ${result.images.length}`);
        console.log(`  Title: ${result.displayName}`);
        console.log(`  Time taken: ${elapsed}ms`);
        
        if (result.images.length === 404) {
            console.log('\n✅ SUCCESS: Found exactly 404 pages as expected!');
        } else if (result.images.length > 400) {
            console.log(`\n✅ Found ${result.images.length} pages (close to expected 404)`);
        } else {
            console.log(`\n⚠️ Found ${result.images.length} pages (expected 404)`);
        }
        
        // Show sample pages
        console.log('\n📄 First 5 pages:');
        result.images.slice(0, 5).forEach(img => {
            console.log(`  ${img.label}: ${img.blockId || 'N/A'}`);
        });
        
        console.log('\n📄 Last 5 pages:');
        result.images.slice(-5).forEach(img => {
            console.log(`  ${img.label}: ${img.blockId || 'N/A'}`);
        });
        
        // Test that it works through the main adapter
        console.log('\n🔍 Testing through main adapter method...');
        const adapterResult = await loader.getManifestForLibrary('e_manuscripta', testUrl);
        console.log(`  Adapter result: ${adapterResult.images.length} pages`);
        
        return result;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

// Run the test
(async () => {
    await testUpdatedProduction();
})();