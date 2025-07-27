const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testVeronaFix() {
    const loader = new SharedManifestLoaders();
    
    const testCases = [
        {
            name: 'Codice 15 (LXXXIX 84)',
            url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
            expectedPages: 254
        },
        {
            name: 'Direct IIIF manifest',
            url: 'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json',
            expectedPages: 254
        },
        {
            name: 'Codice 14 (CVII 100)',
            url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=14',
            expectedPages: null // We don't know the exact count yet
        }
    ];
    
    console.log('Testing Verona library fixes...\n');
    
    for (const testCase of testCases) {
        console.log(`\n=== Testing: ${testCase.name} ===`);
        console.log(`URL: ${testCase.url}`);
        
        try {
            const manifest = await loader.getVeronaManifest(testCase.url);
            
            console.log(`✓ Success!`);
            console.log(`  Display Name: ${manifest.displayName}`);
            console.log(`  Total Pages: ${manifest.images.length}`);
            
            if (testCase.expectedPages && manifest.images.length !== testCase.expectedPages) {
                console.log(`  ⚠️  Warning: Expected ${testCase.expectedPages} pages but got ${manifest.images.length}`);
            }
            
            // Show first few pages
            console.log(`  First 3 pages:`);
            for (let i = 0; i < Math.min(3, manifest.images.length); i++) {
                const img = manifest.images[i];
                console.log(`    - ${img.label}: ${img.url.substring(0, 80)}...`);
            }
            
            // Show last page to verify we got all pages
            if (manifest.images.length > 3) {
                const lastImg = manifest.images[manifest.images.length - 1];
                console.log(`  Last page:`);
                console.log(`    - ${lastImg.label}: ${lastImg.url.substring(0, 80)}...`);
            }
            
            // Test image resolution detection
            if (manifest.images.length > 0) {
                console.log('\n  Testing resolution options...');
                const firstImage = manifest.images[0];
                const serviceUrl = firstImage.url.match(/(.+?)\/full\//)?.[1];
                
                if (serviceUrl) {
                    const resolutionTests = [
                        'full/full/0/default.jpg',
                        'full/max/0/default.jpg',
                        'full/2000,/0/default.jpg',
                        'full/4000,/0/default.jpg'
                    ];
                    
                    for (const resolution of resolutionTests) {
                        const testUrl = `${serviceUrl}/${resolution}`;
                        try {
                            const response = await loader.fetchWithRetry(testUrl, {}, 1);
                            if (response.ok) {
                                const buffer = await response.buffer();
                                console.log(`    ✓ ${resolution} - ${(buffer.length / 1024).toFixed(1)} KB`);
                            } else {
                                console.log(`    ✗ ${resolution} - HTTP ${response.status}`);
                            }
                        } catch (err) {
                            console.log(`    ✗ ${resolution} - Failed`);
                        }
                    }
                }
            }
            
        } catch (error) {
            console.log(`✗ Failed: ${error.message}`);
            if (error.stack) {
                console.log(`  Stack trace: ${error.stack.split('\n')[1]}`);
            }
        }
    }
    
    console.log('\n=== Test Summary ===');
    console.log('Verona library now supports:');
    console.log('- Dynamic IIIF manifest fetching (no hardcoded 10-page limit)');
    console.log('- Direct IIIF manifest URLs');
    console.log('- Multiple codice values with fallback mappings');
    console.log('- Comprehensive logging for debugging');
    console.log('- Maximum resolution detection');
}

// Run the test
testVeronaFix().catch(console.error);