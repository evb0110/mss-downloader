const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

async function testBDL() {
    console.log('🔬 Testing BDL with exact user URL...');
    const loaders = new SharedManifestLoaders();
    const url = 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903';
    
    try {
        console.log('📊 Fetching manifest for:', url);
        const manifest = await loaders.getManifestForLibrary('bdl', url);
        
        console.log(`✅ Found ${manifest.images.length} images`);
        
        // Test first 3 images
        for (let i = 0; i < Math.min(3, manifest.images.length); i++) {
            const imageUrl = manifest.images[i].url;
            console.log(`\n🖼️ Testing image ${i + 1}: ${imageUrl}`);
            
            const response = await fetch(imageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            
            if (response.ok) {
                const contentLength = response.headers.get('content-length');
                console.log(`  ✅ Image accessible - Size: ${contentLength} bytes`);
                
                // Check if it's actually an image
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('image')) {
                    console.log(`  ✅ Content-Type: ${contentType}`);
                } else {
                    console.log(`  ⚠️ Unexpected Content-Type: ${contentType}`);
                }
            } else {
                console.log(`  ❌ Image failed: ${response.status} ${response.statusText}`);
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

testBDL();