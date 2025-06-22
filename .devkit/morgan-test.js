import { EnhancedManuscriptDownloaderService } from '../dist/main/services/EnhancedManuscriptDownloaderService.js';

async function testMorganLibrary() {
    const downloader = new EnhancedManuscriptDownloaderService();
    
    const testUrls = [
        'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        'https://www.themorgan.org/collection/gospel-book/143812/thumbs'
    ];
    
    console.log('Testing Morgan Library implementation...\n');
    
    for (const url of testUrls) {
        try {
            console.log(`Testing URL: ${url}`);
            const manifest = await downloader.loadMorganManifest(url);
            
            console.log(`  Title: ${manifest.displayName}`);
            console.log(`  Total Pages: ${manifest.totalPages}`);
            console.log(`  First 3 image URLs:`);
            
            for (let i = 0; i < Math.min(3, manifest.pageLinks.length); i++) {
                console.log(`    ${i + 1}: ${manifest.pageLinks[i]}`);
            }
            
            console.log(`  Library: ${manifest.library}`);
            console.log('  ✅ SUCCESS\n');
            
        } catch (error) {
            console.log(`  ❌ ERROR: ${error.message}\n`);
        }
    }
}

testMorganLibrary().catch(console.error);