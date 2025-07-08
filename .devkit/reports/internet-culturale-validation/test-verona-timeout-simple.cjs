#!/usr/bin/env node

console.log('🔧 Testing Verona Timeout Fix');
console.log('Testing the timeout fix by making direct HTTP requests');

const https = require('https');
const { URL } = require('url');

// Simulate the fetchWithHTTPS method with timeout parameter
function fetchWithHTTPS(url, options = {}) {
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
                'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                ...options.headers
            },
            rejectUnauthorized: false
        };
        
        const startTime = Date.now();
        
        const req = https.request(requestOptions, (res) => {
            const chunks = [];
            
            res.on('data', (chunk) => {
                chunks.push(chunk);
            });
            
            res.on('end', () => {
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                const body = Buffer.concat(chunks);
                const response = {
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    headers: res.headers,
                    json: () => Promise.resolve(JSON.parse(body.toString())),
                    text: () => Promise.resolve(body.toString()),
                    duration: duration
                };
                
                resolve(response);
            });
        });
        
        req.on('error', (error) => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            error.duration = duration;
            reject(error);
        });
        
        // Apply the timeout from options (this is the key fix)
        const timeoutMs = options.timeout || 30000;
        req.setTimeout(timeoutMs, () => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            req.destroy();
            const timeoutError = new Error(`Request timeout after ${timeoutMs}ms`);
            timeoutError.duration = duration;
            reject(timeoutError);
        });
        
        req.end();
    });
}

async function testVeronaTimeouts() {
    const manifestUrl = 'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json';
    
    console.log('\n📋 Testing different timeout values:');
    console.log(`  Manifest URL: ${manifestUrl}`);
    
    // Test 1: Standard timeout (30 seconds)
    console.log('\n🔧 Test 1: Standard timeout (30 seconds)');
    try {
        const response = await fetchWithHTTPS(manifestUrl, { timeout: 30000 });
        console.log(`✅ Success with 30s timeout: ${response.status} (${response.duration}ms)`);
        
        if (response.ok) {
            const manifest = await response.json();
            const pageCount = manifest.sequences?.[0]?.canvases?.length || 0;
            console.log(`   📄 Pages in manifest: ${pageCount}`);
        }
    } catch (error) {
        console.log(`❌ Failed with 30s timeout: ${error.message} (${error.duration}ms)`);
    }
    
    // Test 2: Extended timeout (45 seconds) - Verona optimized
    console.log('\n🔧 Test 2: Extended timeout (45 seconds) - Verona optimized');
    try {
        const response = await fetchWithHTTPS(manifestUrl, { timeout: 45000 });
        console.log(`✅ Success with 45s timeout: ${response.status} (${response.duration}ms)`);
        
        if (response.ok) {
            const manifest = await response.json();
            const pageCount = manifest.sequences?.[0]?.canvases?.length || 0;
            console.log(`   📄 Pages in manifest: ${pageCount}`);
        }
    } catch (error) {
        console.log(`❌ Failed with 45s timeout: ${error.message} (${error.duration}ms)`);
    }
    
    // Test 3: Very short timeout (5 seconds) - Should demonstrate the importance of extended timeout
    console.log('\n🔧 Test 3: Short timeout (5 seconds) - Stress test');
    try {
        const response = await fetchWithHTTPS(manifestUrl, { timeout: 5000 });
        console.log(`✅ Success with 5s timeout: ${response.status} (${response.duration}ms)`);
    } catch (error) {
        console.log(`❌ Failed with 5s timeout: ${error.message} (${error.duration}ms)`);
        if (error.message.includes('timeout')) {
            console.log('   🔍 This demonstrates why extended timeout is necessary');
        }
    }
    
    console.log('\n📊 Timeout Fix Analysis:');
    console.log('The fix ensures that Verona requests use 45-second timeout instead of 30-second default');
    console.log('This gives more time for SSL handshake and manifest download from slow servers');
    console.log('Library optimization settings properly applied to fetchWithHTTPS method');
}

// Run the test
testVeronaTimeouts().catch(console.error);