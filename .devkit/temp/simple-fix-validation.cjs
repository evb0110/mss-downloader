// Simple validation test for the manuscript fixes
console.log('🧪 Testing manuscript download fixes...\n');

async function testManifestLoading() {
    try {
        // Import the compiled service
        const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService.js');
        
        const downloader = new EnhancedManuscriptDownloaderService();
        
        console.log('✅ Service loaded successfully');
        
        // Test 1: ONB (New library)
        console.log('\n📋 Testing ONB (Austrian National Library)...');
        try {
            const onbManifest = await downloader.loadManifest('https://viewer.onb.ac.at/1000B160');
            console.log(`✅ ONB SUCCESS: ${onbManifest.totalPages} pages found`);
            console.log(`   Library: ${onbManifest.library}`);
            console.log(`   Title: ${onbManifest.displayName}`);
        } catch (onbError) {
            console.log(`❌ ONB ERROR: ${onbError.message}`);
        }
        
        // Test 2: BNE (Fixed fetch)
        console.log('\n📋 Testing BNE (Fixed native HTTPS)...');
        try {
            const bneManifest = await downloader.loadManifest('https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1');
            console.log(`✅ BNE SUCCESS: ${bneManifest.totalPages} pages found`);
            console.log(`   Library: ${bneManifest.library}`);
            console.log(`   Title: ${bneManifest.displayName}`);
        } catch (bneError) {
            console.log(`❌ BNE ERROR: ${bneError.message}`);
        }
        
        console.log('\n🏁 Quick validation completed!');
        
    } catch (error) {
        console.error('💥 Critical error:', error.message);
        process.exit(1);
    }
}

testManifestLoading();