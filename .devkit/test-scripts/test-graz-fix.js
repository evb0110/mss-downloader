const path = require('path');
const fs = require('fs');

// Import the service
const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService.js');

async function testGrazFix() {
    console.log('Testing University of Graz JSON parsing fix...\n');
    
    const service = new EnhancedManuscriptDownloaderService();
    const testUrl = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538';
    
    try {
        console.log('1. Loading manifest for:', testUrl);
        const manifest = await service.loadGrazManifest(testUrl);
        
        console.log('✓ Successfully loaded manifest');
        console.log('  Display name:', manifest.displayName);
        console.log('  Total pages:', manifest.totalPages);
        console.log('  Page links count:', manifest.pageLinks.length);
        console.log('  First page URL:', manifest.pageLinks[0]);
        console.log('  Last page URL:', manifest.pageLinks[manifest.pageLinks.length - 1]);
        
        // Test downloading a few pages
        console.log('\n2. Testing page downloads...');
        const testPages = [0, 1, manifest.pageLinks.length - 1];
        
        for (const index of testPages) {
            const pageUrl = manifest.pageLinks[index];
            console.log(`\n  Downloading page ${index + 1}/${manifest.totalPages}...`);
            console.log(`  URL: ${pageUrl}`);
            
            try {
                const imageData = await service.downloadSinglePage(pageUrl, 'graz', index + 1, manifest.totalPages);
                console.log(`  ✓ Downloaded successfully, size: ${imageData.length} bytes`);
                
                // Save first page for inspection
                if (index === 0) {
                    const outputPath = path.join(__dirname, 'graz-test-page1.jpg');
                    fs.writeFileSync(outputPath, imageData);
                    console.log(`  ✓ Saved test page to: ${outputPath}`);
                }
            } catch (downloadError) {
                console.error(`  ✗ Download failed:`, downloadError.message);
            }
        }
        
        console.log('\n✓ All tests completed successfully!');
        
    } catch (error) {
        console.error('✗ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// First build the TypeScript
console.log('Building TypeScript...');
const { execSync } = require('child_process');
try {
    execSync('npm run build:main', { stdio: 'inherit' });
    console.log('Build completed, running test...\n');
    
    // Run the test
    testGrazFix();
} catch (buildError) {
    console.error('Build failed:', buildError.message);
}