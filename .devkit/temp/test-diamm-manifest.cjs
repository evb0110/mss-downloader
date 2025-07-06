const https = require('https');
const fs = require('fs');

// Test the DIAMM manifest URL
const manifestUrl = 'https://iiif.diamm.net/manifests/I-Rc-Ms-1907/manifest.json';

console.log('Testing DIAMM manifest URL...');
console.log('URL:', manifestUrl);

https.get(manifestUrl, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const manifest = JSON.parse(data);
            console.log('\n=== MANIFEST STRUCTURE ===');
            console.log('Type:', manifest['@type']);
            console.log('Label:', manifest.label);
            console.log('Description:', manifest.description);
            
            if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                const canvases = manifest.sequences[0].canvases;
                console.log('Total canvases:', canvases.length);
                
                // Analyze first few canvases
                const sampleSize = Math.min(3, canvases.length);
                console.log(`\n=== ANALYZING FIRST ${sampleSize} CANVASES ===`);
                
                for (let i = 0; i < sampleSize; i++) {
                    const canvas = canvases[i];
                    console.log(`\nCanvas ${i + 1}:`);
                    console.log('  ID:', canvas['@id']);
                    console.log('  Label:', canvas.label);
                    console.log('  Width:', canvas.width);
                    console.log('  Height:', canvas.height);
                    
                    if (canvas.images && canvas.images[0]) {
                        const image = canvas.images[0];
                        console.log('  Image motivation:', image.motivation);
                        
                        if (image.resource) {
                            const resource = image.resource;
                            console.log('  Resource ID:', resource['@id']);
                            console.log('  Resource type:', resource['@type']);
                            console.log('  Resource width:', resource.width);
                            console.log('  Resource height:', resource.height);
                            
                            if (resource.service) {
                                console.log('  Service ID:', resource.service['@id']);
                                console.log('  Service context:', resource.service['@context']);
                                console.log('  Service profile:', resource.service.profile);
                                
                                // Test different resolution parameters
                                const serviceId = resource.service['@id'];
                                const testUrls = [
                                    `${serviceId}/full/full/0/default.jpg`,
                                    `${serviceId}/full/max/0/default.jpg`,
                                    `${serviceId}/full/2000,/0/default.jpg`,
                                    `${serviceId}/full/4000,/0/default.jpg`,
                                    `${serviceId}/full/1000,/0/default.jpg`
                                ];
                                
                                console.log('  Test URLs for different resolutions:');
                                testUrls.forEach((url, idx) => {
                                    console.log(`    ${idx + 1}. ${url}`);
                                });
                            }
                        }
                    }
                }
            }
            
            // Save manifest for detailed analysis
            fs.writeFileSync('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/temp/diamm-manifest-1907.json', JSON.stringify(manifest, null, 2));
            console.log('\n=== MANIFEST SAVED ===');
            console.log('Saved to: .devkit/temp/diamm-manifest-1907.json');
            
        } catch (error) {
            console.error('Error parsing manifest:', error.message);
        }
    });
}).on('error', (error) => {
    console.error('Error fetching manifest:', error.message);
});