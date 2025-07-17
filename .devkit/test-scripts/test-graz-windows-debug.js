const https = require('https');
const http = require('http');
const { Agent } = require('https');

console.log('=== Testing University of Graz Windows Issue ===');
console.log('Test URL: https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538');
console.log('Platform:', process.platform);
console.log('Node version:', process.version);
console.log('');

async function testDirectFetch() {
    console.log('1. Testing direct fetch (Node.js built-in)...');
    try {
        const manifestUrl = 'https://unipub.uni-graz.at/i3f/v20/8224538/manifest';
        console.log('   Manifest URL:', manifestUrl);
        
        const response = await fetch(manifestUrl, {
            headers: {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        console.log('   Status:', response.status);
        console.log('   Headers:', Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
            const text = await response.text();
            console.log('   Response size:', text.length, 'bytes');
            const manifest = JSON.parse(text);
            console.log('   Manifest label:', manifest.label);
            console.log('   ✅ Direct fetch SUCCEEDED');
        } else {
            console.log('   ❌ Direct fetch FAILED with status:', response.status);
        }
    } catch (error) {
        console.log('   ❌ Direct fetch ERROR:', error.message);
        console.log('   Error code:', error.code);
        console.log('   Error type:', error.constructor.name);
    }
    console.log('');
}

async function testHTTPSModule() {
    console.log('2. Testing HTTPS module...');
    const manifestUrl = 'https://unipub.uni-graz.at/i3f/v20/8224538/manifest';
    
    return new Promise((resolve) => {
        const url = new URL(manifestUrl);
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'GET',
            headers: {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            rejectUnauthorized: true  // Try with proper SSL validation first
        };
        
        console.log('   Trying with SSL validation enabled...');
        const req = https.request(options, (res) => {
            console.log('   Status:', res.statusCode);
            console.log('   Headers:', res.headers);
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('   Response size:', data.length, 'bytes');
                if (res.statusCode === 200) {
                    console.log('   ✅ HTTPS module with SSL validation SUCCEEDED');
                } else {
                    console.log('   ❌ HTTPS module with SSL validation FAILED');
                }
                console.log('');
                resolve();
            });
        });
        
        req.on('error', (error) => {
            console.log('   ❌ HTTPS module ERROR:', error.message);
            console.log('   Error code:', error.code);
            
            if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
                error.code === 'CERT_HAS_EXPIRED' ||
                error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
                console.log('   Retrying with SSL validation disabled...');
                
                options.rejectUnauthorized = false;
                const retryReq = https.request(options, (res) => {
                    console.log('   Status:', res.statusCode);
                    
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        console.log('   Response size:', data.length, 'bytes');
                        if (res.statusCode === 200) {
                            console.log('   ✅ HTTPS module without SSL validation SUCCEEDED');
                            console.log('   ⚠️  SSL CERTIFICATE ISSUE DETECTED');
                        } else {
                            console.log('   ❌ HTTPS module without SSL validation FAILED');
                        }
                        console.log('');
                        resolve();
                    });
                });
                
                retryReq.on('error', (retryError) => {
                    console.log('   ❌ HTTPS module retry ERROR:', retryError.message);
                    console.log('');
                    resolve();
                });
                
                retryReq.end();
            } else {
                console.log('');
                resolve();
            }
        });
        
        req.end();
    });
}

async function testWithCustomAgent() {
    console.log('3. Testing fetch with custom HTTPS agent...');
    try {
        const manifestUrl = 'https://unipub.uni-graz.at/i3f/v20/8224538/manifest';
        
        const agent = new Agent({
            rejectUnauthorized: false
        });
        
        const response = await fetch(manifestUrl, {
            agent,
            headers: {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        console.log('   Status:', response.status);
        
        if (response.ok) {
            const text = await response.text();
            console.log('   Response size:', text.length, 'bytes');
            console.log('   ✅ Fetch with custom agent SUCCEEDED');
        } else {
            console.log('   ❌ Fetch with custom agent FAILED');
        }
    } catch (error) {
        console.log('   ❌ Fetch with custom agent ERROR:', error.message);
    }
    console.log('');
}

async function testTimeout() {
    console.log('4. Testing timeout handling...');
    try {
        const manifestUrl = 'https://unipub.uni-graz.at/i3f/v20/8224538/manifest';
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        console.log('   Setting 5 second timeout...');
        const startTime = Date.now();
        
        const response = await fetch(manifestUrl, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        
        console.log('   Response received in:', duration, 'ms');
        console.log('   Status:', response.status);
        
        if (response.ok) {
            console.log('   ✅ Timeout test PASSED');
        } else {
            console.log('   ❌ Timeout test FAILED');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('   ❌ Request TIMED OUT after 5 seconds');
        } else {
            console.log('   ❌ Timeout test ERROR:', error.message);
        }
    }
    console.log('');
}

async function testImageDownload() {
    console.log('5. Testing actual image download...');
    try {
        // Test downloading first page image
        const imageUrl = 'https://unipub.uni-graz.at/download/webcache/2000/8224544';
        console.log('   Image URL:', imageUrl);
        
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        console.log('   Status:', response.status);
        console.log('   Content-Type:', response.headers.get('content-type'));
        
        if (response.ok) {
            const buffer = await response.arrayBuffer();
            console.log('   Image size:', buffer.byteLength, 'bytes');
            console.log('   ✅ Image download SUCCEEDED');
        } else {
            console.log('   ❌ Image download FAILED');
        }
    } catch (error) {
        console.log('   ❌ Image download ERROR:', error.message);
    }
    console.log('');
}

async function runTests() {
    console.log('Starting diagnostic tests...\n');
    
    await testDirectFetch();
    await testHTTPSModule();
    await testWithCustomAgent();
    await testTimeout();
    await testImageDownload();
    
    console.log('=== Diagnostic Summary ===');
    console.log('Platform:', process.platform);
    console.log('If SSL certificate errors occur on Windows, the service may need:');
    console.log('1. Custom HTTPS agent with rejectUnauthorized: false');
    console.log('2. Native HTTPS module instead of fetch');
    console.log('3. Windows-specific certificate handling');
    console.log('4. Electron certificate error bypass');
}

runTests();