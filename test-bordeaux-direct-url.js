/**
 * Test Bordeaux with direct selene.bordeaux.fr URLs
 */

const { SharedManifestLoaders } = require('./src/shared/SharedManifestLoaders.js');
const fs = require('fs').promises;
const path = require('path');

async function testBordeauxDirectUrl() {
    console.log('🧪 Testing Bordeaux with Direct Tile URLs\n');
    
    // Test with both public URLs and direct tile URLs
    const testCases = [
        {
            name: 'Public URL with known mapping',
            url: 'https://manuscrits.bordeaux.fr/ark:/26678/btv1b52509616g/f13.item.zoom',
            expectedTileBase: 'https://selene.bordeaux.fr/in/dz/330636101_MS0778_0013'
        },
        {
            name: 'Direct tile URL',
            url: 'https://selene.bordeaux.fr/in/dz/330636101_MS0778_0009',
            expectedTileBase: 'https://selene.bordeaux.fr/in/dz/330636101_MS0778_0009'
        }
    ];
    
    const loader = new SharedManifestLoaders();
    const validationDir = path.join(__dirname, '.devkit/validation/bordeaux-direct', new Date().toISOString().split('T')[0]);
    await fs.mkdir(validationDir, { recursive: true });
    
    for (const testCase of testCases) {
        console.log(`\n📚 Test: ${testCase.name}`);
        console.log(`   URL: ${testCase.url}`);
        
        try {
            const manifest = await loader.getManifestForLibrary('bordeaux', testCase.url);
            
            console.log(`   ✅ Manifest loaded: ${manifest.displayName}`);
            console.log(`   📄 Total images: ${manifest.images.length}`);
            console.log(`   🔧 Type: ${manifest.type}`);
            
            if (manifest.images.length > 0) {
                const firstImage = manifest.images[0];
                console.log(`\n   First page tile URL: ${firstImage.url}`);
                console.log(`   Expected: ${testCase.expectedTileBase}`);
                console.log(`   Match: ${firstImage.url === testCase.expectedTileBase ? '✅' : '❌'}`);
                
                // Test tile access
                const testTileUrl = `${firstImage.url}_files/13/0_0.jpg`;
                console.log(`\n   Testing tile access: ${testTileUrl}`);
                
                const https = require('https');
                const tileExists = await new Promise((resolve) => {
                    https.get(testTileUrl, (res) => {
                        resolve(res.statusCode === 200);
                    }).on('error', () => resolve(false));
                });
                
                console.log(`   Tile exists: ${tileExists ? '✅' : '❌'}`);
            }
            
            // Save manifest
            const filename = testCase.name.replace(/\s+/g, '_').toLowerCase() + '.json';
            await fs.writeFile(path.join(validationDir, filename), JSON.stringify(manifest, null, 2));
            
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
        }
    }
    
    console.log(`\n\n✅ Test complete! Results saved to: ${validationDir}`);
}

// Run test
testBordeauxDirectUrl().catch(console.error);