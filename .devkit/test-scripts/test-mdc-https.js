const https = require('https');
const fs = require('fs');
const path = require('path');

// Test MDC with native HTTPS module to see if it works better
async function fetchWithHTTPS(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                ...options.headers
            },
            rejectUnauthorized: false,
            timeout: 30000
        };
        
        const req = https.request(requestOptions, (res) => {
            const chunks = [];
            
            res.on('data', (chunk) => {
                chunks.push(chunk);
            });
            
            res.on('end', () => {
                const body = Buffer.concat(chunks);
                const responseHeaders = new Map();
                
                Object.entries(res.headers).forEach(([key, value]) => {
                    responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : value || '');
                });
                
                const response = {
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    headers: responseHeaders,
                    text: () => Promise.resolve(body.toString()),
                    json: () => Promise.resolve(JSON.parse(body.toString())),
                    arrayBuffer: () => Promise.resolve(body.buffer)
                };
                
                resolve(response);
            });
        });
        
        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

async function testMDCWithHTTPS() {
    console.log('Testing MDC Catalonia with native HTTPS module...\n');
    
    const testUrls = [
        'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
        'https://mdc.csuc.cat/utils/getfile/collection/incunableBC/id/175331',
        'https://mdc.csuc.cat/digital/iiif/incunableBC/174519/full/full/0/default.jpg'
    ];
    
    for (const url of testUrls) {
        console.log(`\nTesting: ${url}`);
        console.log('='.repeat(80));
        
        try {
            // Test with Node.js fetch
            console.log('\n1. Testing with Node.js fetch API...');
            const fetchStart = Date.now();
            try {
                const fetchResponse = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    }
                });
                const fetchTime = Date.now() - fetchStart;
                console.log(`✅ Fetch successful: Status ${fetchResponse.status} in ${fetchTime}ms`);
            } catch (fetchError) {
                const fetchTime = Date.now() - fetchStart;
                console.log(`❌ Fetch failed after ${fetchTime}ms: ${fetchError.message}`);
            }
            
            // Test with native HTTPS module
            console.log('\n2. Testing with native HTTPS module...');
            const httpsStart = Date.now();
            try {
                const httpsResponse = await fetchWithHTTPS(url);
                const httpsTime = Date.now() - httpsStart;
                console.log(`✅ HTTPS successful: Status ${httpsResponse.status} in ${httpsTime}ms`);
                
                if (url.includes('default.jpg')) {
                    const buffer = await httpsResponse.arrayBuffer();
                    console.log(`   Image size: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
                }
            } catch (httpsError) {
                const httpsTime = Date.now() - httpsStart;
                console.log(`❌ HTTPS failed after ${httpsTime}ms: ${httpsError.message}`);
            }
            
        } catch (error) {
            console.error(`Unexpected error: ${error.message}`);
        }
    }
    
    // Test downloading multiple images in parallel
    console.log('\n\n3. Testing parallel image downloads...');
    const imageUrls = [
        'https://mdc.csuc.cat/digital/iiif/incunableBC/174519/full/full/0/default.jpg',
        'https://mdc.csuc.cat/digital/iiif/incunableBC/174520/full/full/0/default.jpg',
        'https://mdc.csuc.cat/digital/iiif/incunableBC/174521/full/full/0/default.jpg',
        'https://mdc.csuc.cat/digital/iiif/incunableBC/174522/full/full/0/default.jpg',
        'https://mdc.csuc.cat/digital/iiif/incunableBC/174523/full/full/0/default.jpg'
    ];
    
    const parallelStart = Date.now();
    const results = await Promise.allSettled(
        imageUrls.map(async (url, i) => {
            const response = await fetchWithHTTPS(url);
            const buffer = await response.arrayBuffer();
            return { index: i + 1, size: buffer.byteLength, status: response.status };
        })
    );
    
    const parallelTime = Date.now() - parallelStart;
    console.log(`\nParallel download completed in ${parallelTime}ms`);
    
    results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            const { index, size, status } = result.value;
            console.log(`✅ Image ${index}: ${(size / 1024).toFixed(2)} KB (Status ${status})`);
        } else {
            console.log(`❌ Image ${i + 1}: ${result.reason.message}`);
        }
    });
}

testMDCWithHTTPS().catch(console.error);