// Direct CUDL manifest loading test
const testUrl = 'https://cudl.lib.cam.ac.uk/view/MS-II-00006-00032/1';

console.log('Testing CUDL manifest URL directly...');
console.log('URL:', testUrl);

async function testCudlManifest() {
    try {
        // Extract manuscript ID from URL
        const idMatch = testUrl.match(/\/view\/([^/]+)/);
        if (!idMatch) {
            throw new Error('Invalid Cambridge CUDL URL format');
        }
        
        const manuscriptId = idMatch[1];
        const manifestUrl = `https://cudl.lib.cam.ac.uk/iiif/${manuscriptId}`;
        
        console.log('Manuscript ID:', manuscriptId);
        console.log('Manifest URL:', manifestUrl);
        
        const response = await fetch(manifestUrl, {
            headers: {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const manifest = await response.json();
        
        console.log('✅ Manifest loaded successfully!');
        console.log('Label:', manifest.label);
        console.log('Type:', manifest['@type'] || manifest.type);
        
        const sequences = manifest.sequences || [];
        const canvases = sequences[0]?.canvases || [];
        console.log('Total pages/canvases:', canvases.length);
        
        if (canvases.length > 0) {
            console.log('\n📄 First page structure:');
            const firstCanvas = canvases[0];
            const resource = firstCanvas.images?.[0]?.resource;
            console.log('Resource ID:', resource?.['@id'] || resource?.id);
            
            if (resource) {
                const imageUrl = resource['@id'] || resource.id;
                if (imageUrl && imageUrl.includes('images.lib.cam.ac.uk/iiif/')) {
                    const fullMaxUrl = imageUrl + '/full/max/0/default.jpg';
                    console.log('Full resolution URL:', fullMaxUrl);
                }
            }
        }
        
        return manifest;
    } catch (error) {
        console.error('❌ CUDL test failed:', error.message);
        return null;
    }
}

testCudlManifest();