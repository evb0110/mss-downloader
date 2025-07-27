const path = require('path');

// Import the service
const { EnhancedManuscriptDownloaderService } = require(path.join(__dirname, '../../src/main/services/EnhancedManuscriptDownloaderService.ts'));

async function testHHUFix() {
    console.log('Testing HHU Düsseldorf fix...\n');
    
    const service = new EnhancedManuscriptDownloaderService();
    const testUrl = 'https://digital.ulb.hhu.de/ms/content/titleinfo/7674176';
    
    try {
        console.log(`Testing URL: ${testUrl}`);
        console.log('Attempting to load manifest...');
        
        const manifest = await service.loadManifest(testUrl);
        
        console.log('\n✅ SUCCESS! HHU manifest loaded successfully');
        console.log(`Title: ${manifest.displayName}`);
        console.log(`Pages: ${manifest.pageLinks.length}`);
        console.log(`Library: ${manifest.library}`);
        
        if (manifest.pageLinks.length > 0) {
            console.log(`\nFirst page URL: ${manifest.pageLinks[0]}`);
            console.log(`Last page URL: ${manifest.pageLinks[manifest.pageLinks.length - 1]}`);
        }
        
        console.log('\n✅ HHU Düsseldorf is now working correctly!');
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
    }
}

testHHUFix();