const path = require('path');

// Test the Morgan manifest loading with the fix
async function testMorganManifest() {
    console.log('Testing Morgan Library manifest loading with fix...\n');
    
    // Import the service
    const { EnhancedManuscriptDownloaderService } = require('../dist/main/services/EnhancedManuscriptDownloaderService.js');
    const service = new EnhancedManuscriptDownloaderService();
    
    const testUrl = 'https://www.themorgan.org/collection/lindau-gospels';
    
    try {
        console.log(`Testing URL: ${testUrl}\n`);
        
        const manifest = await service.loadMorganManifest(testUrl);
        
        console.log('Manifest loaded successfully!');
        console.log(`Display Name: ${manifest.displayName}`);
        console.log(`Total Pages: ${manifest.totalPages}`);
        console.log(`Library: ${manifest.library}`);
        console.log('\nFirst 5 page URLs:');
        manifest.pageLinks.slice(0, 5).forEach((url, i) => {
            console.log(`  ${i + 1}: ${url}`);
        });
        
        if (manifest.totalPages > 5) {
            console.log(`  ... and ${manifest.totalPages - 5} more pages`);
        }
        
        // Check if we got the expected number of pages
        if (manifest.totalPages >= 16) {
            console.log('\n✅ SUCCESS: Found all expected pages!');
        } else {
            console.log(`\n⚠️  WARNING: Only found ${manifest.totalPages} pages, expected at least 16`);
        }
        
        // Check image quality
        const avgUrlLength = manifest.pageLinks.reduce((sum, url) => sum + url.length, 0) / manifest.pageLinks.length;
        console.log(`\nAverage URL length: ${avgUrlLength.toFixed(0)} characters`);
        
        const facsimileCount = manifest.pageLinks.filter(url => url.includes('facsimile')).length;
        console.log(`Facsimile images: ${facsimileCount}`);
        
        const zifCount = manifest.pageLinks.filter(url => url.includes('.zif')).length;
        console.log(`ZIF ultra-high res images: ${zifCount}`);
        
    } catch (error) {
        console.error('Error loading manifest:', error.message);
        console.error(error.stack);
    }
}

// Check if the compiled file exists
const fs = require('fs');
const distPath = path.join(__dirname, '../dist/main/services/EnhancedManuscriptDownloaderService.js');

if (!fs.existsSync(distPath)) {
    console.error('Error: Compiled service not found. Please run "npm run build" first.');
    process.exit(1);
}

testMorganManifest();