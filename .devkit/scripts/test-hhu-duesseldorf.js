const https = require('https');
const fs = require('fs');
const path = require('path');

// Test HHU Düsseldorf manuscript manifest
const manifestUrl = 'https://digital.ulb.hhu.de/i3f/v20/7674176/manifest';

function fetchWithHttps(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json, */*',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 30000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

async function analyzeManifest() {
    console.log('Fetching HHU Düsseldorf manifest:', manifestUrl);
    
    try {
        const manifestData = await fetchWithHttps(manifestUrl);
        const manifest = JSON.parse(manifestData);
        
        console.log('\nManifest Analysis:');
        console.log('==================');
        console.log('Type:', manifest['@type'] || 'Unknown');
        console.log('Label:', manifest.label || 'No label');
        console.log('Attribution:', manifest.attribution || 'No attribution');
        
        // Check for sequences and canvases
        if (manifest.sequences && manifest.sequences[0]) {
            const sequence = manifest.sequences[0];
            const canvases = sequence.canvases || [];
            console.log('\nTotal canvases:', canvases.length);
            
            if (canvases.length > 0) {
                console.log('\nFirst 5 canvas samples:');
                console.log('========================');
                
                for (let i = 0; i < Math.min(5, canvases.length); i++) {
                    const canvas = canvases[i];
                    console.log(`\nCanvas ${i + 1}:`);
                    console.log('  Label:', canvas.label);
                    console.log('  ID:', canvas['@id']);
                    console.log('  Width:', canvas.width);
                    console.log('  Height:', canvas.height);
                    
                    // Check for images
                    if (canvas.images && canvas.images[0]) {
                        const image = canvas.images[0];
                        const resource = image.resource;
                        console.log('  Image Resource:');
                        console.log('    ID:', resource['@id']);
                        console.log('    Format:', resource.format);
                        console.log('    Width:', resource.width);
                        console.log('    Height:', resource.height);
                        
                        // Check for image service
                        if (resource.service) {
                            console.log('  Image Service:');
                            console.log('    ID:', resource.service['@id']);
                            console.log('    Profile:', resource.service.profile);
                        }
                    }
                }
                
                // Test different resolution parameters
                console.log('\nTesting resolution parameters:');
                console.log('==============================');
                const testCanvas = canvases[0];
                if (testCanvas.images && testCanvas.images[0]) {
                    const serviceId = testCanvas.images[0].resource.service['@id'];
                    const resolutionTests = [
                        'full/full/0/default.jpg',
                        'full/max/0/default.jpg',
                        'full/2000,/0/default.jpg',
                        'full/4000,/0/default.jpg',
                        'full/6000,/0/default.jpg',
                        'full/,2000/0/default.jpg',
                        'full/,4000/0/default.jpg'
                    ];
                    
                    for (const param of resolutionTests) {
                        const testUrl = `${serviceId}/${param}`;
                        console.log(`\n  Testing: ${param}`);
                        console.log(`  URL: ${testUrl}`);
                        
                        try {
                            // Just check if URL is accessible
                            const response = await fetchWithHttps(testUrl.replace(/\/info\.json$/, ''));
                            console.log(`  Status: SUCCESS (${response.length} bytes)`);
                        } catch (error) {
                            console.log(`  Status: FAILED - ${error.message}`);
                        }
                    }
                }
            }
        }
        
        // Save manifest for reference
        fs.writeFileSync('.devkit/cache/hhu-manifest.json', JSON.stringify(manifest, null, 2));
        console.log('\nManifest saved to .devkit/cache/hhu-manifest.json');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

analyzeManifest();