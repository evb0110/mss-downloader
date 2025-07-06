const https = require('https');
const { URL } = require('url');
const fs = require('fs');

async function testONBIIIFAPI() {
    console.log('=== Testing ONB IIIF API ===');
    
    const manuscriptId = '1000B160';
    const baseApiUrl = 'https://api.onb.ac.at/iiif/presentation/v3/manifest/';
    
    // Test the discovered API endpoint
    const manifestUrl = baseApiUrl + manuscriptId;
    
    console.log('Testing manifest URL:', manifestUrl);
    
    try {
        const response = await makeRequest(manifestUrl);
        console.log('Status:', response.statusCode);
        console.log('Content-Type:', response.headers['content-type']);
        
        if (response.statusCode === 200) {
            console.log('\n*** SUCCESS! IIIF Manifest found! ***');
            
            if (response.headers['content-type']?.includes('application/json')) {
                try {
                    const manifest = JSON.parse(response.body);
                    console.log('\n=== Manifest Analysis ===');
                    console.log('Keys:', Object.keys(manifest));
                    
                    if (manifest['@context'] || manifest.context) {
                        console.log('IIIF Context:', manifest['@context'] || manifest.context);
                    }
                    
                    if (manifest.id || manifest['@id']) {
                        console.log('ID:', manifest.id || manifest['@id']);
                    }
                    
                    if (manifest.type || manifest['@type']) {
                        console.log('Type:', manifest.type || manifest['@type']);
                    }
                    
                    if (manifest.label) {
                        console.log('Label:', manifest.label);
                    }
                    
                    if (manifest.items) {
                        console.log('Items (IIIF v3):', manifest.items.length, 'items');
                        
                        // Analyze first item
                        if (manifest.items[0]) {
                            const firstItem = manifest.items[0];
                            console.log('\n=== First Item Analysis ===');
                            console.log('First item ID:', firstItem.id);
                            console.log('First item type:', firstItem.type);
                            
                            if (firstItem.items && firstItem.items[0]) {
                                const annotation = firstItem.items[0];
                                console.log('Annotation type:', annotation.type);
                                
                                if (annotation.body) {
                                    console.log('Body ID:', annotation.body.id);
                                    console.log('Body type:', annotation.body.type);
                                    
                                    // Check for image service
                                    if (annotation.body.service) {
                                        console.log('Service found!');
                                        console.log('Service ID:', annotation.body.service.id);
                                        console.log('Service type:', annotation.body.service.type);
                                        
                                        // Test the image service info.json
                                        if (annotation.body.service.id) {
                                            const infoUrl = annotation.body.service.id + '/info.json';
                                            console.log('Testing image service:', infoUrl);
                                            
                                            try {
                                                const infoResponse = await makeRequest(infoUrl);
                                                console.log('Image service status:', infoResponse.statusCode);
                                                
                                                if (infoResponse.statusCode === 200) {
                                                    const info = JSON.parse(infoResponse.body);
                                                    console.log('Image dimensions:', info.width + 'x' + info.height);
                                                    console.log('Available sizes:', info.sizes?.length || 'N/A');
                                                    console.log('Profile:', info.profile);
                                                    
                                                    // Test maximum resolution image
                                                    const maxImageUrl = annotation.body.service.id + '/full/max/0/default.jpg';
                                                    console.log('Max resolution URL:', maxImageUrl);
                                                    
                                                    // Test image access
                                                    try {
                                                        const imageResponse = await makeRequestHead(maxImageUrl);
                                                        console.log('Max image status:', imageResponse.statusCode);
                                                        console.log('Max image size:', imageResponse.headers['content-length']);
                                                        console.log('Max image type:', imageResponse.headers['content-type']);
                                                    } catch (err) {
                                                        console.log('Max image test failed:', err.message);
                                                    }
                                                }
                                            } catch (err) {
                                                console.log('Image service test failed:', err.message);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else if (manifest.sequences) {
                        console.log('Sequences (IIIF v2):', manifest.sequences.length, 'sequences');
                        
                        if (manifest.sequences[0] && manifest.sequences[0].canvases) {
                            console.log('Canvases:', manifest.sequences[0].canvases.length, 'canvases');
                            
                            // Analyze first canvas
                            const firstCanvas = manifest.sequences[0].canvases[0];
                            if (firstCanvas) {
                                console.log('\n=== First Canvas Analysis ===');
                                console.log('Canvas ID:', firstCanvas['@id']);
                                console.log('Canvas type:', firstCanvas['@type']);
                                
                                if (firstCanvas.images && firstCanvas.images[0]) {
                                    const image = firstCanvas.images[0];
                                    console.log('Image resource ID:', image.resource['@id']);
                                    
                                    if (image.resource.service) {
                                        console.log('Service ID:', image.resource.service['@id']);
                                        
                                        // Test the image service
                                        const infoUrl = image.resource.service['@id'] + '/info.json';
                                        console.log('Testing image service:', infoUrl);
                                        
                                        try {
                                            const infoResponse = await makeRequest(infoUrl);
                                            console.log('Image service status:', infoResponse.statusCode);
                                            
                                            if (infoResponse.statusCode === 200) {
                                                const info = JSON.parse(infoResponse.body);
                                                console.log('Image dimensions:', info.width + 'x' + info.height);
                                                console.log('Profile:', info.profile);
                                            }
                                        } catch (err) {
                                            console.log('Image service test failed:', err.message);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    // Save the manifest
                    const filename = `.devkit/temp/onb-manifest-${manuscriptId}.json`;
                    fs.writeFileSync(filename, JSON.stringify(manifest, null, 2));
                    console.log('\nManifest saved to:', filename);
                    
                } catch (e) {
                    console.log('JSON parse error:', e.message);
                    console.log('Response preview:', response.body.substring(0, 500));
                }
            }
        } else {
            console.log('Request failed. Response:', response.body.substring(0, 200));
        }
        
    } catch (error) {
        console.log('Error testing manifest:', error.message);
    }
    
    // Also test if there are other manuscript IDs to validate the pattern
    console.log('\n=== Testing Alternative Manuscript IDs ===');
    const testIds = ['1000B161', '1000B162', '1000B159', 'Cod.1000', 'MS1000'];
    
    for (const testId of testIds) {
        try {
            const testUrl = baseApiUrl + testId;
            const response = await makeRequest(testUrl);
            console.log(`${testId}: Status ${response.statusCode}`);
        } catch (error) {
            console.log(`${testId}: Error - ${error.message}`);
        }
    }
}

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                'Referer': 'https://viewer.onb.ac.at/'
            }
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.setTimeout(10000, () => {
            req.abort();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

function makeRequestHead(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/*',
                'Referer': 'https://viewer.onb.ac.at/'
            }
        };
        
        const req = https.request(options, (res) => {
            resolve({
                statusCode: res.statusCode,
                headers: res.headers
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.setTimeout(5000, () => {
            req.abort();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

testONBIIIFAPI().catch(console.error);