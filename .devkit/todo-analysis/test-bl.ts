import { SharedManifestLoaders } from '../src/shared/SharedManifestLoaders';

async function testBritishLibrary() {
    const loader = new SharedManifestLoaders();
    const url = 'https://bl.digirati.io/iiif/ark:/81055/vdc_100055984026.0x000001';
    
    console.log('Testing British Library manifest loading...');
    console.log('URL:', url);
    
    try {
        const result = await loader.getManifestForLibrary('british_library', url);
        console.log('✅ SUCCESS!');
        console.log('Pages found:', result.images?.length || 0);
        console.log('Display name:', result.displayName || 'N/A');
        
        if (result.images && result.images.length > 0) {
            console.log('\n📄 Sample pages:');
            for (let i = 0; i < Math.min(3, result.images.length); i++) {
                console.log(`Page ${result.images[i].page}: ${result.images[i].url}`);
            }
        }
        
        return result;
    } catch (error) {
        console.error('❌ FAILED:', error.message);
        return null;
    }
}

testBritishLibrary();