const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

async function testMultiPage() {
    const loader = new SharedManifestLoaders();
    
    // Test manuscript with multiple pages
    const url = 'https://bvpb.mcu.es/es/consulta/registro.do?id=451885';
    
    console.log('Testing BVPB multi-page manuscript...');
    console.log(`URL: ${url}`);
    
    try {
        const manifest = await loader.getBVPBManifest(url);
        console.log(`\nSuccess! Found ${manifest.images.length} pages`);
        
        // Show first few pages
        manifest.images.slice(0, 5).forEach((img, i) => {
            console.log(`Page ${i + 1}: ${img.url}`);
        });
        
        if (manifest.images.length > 5) {
            console.log(`... and ${manifest.images.length - 5} more pages`);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testMultiPage().catch(console.error);