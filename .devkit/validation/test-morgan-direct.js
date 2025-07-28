const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Import the actual EnhancedManuscriptDownloaderService
const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService');

async function testMorgan() {
    console.log('Testing Morgan Library with actual service...\n');
    
    const service = new EnhancedManuscriptDownloaderService();
    const testUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
    
    try {
        console.log('Loading Morgan manifest...');
        const manifest = await service.loadMorganManifest(testUrl);
        
        console.log('\n✅ SUCCESS: Morgan manifest loaded');
        console.log(`Title: ${manifest.displayName}`);
        console.log(`Total Pages: ${manifest.totalPages}`);
        console.log(`Library: ${manifest.library}`);
        
        if (manifest.totalPages > 1) {
            console.log('\n✅ FIXED: Morgan now correctly extracts all pages instead of just 1');
            console.log(`First 5 pages:`);
            for (let i = 0; i < Math.min(5, manifest.pageLinks.length); i++) {
                console.log(`  Page ${i + 1}: ${manifest.pageLinks[i]}`);
            }
        } else {
            console.log('\n❌ ISSUE: Only 1 page extracted - fix may not be working');
        }
        
        // Download first 5 pages as validation
        const validationDir = path.join(__dirname, 'morgan-validation-' + Date.now());
        fs.mkdirSync(validationDir, { recursive: true });
        
        console.log('\nDownloading first 5 pages for validation...');
        const pagesToDownload = Math.min(5, manifest.pageLinks.length);
        
        for (let i = 0; i < pagesToDownload; i++) {
            const imagePath = path.join(validationDir, `page-${i + 1}.jpg`);
            try {
                execSync(`curl -s -L -o "${imagePath}" --max-time 30 "${manifest.pageLinks[i]}"`, { stdio: 'pipe' });
                const size = fs.statSync(imagePath).size;
                console.log(`  ✓ Page ${i + 1} downloaded: ${(size / 1024).toFixed(1)} KB`);
            } catch (err) {
                console.log(`  ✗ Page ${i + 1} download failed`);
            }
        }
        
        console.log(`\nValidation files saved to: ${validationDir}`);
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.error('\nFull error:', error);
    }
}

// First compile the TypeScript
console.log('Compiling TypeScript...');
try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✓ Build successful\n');
} catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
}

// Run the test
testMorgan().catch(console.error);