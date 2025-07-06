const { EnhancedManuscriptDownloaderService } = require('../../../src/main/services/EnhancedManuscriptDownloaderService.ts');

async function testBelgicaFix() {
    try {
        console.log('=== TESTING BELGICA KBR FIX ===');
        
        const service = new EnhancedManuscriptDownloaderService();
        const testUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
        
        console.log('Testing URL:', testUrl);
        console.log('Loading manuscript manifest...');
        
        const startTime = Date.now();
        const manifest = await service.loadManifest(testUrl);
        const endTime = Date.now();
        
        console.log('\n=== MANIFEST RESULTS ===');
        console.log('Library:', manifest.library);
        console.log('Display Name:', manifest.displayName);
        console.log('Total Pages:', manifest.totalPages);
        console.log('Page Links Count:', manifest.pageLinks.length);
        console.log('Load Time:', `${endTime - startTime}ms`);
        
        if (manifest.pageLinks.length > 0) {
            console.log('\nFirst 5 page URLs:');
            manifest.pageLinks.slice(0, 5).forEach((url, index) => {
                console.log(`${index + 1}: ${url}`);
            });
            
            if (manifest.pageLinks.length > 5) {
                console.log('...');
                console.log(`${manifest.pageLinks.length}: ${manifest.pageLinks[manifest.pageLinks.length - 1]}`);
            }
        }
        
        // Test downloading the first few images
        console.log('\n=== TESTING IMAGE DOWNLOADS ===');
        
        const testImages = manifest.pageLinks.slice(0, Math.min(3, manifest.pageLinks.length));
        
        for (let i = 0; i < testImages.length; i++) {
            const imageUrl = testImages[i];
            console.log(`\nTesting image ${i + 1}: ${imageUrl}`);
            
            try {
                const imageStartTime = Date.now();
                const response = await fetch(imageUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'DNT': '1',
                        'Connection': 'keep-alive',
                        'Sec-Fetch-Dest': 'image',
                        'Sec-Fetch-Mode': 'no-cors',
                        'Sec-Fetch-Site': 'same-origin'
                    }
                });
                
                const imageEndTime = Date.now();
                
                if (response.ok) {
                    const imageData = await response.arrayBuffer();
                    console.log(`✓ Success: ${imageData.byteLength} bytes (${imageEndTime - imageStartTime}ms)`);
                    
                    // Check if it's a valid image by looking at the first few bytes
                    const uint8Array = new Uint8Array(imageData);
                    const isJpeg = uint8Array[0] === 0xFF && uint8Array[1] === 0xD8;
                    const isPng = uint8Array[0] === 0x89 && uint8Array[1] === 0x50;
                    
                    if (isJpeg || isPng) {
                        console.log(`  ✓ Valid ${isJpeg ? 'JPEG' : 'PNG'} image format`);
                    } else {
                        console.log('  ⚠ Warning: Image format not recognized');
                    }
                } else {
                    console.log(`✗ Failed: HTTP ${response.status} ${response.statusText}`);
                }
            } catch (error) {
                console.log(`✗ Error: ${error.message}`);
            }
        }
        
        console.log('\n=== TEST SUMMARY ===');
        console.log(`✓ Manifest loaded successfully`);
        console.log(`✓ Found ${manifest.totalPages} pages`);
        console.log(`✓ Library: ${manifest.library}`);
        console.log(`✓ Display Name: ${manifest.displayName}`);
        
        return {
            success: true,
            manifest,
            testResults: {
                totalPages: manifest.totalPages,
                library: manifest.library,
                displayName: manifest.displayName,
                loadTime: endTime - startTime
            }
        };
        
    } catch (error) {
        console.error('\n=== TEST FAILED ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        return {
            success: false,
            error: error.message,
            stack: error.stack
        };
    }
}

// Run the test
testBelgicaFix().then(result => {
    console.log('\n=== FINAL RESULT ===');
    if (result.success) {
        console.log('✓ BELGICA KBR FIX TEST PASSED');
    } else {
        console.log('✗ BELGICA KBR FIX TEST FAILED');
    }
}).catch(error => {
    console.error('Unexpected error:', error);
});

module.exports = { testBelgicaFix };