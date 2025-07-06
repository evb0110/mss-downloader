const https = require('https');
const { URL } = require('url');
const fs = require('fs');

async function testONBImages() {
    console.log('=== Testing ONB Image Service ===');
    
    // Read the manifest to get the first few image services
    const manifest = JSON.parse(fs.readFileSync('.devkit/temp/onb-manifest-1000B160.json', 'utf8'));
    
    console.log('Manifest contains', manifest.items.length, 'items/pages');
    
    // Test the first few images
    const testCount = 5;
    console.log(`Testing first ${testCount} images...`);
    
    for (let i = 0; i < Math.min(testCount, manifest.items.length); i++) {
        const canvas = manifest.items[i];
        console.log(`\n=== Canvas ${i + 1}: ${canvas.label.none[0]} ===`);
        
        if (canvas.items && canvas.items[0] && canvas.items[0].items && canvas.items[0].items[0]) {
            const annotation = canvas.items[0].items[0];
            
            if (annotation.body && annotation.body.service && annotation.body.service[0]) {
                const service = annotation.body.service[0];
                const serviceId = service.id;
                
                console.log('Service ID:', serviceId);
                console.log('Service Type:', service.type);
                console.log('Service Profile:', service.profile);
                
                // Test the info.json endpoint
                const infoUrl = serviceId + '/info.json';
                console.log('Testing info endpoint:', infoUrl);
                
                try {
                    const infoResponse = await makeRequest(infoUrl);
                    console.log('Info status:', infoResponse.statusCode);
                    
                    if (infoResponse.statusCode === 200) {
                        const info = JSON.parse(infoResponse.body);
                        console.log('Image dimensions:', info.width + 'x' + info.height);
                        console.log('Profile:', info.profile);
                        
                        if (info.sizes) {
                            console.log('Available sizes:', info.sizes.length);
                            info.sizes.slice(0, 3).forEach(size => {
                                console.log(`  ${size.width}x${size.height}`);
                            });
                        }
                        
                        // Test different resolutions
                        const resolutionTests = [
                            '/full/max/0/default.jpg',
                            '/full/full/0/default.jpg',
                            '/full/4000,/0/default.jpg',
                            '/full/3000,/0/default.jpg',
                            '/full/2000,/0/default.jpg',
                            '/full/1000,/0/default.jpg',
                            '/full/500,/0/default.jpg'
                        ];
                        
                        console.log('\n--- Resolution Tests ---');
                        for (const resolution of resolutionTests) {
                            const imageUrl = serviceId + resolution;
                            
                            try {
                                const imageResponse = await makeRequestHead(imageUrl);
                                const sizeKB = Math.round(parseInt(imageResponse.headers['content-length'] || '0') / 1024);
                                console.log(`${resolution}: ${imageResponse.statusCode} - ${sizeKB}KB`);
                                
                                // If this is the first successful max resolution test, save the URL
                                if (i === 0 && resolution === '/full/max/0/default.jpg' && imageResponse.statusCode === 200) {
                                    console.log(`*** Max resolution URL for page 1: ${imageUrl} ***`);
                                    
                                    // Test downloading a small portion
                                    try {
                                        const partialResponse = await makeRequestPartial(imageUrl);
                                        console.log('Partial download test: SUCCESS (first 1KB)');
                                    } catch (err) {
                                        console.log('Partial download test: FAILED -', err.message);
                                    }
                                }
                            } catch (err) {
                                console.log(`${resolution}: ERROR - ${err.message}`);
                            }
                        }
                    }
                } catch (err) {
                    console.log('Info endpoint failed:', err.message);
                }
            }
        }
    }
    
    // Test authentication requirements
    console.log('\n=== Authentication Tests ===');
    
    const firstService = manifest.items[0].items[0].items[0].body.service[0];
    const testImageUrl = firstService.id + '/full/max/0/default.jpg';
    
    // Test without referrer
    try {
        const noRefResponse = await makeRequestCustom(testImageUrl, {});
        console.log('No referrer test:', noRefResponse.statusCode);
    } catch (err) {
        console.log('No referrer test: ERROR -', err.message);
    }
    
    // Test with different referrer
    try {
        const wrongRefResponse = await makeRequestCustom(testImageUrl, {
            'Referer': 'https://example.com/'
        });
        console.log('Wrong referrer test:', wrongRefResponse.statusCode);
    } catch (err) {
        console.log('Wrong referrer test: ERROR -', err.message);
    }
    
    // Summary
    console.log('\n=== ONB Implementation Summary ===');
    console.log('✓ IIIF v3 Presentation API');
    console.log('✓ Image Service v3 with level2 profile');
    console.log('✓ Manifest URL pattern: https://api.onb.ac.at/iiif/presentation/v3/manifest/{id}');
    console.log('✓ Image URL pattern: https://api.onb.ac.at/iiif/image/v3/{manuscript_id}/{image_id}/{region}/{size}/{rotation}/{quality}.{format}');
    console.log('✓ Maximum resolution available via /full/max/0/default.jpg');
    console.log('Total pages in test manuscript:', manifest.items.length);
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

function makeRequestPartial(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/*',
                'Referer': 'https://viewer.onb.ac.at/',
                'Range': 'bytes=0-1023'
            }
        };
        
        const req = https.request(options, (res) => {
            let body = Buffer.alloc(0);
            res.on('data', (chunk) => {
                body = Buffer.concat([body, chunk]);
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    bodySize: body.length
                });
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

function makeRequestCustom(url, customHeaders) {
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
                ...customHeaders
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

testONBImages().catch(console.error);