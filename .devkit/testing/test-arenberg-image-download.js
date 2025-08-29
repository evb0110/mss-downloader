#!/usr/bin/env node

// Test downloading discovered Arenberg images
const https = require('https');
const { URL } = require('url');

function fetchDirect(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                ...options.headers
            }
        };

        const req = https.request(requestOptions, (res) => {
            let data = Buffer.alloc(0);
            res.on('data', chunk => data = Buffer.concat([data, chunk]));
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    size: data.length,
                    buffer: data
                });
            });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

async function testArenbergImageDownload() {
    console.log('🖼️  Testing Arenberg image downloads...\n');
    
    const baseUrl = 'https://www.themorgan.org';
    const testUrls = [
        'https://www.themorgan.org/sites/default/files/styles/largest_800_x_800_/public/facsimile/159161/159161v_0017.jpg',
        'https://www.themorgan.org/sites/default/files/facsimile/159161/159161v_0017.jpg'
    ];
    
    for (let i = 0; i < testUrls.length; i++) {
        const url = testUrls[i];
        console.log(`\n${i + 1}️⃣ Testing: ${url}`);
        
        try {
            const startTime = Date.now();
            const response = await fetchDirect(url);
            const elapsed = Date.now() - startTime;
            
            console.log(`   ✅ Status: ${response.status}`);
            console.log(`   📏 Size: ${(response.size / 1024).toFixed(1)}KB`);
            console.log(`   ⏱️  Time: ${elapsed}ms`);
            
            if (response.ok && response.size > 10000) {
                console.log(`   🎉 SUCCESS: Valid image downloaded!`);
            } else if (response.ok && response.size <= 10000) {
                console.log(`   ⚠️  WARNING: Small file size, may be error page`);
            } else {
                console.log(`   ❌ FAILED: ${response.status}`);
            }
            
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
        }
    }
    
    console.log('\n✅ Image download test complete');
}

testArenbergImageDownload().catch(console.error);