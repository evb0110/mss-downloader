const { EnhancedManuscriptDownloaderService } = require('../dist/main/services/EnhancedManuscriptDownloaderService.js');

async function testTorontoLibrary() {
    console.log('Testing University of Toronto library support...');
    
    const downloader = new EnhancedManuscriptDownloaderService();
    const testUrl = 'https://collections.library.utoronto.ca/view/fisher2:F6521';
    
    try {
        // Test library detection
        const library = downloader.detectLibrary(testUrl);
        console.log(`✅ Library detected: ${library}`);
        
        if (library !== 'toronto') {
            throw new Error(`Expected 'toronto', got '${library}'`);
        }
        
        // Test manifest loading
        console.log('Loading manifest...');
        const manifest = await downloader.loadManifest(testUrl);
        
        console.log(`✅ Manifest loaded successfully`);
        console.log(`   - Total pages: ${manifest.totalPages}`);
        console.log(`   - Display name: ${manifest.displayName}`);
        console.log(`   - Library: ${manifest.library}`);
        console.log(`   - First page URL: ${manifest.pageLinks[0]?.substring(0, 100)}...`);
        
        if (manifest.pageLinks.length === 0) {
            throw new Error('No pages found in manifest');
        }
        
        console.log('✅ University of Toronto library is working correctly!');
        
    } catch (error) {
        console.error('❌ Error testing Toronto library:', error.message);
        throw error;
    }
}

// Run the test
testTorontoLibrary().catch(console.error);