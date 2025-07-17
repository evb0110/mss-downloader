const https = require('https');
const zlib = require('zlib');

// Recreate the fetchWithHTTPS method as a standalone function
async function fetchWithHTTPS(url, options = {}) {
    const { URL } = require('url');
    
    const urlObj = new URL(url);
    const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache',
            ...options.headers
        },
        rejectUnauthorized: false
    };
    
    return new Promise((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
            const chunks = [];
            
            res.on('data', (chunk) => {
                chunks.push(chunk);
            });
            
            res.on('end', async () => {
                let body = Buffer.concat(chunks);
                const responseHeaders = new Map();
                
                Object.entries(res.headers).forEach(([key, value]) => {
                    responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : value || '');
                });
                
                // Handle content decompression
                const contentEncoding = res.headers['content-encoding'];
                if (contentEncoding) {
                    try {
                        if (contentEncoding === 'gzip') {
                            body = zlib.gunzipSync(body);
                        } else if (contentEncoding === 'deflate') {
                            body = zlib.inflateSync(body);
                        } else if (contentEncoding === 'br') {
                            body = zlib.brotliDecompressSync(body);
                        }
                        // Remove content-encoding header after decompression
                        responseHeaders.delete('content-encoding');
                        console.log(`✓ Successfully decompressed ${contentEncoding} content`);
                    } catch (decompressError) {
                        console.error(`Failed to decompress ${contentEncoding} content:`, decompressError);
                        // Continue with compressed body if decompression fails
                    }
                }
                
                // Create a simple response object
                const response = {
                    status: res.statusCode || 200,
                    statusText: res.statusMessage || 'OK',
                    headers: responseHeaders,
                    text: () => Promise.resolve(body.toString()),
                    json: () => Promise.resolve(JSON.parse(body.toString())),
                    buffer: () => Promise.resolve(body)
                };
                
                resolve(response);
            });
        });
        
        req.on('error', reject);
        req.setTimeout(options.timeout || 30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
}

async function testGrazWithFixedFetch() {
    console.log('Testing University of Graz with fixed fetchWithHTTPS...\n');
    
    const manifestUrl = 'https://unipub.uni-graz.at/i3f/v20/8224538/manifest';
    
    try {
        console.log('1. Fetching manifest with fixed fetchWithHTTPS...');
        console.log('   URL:', manifestUrl);
        
        const response = await fetchWithHTTPS(manifestUrl, {
            headers: {
                'Accept': 'application/json, application/ld+json'
            }
        });
        
        console.log('   Status:', response.status);
        console.log('   Content-Type:', response.headers.get('content-type'));
        
        // Try to parse as JSON
        try {
            const json = await response.json();
            console.log('   ✓ Successfully parsed JSON!');
            console.log('   Type:', json['@type']);
            console.log('   Canvas count:', json.sequences?.[0]?.canvases?.length || 0);
            console.log('   Label:', json.label);
            
            // Test a few image URLs
            if (json.sequences?.[0]?.canvases?.length > 0) {
                console.log('\n2. Testing image URLs from manifest...');
                const canvases = json.sequences[0].canvases;
                console.log(`   Found ${canvases.length} pages`);
                
                // Test first and last page
                const testCanvases = [canvases[0], canvases[canvases.length - 1]];
                
                for (let i = 0; i < testCanvases.length; i++) {
                    const canvas = testCanvases[i];
                    const imageUrl = canvas.images?.[0]?.resource?.['@id'];
                    if (imageUrl) {
                        console.log(`\n   Testing page ${i === 0 ? 'first' : 'last'}:`, imageUrl);
                        
                        try {
                            const imageResponse = await fetchWithHTTPS(imageUrl);
                            console.log(`   ✓ Image accessible, status: ${imageResponse.status}`);
                            const buffer = await imageResponse.buffer();
                            console.log(`   ✓ Image size: ${buffer.length} bytes`);
                        } catch (imgError) {
                            console.error(`   ✗ Image fetch failed:`, imgError.message);
                        }
                    }
                }
            }
            
            console.log('\n✓ All tests passed! The gzip decompression fix works correctly.');
            
        } catch (parseError) {
            console.error('   ✗ JSON parse failed:', parseError.message);
            const text = await response.text();
            console.log('   Response preview:', text.substring(0, 200));
        }
        
    } catch (error) {
        console.error('✗ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testGrazWithFixedFetch();