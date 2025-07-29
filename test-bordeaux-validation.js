const { SharedManifestLoaders } = require('./src/shared/SharedManifestLoaders.js');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function testBordeauxLibrary() {
    console.log('🧪 Testing Bordeaux Library Implementation...\n');
    
    const testUrls = [
        'https://manuscrits.bordeaux.fr/ark:/26678/btv1b52509616g/f13.item.zoom',
        'https://manuscrits.bordeaux.fr/ark:/26678/btv1b10509613h/f1.item.zoom'
    ];
    
    const loader = new SharedManifestLoaders();
    const validationDir = path.join(__dirname, '.devkit/validation/bordeaux', new Date().toISOString().split('T')[0]);
    
    await fs.mkdir(validationDir, { recursive: true });
    
    for (const url of testUrls) {
        console.log(`\n📚 Testing URL: ${url}`);
        
        try {
            // Test 1: Load manifest
            console.log('  1️⃣ Loading manifest...');
            const manifest = await loader.getManifestForLibrary('bordeaux', url);
            console.log(`     ✅ Manifest loaded: ${manifest.displayName}`);
            console.log(`     📄 Total images: ${manifest.images.length}`);
            console.log(`     🔧 Type: ${manifest.type || 'standard'}`);
            console.log(`     🧩 Requires tile assembly: ${manifest.requiresTileAssembly || false}`);
            
            // Test 2: Check DZI structure
            if (manifest.images.length > 0 && manifest.images[0].type === 'dzi') {
                console.log(`\n  2️⃣ Checking DZI structure...`);
                const firstImage = manifest.images[0];
                console.log(`     📍 DZI URL: ${firstImage.url}`);
                console.log(`     🔢 Page number: ${firstImage.pageNumber}`);
                console.log(`     📐 Tile size: ${firstImage.tileSize}`);
                console.log(`     🔲 Overlap: ${firstImage.overlap}`);
                console.log(`     📸 Format: ${firstImage.format}`);
                
                // Save manifest info for manual inspection
                const manifestPath = path.join(validationDir, 'manifest.json');
                await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
                console.log(`     💾 Manifest saved to: manifest.json`);
            }
            
            // Test 3: List all DZI URLs
            if (manifest.images.length > 1) {
                console.log(`\n  3️⃣ Listing all DZI URLs (first 5)...`);
                const maxShow = Math.min(5, manifest.images.length);
                for (let i = 0; i < maxShow; i++) {
                    const img = manifest.images[i];
                    console.log(`     Page ${i + 1}: ${img.url}`);
                }
                if (manifest.images.length > maxShow) {
                    console.log(`     ... and ${manifest.images.length - maxShow} more pages`);
                }
            }
            
        } catch (error) {
            console.error(`\n❌ Test failed for ${url}:`);
            console.error(`   ${error.message}`);
            if (error.stack) {
                console.error(`   Stack trace: ${error.stack.split('\n').slice(1, 3).join('\n')}`);
            }
        }
    }
    
    console.log(`\n\n✅ Bordeaux manifest validation complete!`);
    console.log(`📁 Results saved to: ${validationDir}`);
    console.log('\n📝 Next steps:');
    console.log('   1. Check the manifest.json files to verify DZI structure');
    console.log('   2. The DZI processor will handle tile assembly when downloading');
    console.log('   3. Each DZI URL points to metadata that describes the tile structure');
}

// Run the test
testBordeauxLibrary().catch(console.error);