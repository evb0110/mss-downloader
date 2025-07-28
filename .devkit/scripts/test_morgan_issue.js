const { app } = require('electron');
const EnhancedManuscriptDownloaderService = require('../../dist/main/services/EnhancedManuscriptDownloaderService.js').default;

async function testMorganIssue() {
    try {
        console.log('Testing Morgan Library issue with URL: https://www.themorgan.org/collection/lindau-gospels/thumbs');
        
        // Initialize the service
        const service = new EnhancedManuscriptDownloaderService();
        
        // Test the URL
        const manifest = await service.loadMorganManifest('https://www.themorgan.org/collection/lindau-gospels/thumbs');
        
        console.log('Success! Manifest loaded:', {
            totalPages: manifest.totalPages,
            displayName: manifest.displayName,
            firstPageUrl: manifest.pageLinks[0]
        });
        
    } catch (error) {
        console.error('Error occurred:', error.message);
        console.error('Stack trace:', error.stack);
    }
    
    process.exit(0);
}

// Run the test
app.whenReady().then(() => {
    testMorganIssue();
});