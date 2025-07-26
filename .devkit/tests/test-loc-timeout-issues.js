const fetch = require('node-fetch');
const https = require('https');

async function testLocManifests() {
    console.log('=== TESTING LIBRARY OF CONGRESS TIMEOUT ISSUES ===\n');
    
    const testUrls = [
        'https://www.loc.gov/item/2021667775/',
        'https://www.loc.gov/item/2021667776/',
        'https://www.loc.gov/item/19005901/'
    ];
    
    for (const url of testUrls) {
        console.log(`\nTesting: ${url}`);
        const manifestUrl = url.endsWith('/') ? url + 'manifest.json' : url + '/manifest.json';
        console.log(`Manifest URL: ${manifestUrl}`);
        
        // Test 1: Simple fetch with timeout tracking
        console.log('\nTest 1: Direct fetch...');
        const startTime = Date.now();
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes
            
            const response = await fetch(manifestUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json, application/ld+json'
                }
            });
            
            clearTimeout(timeoutId);
            const elapsed = Date.now() - startTime;
            
            console.log(`  Status: ${response.status}`);
            console.log(`  Time: ${elapsed}ms`);
            console.log(`  Content-Type: ${response.headers.get('content-type')}`);
            console.log(`  Content-Length: ${response.headers.get('content-length')}`);
            
            if (response.ok) {
                const text = await response.text();
                console.log(`  Response size: ${text.length} bytes`);
                
                // Try to parse as JSON
                try {
                    const manifest = JSON.parse(text);
                    const pageCount = manifest.sequences?.[0]?.canvases?.length || 
                                     manifest.items?.length || 0;
                    console.log(`  Manifest type: ${manifest['@type'] || manifest.type || 'unknown'}`);
                    console.log(`  Page count: ${pageCount}`);
                } catch (err) {
                    console.log(`  Not valid JSON: ${err.message}`);
                }
            }
        } catch (err) {
            const elapsed = Date.now() - startTime;
            console.log(`  Error after ${elapsed}ms: ${err.message}`);
        }
        
        // Test 2: Check with Node.js https module
        console.log('\nTest 2: Node.js https module...');
        await testWithHttps(manifestUrl);
        
        // Test 3: Check response headers without body
        console.log('\nTest 3: HEAD request...');
        try {
            const response = await fetch(manifestUrl, { method: 'HEAD' });
            console.log(`  Status: ${response.status}`);
            console.log(`  Content-Length: ${response.headers.get('content-length')}`);
        } catch (err) {
            console.log(`  HEAD request failed: ${err.message}`);
        }
    }
    
    console.log('\n=== ANALYSIS ===');
    console.log('The timeout issues may be due to:');
    console.log('1. Large manifest files taking too long to download');
    console.log('2. Server rate limiting or slow response times');
    console.log('3. Network issues specific to certain manifest IDs');
}

async function testWithHttps(url) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        }, (res) => {
            const elapsed = Date.now() - startTime;
            console.log(`  Status: ${res.statusCode}`);
            console.log(`  Initial response time: ${elapsed}ms`);
            
            let data = '';
            res.on('data', chunk => {
                data += chunk;
                if (data.length % 100000 === 0) {
                    console.log(`  Downloaded: ${(data.length / 1024).toFixed(0)}KB...`);
                }
            });
            
            res.on('end', () => {
                const totalElapsed = Date.now() - startTime;
                console.log(`  Total time: ${totalElapsed}ms`);
                console.log(`  Total size: ${(data.length / 1024).toFixed(0)}KB`);
                resolve();
            });
        }).on('error', (err) => {
            console.log(`  Error: ${err.message}`);
            resolve();
        });
    });
}

testLocManifests().catch(console.error);