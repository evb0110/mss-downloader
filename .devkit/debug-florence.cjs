const { LibraryValidator } = require('./run-validation.js');

async function debugFlorence() {
    const validator = new LibraryValidator();
    
    try {
        console.log('1. Testing Florence manifest extraction...');
        const manifest = await validator.getFlorenceManifest('https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515');
        console.log('Manifest result:', JSON.stringify(manifest, null, 2));
        
        if (manifest.images && manifest.images.length > 0) {
            const testUrl = manifest.images[0].url;
            console.log(`\n2. Testing direct URL: ${testUrl}`);
            
            const response = await validator.fetchWithRetry(testUrl);
            console.log(`Response status: ${response.status}`);
            console.log(`Response ok: ${response.ok}`);
            
            if (response.ok) {
                const buffer = await response.buffer();
                console.log(`Response size: ${buffer.length} bytes`);
            } else {
                console.log('Response headers:', response.headers);
            }
        }
        
    } catch (error) {
        console.error('Debug error:', error.message);
        console.error('Full error:', error);
    }
}

debugFlorence().catch(console.error);