#!/usr/bin/env node

/**
 * Direct Toronto connectivity test
 */

const https = require('https');

const testUrls = [
    'https://iiif.library.utoronto.ca/presentation/v2/fisher:F10025/manifest',
    'https://iiif.library.utoronto.ca/presentation/v2/fisher%3AF10025/manifest',
    'https://iiif.library.utoronto.ca/presentation/v3/fisher:F10025/manifest',
    'https://collections.library.utoronto.ca/iiif/fisher:F10025/manifest'
];

async function testUrl(url) {
    return new Promise((resolve) => {
        console.log(`\nTesting: ${url}`);
        
        const startTime = Date.now();
        
        https.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        }, (res) => {
            const elapsed = Date.now() - startTime;
            console.log(`  Status: ${res.statusCode} (${elapsed}ms)`);
            console.log(`  Content-Type: ${res.headers['content-type']}`);
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (data.includes('"@context"')) {
                    console.log(`  ✓ Valid IIIF manifest found`);
                    console.log(`  First 200 chars: ${data.substring(0, 200)}...`);
                } else {
                    console.log(`  ✗ Not a valid IIIF manifest`);
                }
                resolve();
            });
        }).on('error', (err) => {
            const elapsed = Date.now() - startTime;
            console.log(`  ✗ Error after ${elapsed}ms: ${err.message}`);
            resolve();
        }).on('timeout', () => {
            console.log(`  ✗ Request timeout`);
            resolve();
        });
    });
}

(async () => {
    console.log('Toronto Library Direct Connectivity Test');
    console.log('=' + '='.repeat(50));
    
    for (const url of testUrls) {
        await testUrl(url);
    }
    
    console.log('\nTest complete.');
})();