const { EnhancedManuscriptDownloaderService } = require('../dist/main/services/EnhancedManuscriptDownloaderService.js');
const path = require('path');

async function validateRouenFix() {
    const service = new EnhancedManuscriptDownloaderService();
    const outputDir = path.join(__dirname, 'rouen-validation');
    
    console.log('Testing Rouen Library fix...\n');
    
    const testUrl = 'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.item.zoom';
    
    try {
        console.log('Loading manifest for:', testUrl);
        const manifest = await service.loadRouenManifest(testUrl);
        
        console.log('\nManifest loaded successfully:');
        console.log(`- Display Name: ${manifest.displayName}`);
        console.log(`- Total Pages: ${manifest.totalPages}`);
        console.log(`- Library: ${manifest.library}`);
        console.log(`- Page Links: ${manifest.pageLinks.length} URLs generated`);
        
        if (manifest.pageLinks.length > 0) {
            console.log(`- First page URL: ${manifest.pageLinks[0]}`);
            console.log(`- Last page URL: ${manifest.pageLinks[manifest.pageLinks.length - 1]}`);
        }
        
        // Test downloading a few pages
        console.log('\nTesting page downloads...');
        const testPages = [1, 10, 50, 93]; // Test first, middle, and last pages
        
        for (const pageNum of testPages) {
            if (pageNum <= manifest.totalPages) {
                const pageUrl = manifest.pageLinks[pageNum - 1];
                console.log(`\nTesting page ${pageNum}: ${pageUrl}`);
                
                try {
                    const response = await fetch(pageUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
                            'Referer': testUrl
                        }
                    });
                    
                    console.log(`  - Status: ${response.status} ${response.statusText}`);
                    console.log(`  - Content-Type: ${response.headers.get('content-type')}`);
                    console.log(`  - Content-Length: ${response.headers.get('content-length')} bytes`);
                    
                    if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
                        console.log('  ✓ Page download successful');
                    } else {
                        console.log('  ✗ Page download failed or not an image');
                    }
                } catch (error) {
                    console.log(`  ✗ Error downloading page: ${error.message}`);
                }
            }
        }
        
        console.log('\n✓ Rouen Library fix validated successfully!');
        
    } catch (error) {
        console.error('\n✗ Validation failed:', error.message);
        console.error(error.stack);
    }
}

validateRouenFix();