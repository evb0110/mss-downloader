const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testFlorenceFix() {
    console.log('🔬 Testing ULTRA-PRIORITY FIX for Issue #5');
    console.log('============================================\n');
    
    const loader = new SharedManifestLoaders();
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
    
    console.log(`Testing URL: ${testUrl}`);
    console.log('User reported: Only 1 page detected when there should be many\n');
    
    try {
        console.log('Calling getFlorenceManifest with the fixed code...\n');
        const result = await loader.getFlorenceManifest(testUrl);
        
        console.log('✅ RESULT:');
        console.log(`   Display Name: ${result.displayName || 'Not set'}`);
        console.log(`   Images found: ${result.images ? result.images.length : 0}`);
        
        if (result.images && result.images.length > 0) {
            console.log('\n   First 5 images:');
            result.images.slice(0, 5).forEach((img, i) => {
                console.log(`     ${i+1}. ${img.label}: ${img.url}`);
            });
            
            console.log('\n   Last 3 images:');
            result.images.slice(-3).forEach((img, i) => {
                const index = result.images.length - 3 + i + 1;
                console.log(`     ${index}. ${img.label}: ${img.url}`);
            });
            
            // Check if images are unique
            const uniqueUrls = new Set(result.images.map(img => img.url));
            if (uniqueUrls.size !== result.images.length) {
                console.log('\n⚠️  WARNING: Some images have duplicate URLs!');
            } else {
                console.log('\n✅ All images have unique URLs');
            }
            
            // Success criteria
            if (result.images.length > 1) {
                console.log('\n🎉 SUCCESS: Fix is working! Found multiple pages instead of just 1');
                console.log(`   Previous behavior: 1 page`);
                console.log(`   Fixed behavior: ${result.images.length} pages`);
            } else {
                console.log('\n❌ FAILURE: Still only detecting 1 page');
            }
        } else {
            console.log('\n❌ No images found');
        }
    } catch (error) {
        console.log(`\n❌ Error: ${error.message}`);
        console.log(`Stack: ${error.stack}`);
    }
}

testFlorenceFix().catch(console.error);