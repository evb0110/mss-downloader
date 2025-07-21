const https = require('https');
const fs = require('fs');
const path = require('path');

// Test URLs
const testUrls = [
    'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
    'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688'
];

function fetchWithRetry(url, maxRetries = 3) {
    let retryCount = 0;
    
    const attemptFetch = () => {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            console.log(`\n[Attempt ${retryCount + 1}/${maxRetries}] Fetching: ${url}`);
            
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: 443,
                path: urlObj.pathname,
                method: 'GET',
                headers: {
                    'Referer': 'https://unipub.uni-graz.at/',
                    'Accept': 'application/json, application/ld+json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Connection': 'keep-alive'
                },
                timeout: 60000,
                rejectUnauthorized: false
            };
            
            const req = https.request(options, (res) => {
                console.log(`Status: ${res.statusCode}`);
                const chunks = [];
                
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    const elapsed = Date.now() - startTime;
                    const data = Buffer.concat(chunks).toString();
                    console.log(`Response received in ${elapsed}ms, size: ${data.length} bytes`);
                    resolve({ success: true, data, elapsed });
                });
            });
            
            req.on('error', (error) => {
                const elapsed = Date.now() - startTime;
                console.log(`Error after ${elapsed}ms: ${error.code} - ${error.message}`);
                
                if (error.code === 'ETIMEDOUT' && retryCount < maxRetries - 1) {
                    retryCount++;
                    const backoff = Math.min(1000 * Math.pow(2, retryCount), 10000);
                    console.log(`Retrying in ${backoff}ms...`);
                    setTimeout(() => {
                        attemptFetch().then(resolve).catch(reject);
                    }, backoff);
                } else {
                    reject(error);
                }
            });
            
            req.on('timeout', () => {
                console.log('Socket timeout!');
                req.destroy();
                const error = new Error('Socket timeout');
                error.code = 'ETIMEDOUT';
                req.emit('error', error);
            });
            
            req.end();
        });
    };
    
    return attemptFetch();
}

async function testGrazConnections() {
    console.log('=== Testing University of Graz Connections ===');
    console.log('Testing with retry logic similar to the fix...\n');
    
    for (const url of testUrls) {
        // Extract manuscript ID
        const manuscriptId = url.match(/\/(\d+)$/)?.[1] || 'unknown';
        const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${manuscriptId}/manifest`;
        
        console.log('\n' + '='.repeat(60));
        console.log(`Original URL: ${url}`);
        console.log(`Manifest URL: ${manifestUrl}`);
        
        try {
            const result = await fetchWithRetry(manifestUrl);
            
            if (result.success) {
                // Try to parse as JSON
                try {
                    const manifest = JSON.parse(result.data);
                    const canvasCount = manifest.sequences?.[0]?.canvases?.length || 0;
                    console.log(`✓ SUCCESS: Valid IIIF manifest with ${canvasCount} pages`);
                } catch (e) {
                    console.log(`✗ FAILED: Response is not valid JSON`);
                }
            }
        } catch (error) {
            console.log(`✗ FAILED: ${error.message}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Test completed');
}

testGrazConnections().catch(console.error);