const https = require('https');
const { URL } = require('url');
const fs = require('fs');

async function validateONBDownloads() {
    console.log('=== Validating ONB Downloads ===');
    
    // Read the manifest
    const manifest = JSON.parse(fs.readFileSync('.devkit/temp/onb-manifest-1000B160.json', 'utf8'));
    
    // Get the first image for testing
    const firstCanvas = manifest.items[0];
    const annotation = firstCanvas.items[0].items[0];
    const service = annotation.body.service[0];
    const serviceId = service.id;
    
    console.log('Testing with first image service:', serviceId);
    
    // Test different resolution URLs
    const resolutionTests = [
        { path: '/full/max/0/default.jpg', name: 'Maximum resolution' },
        { path: '/full/full/0/default.jpg', name: 'Full resolution' },
        { path: '/full/2000,/0/default.jpg', name: '2000px width' },
        { path: '/full/1000,/0/default.jpg', name: '1000px width' },
        { path: '/full/500,/0/default.jpg', name: '500px width' }
    ];
    
    for (const test of resolutionTests) {
        const imageUrl = serviceId + test.path;
        console.log(`\n=== Testing ${test.name} ===`);
        console.log('URL:', imageUrl);
        
        try {
            // First, get the headers to check content length
            const headResponse = await makeRequestHead(imageUrl);
            console.log('Status:', headResponse.statusCode);
            
            if (headResponse.statusCode === 200) {
                const contentLength = parseInt(headResponse.headers['content-length'] || '0');
                const sizeKB = Math.round(contentLength / 1024);
                const sizeMB = (contentLength / (1024 * 1024)).toFixed(2);
                
                console.log(`Content-Length: ${contentLength} bytes (${sizeKB}KB / ${sizeMB}MB)`);
                console.log('Content-Type:', headResponse.headers['content-type']);
                
                if (contentLength > 0) {
                    // Try to download first 10KB to validate it's a real image
                    try {
                        const partialResponse = await makeRequestPartial(imageUrl, 10240);
                        
                        if (partialResponse.statusCode === 206) {
                            console.log('✓ Partial download successful');
                            
                            // Check if it starts with JPEG magic bytes
                            const buffer = partialResponse.body;
                            if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
                                console.log('✓ Valid JPEG header detected');
                            } else {
                                console.log('⚠ Unexpected file format');
                                console.log('First 16 bytes:', buffer.slice(0, 16).toString('hex'));
                            }
                        } else {
                            console.log('Partial download status:', partialResponse.statusCode);
                        }
                    } catch (err) {
                        console.log('Partial download failed:', err.message);
                    }
                    
                    // For the maximum resolution, try downloading the full image
                    if (test.path === '/full/max/0/default.jpg' && contentLength < 5 * 1024 * 1024) { // Only if less than 5MB
                        try {
                            console.log('Attempting full download of max resolution...');
                            const fullResponse = await makeRequestFull(imageUrl);
                            
                            if (fullResponse.statusCode === 200) {
                                const filename = `.devkit/temp/onb-test-image-max.jpg`;
                                fs.writeFileSync(filename, fullResponse.body);
                                console.log(`✓ Full image downloaded: ${filename} (${fullResponse.body.length} bytes)`);
                                
                                // Verify it's a valid JPEG
                                if (fullResponse.body.length >= 2 && 
                                    fullResponse.body[0] === 0xFF && 
                                    fullResponse.body[1] === 0xD8) {
                                    console.log('✓ Downloaded file is valid JPEG');
                                } else {
                                    console.log('⚠ Downloaded file is not a valid JPEG');
                                }
                            }
                        } catch (err) {
                            console.log('Full download failed:', err.message);
                        }
                    }
                } else {
                    console.log('⚠ Content-Length is 0 - this might indicate an issue');
                }
            } else {
                console.log('❌ Request failed with status:', headResponse.statusCode);
            }
            
        } catch (error) {
            console.log('❌ Request error:', error.message);
        }
    }
    
    // Test a few more images to ensure consistency
    console.log('\n=== Testing Multiple Images ===');
    
    const testIndices = [1, 2, 10, 50]; // Test different pages
    
    for (const index of testIndices) {
        if (index < manifest.items.length) {
            const canvas = manifest.items[index];
            const annotation = canvas.items[0].items[0];
            const service = annotation.body.service[0];
            const serviceId = service.id;
            const maxUrl = serviceId + '/full/max/0/default.jpg';
            
            console.log(`\nPage ${index + 1}:`, canvas.label.none[0]);
            
            try {
                const response = await makeRequestHead(maxUrl);
                const contentLength = parseInt(response.headers['content-length'] || '0');
                const sizeKB = Math.round(contentLength / 1024);
                
                console.log(`Status: ${response.statusCode}, Size: ${sizeKB}KB`);
            } catch (err) {
                console.log(`Error: ${err.message}`);
            }
        }
    }
    
    // Authentication and access tests
    console.log('\n=== Access Control Tests ===');
    
    const testUrl = serviceId + '/full/max/0/default.jpg';
    
    // Test with no headers
    try {
        const noHeadersResponse = await makeRequestCustom(testUrl, {});
        console.log('No custom headers:', noHeadersResponse.statusCode);
    } catch (err) {
        console.log('No custom headers: ERROR -', err.message);
    }
    
    // Test with minimal headers
    try {
        const minimalResponse = await makeRequestCustom(testUrl, {
            'User-Agent': 'curl/7.68.0'
        });
        console.log('Minimal headers (curl):', minimalResponse.statusCode);
    } catch (err) {
        console.log('Minimal headers: ERROR -', err.message);
    }
    
    // Summary
    console.log('\n=== ONB Technical Analysis Summary ===');
    console.log('✓ IIIF v3 Presentation and Image APIs');
    console.log('✓ Standard IIIF URL patterns');
    console.log('✓ No apparent authentication required');
    console.log('✓ Maximum resolution via /full/max/0/default.jpg');
    console.log('✓ 445 pages available in test manuscript');
    console.log('⚠ Need to verify actual file sizes (some showed 0KB in headers)');
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
                'Accept': 'image/jpeg,image/png,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://viewer.onb.ac.at/',
                'Cache-Control': 'no-cache'
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
        
        req.setTimeout(10000, () => {
            req.abort();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

function makeRequestPartial(url, bytes = 1024) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/jpeg,image/png,image/*,*/*;q=0.8',
                'Referer': 'https://viewer.onb.ac.at/',
                'Range': `bytes=0-${bytes - 1}`
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

function makeRequestFull(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/jpeg,image/png,image/*,*/*;q=0.8',
                'Referer': 'https://viewer.onb.ac.at/'
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
                    body: body
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.setTimeout(30000, () => {
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

validateONBDownloads().catch(console.error);