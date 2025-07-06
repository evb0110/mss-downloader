const { exec } = require('child_process');
const fs = require('fs');

const manifestUrl = 'https://iiif.diamm.net/manifests/I-Rc-Ms-1907/manifest.json';

console.log('Testing DIAMM manifest with curl...');
console.log('URL:', manifestUrl);

exec(`curl -s -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${manifestUrl}"`, (error, stdout, stderr) => {
    if (error) {
        console.error('Curl error:', error.message);
        return;
    }
    
    if (stderr) {
        console.error('Curl stderr:', stderr);
    }
    
    if (!stdout) {
        console.error('No response from server');
        return;
    }
    
    try {
        const manifest = JSON.parse(stdout);
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
        
    } catch (parseError) {
        console.error('Error parsing JSON:', parseError.message);
        console.log('Raw response (first 500 chars):', stdout.substring(0, 500));
    }
});