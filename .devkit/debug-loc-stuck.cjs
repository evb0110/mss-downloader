const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

const fetchFn = (url, options = {}) => {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                ...options.headers
            },
            timeout: 30000
        };

        https.get(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: async () => data,
                    json: async () => JSON.parse(data)
                });
            });
        }).on('error', reject);
    });
};

async function debugLOCStuck() {
    console.log('=== Library of Congress Debug Analysis ===\n');
    
    const loader = new SharedManifestLoaders(fetchFn);
    const url = 'https://www.loc.gov/item/2010414164/';
    
    try {
        console.log('Testing problematic LOC manuscript:', url);
        console.log('Debugging manifest extraction...\n');
        
        // First, get the manifest to see the structure
        const result = await loader.getManifestForLibrary('loc', url);
        
        console.log(`Found ${result.images.length} pages total`);
        console.log('First few image URLs:');
        
        for (let i = 0; i < Math.min(5, result.images.length); i++) {
            console.log(`Page ${i + 1}: ${result.images[i].url}`);
        }
        
        console.log('\nLast few image URLs:');
        const start = Math.max(0, result.images.length - 3);
        for (let i = start; i < result.images.length; i++) {
            console.log(`Page ${i + 1}: ${result.images[i].url}`);
        }
        
        // Test downloading a few strategic pages to identify where it might get stuck
        console.log('\n=== Testing Download Points ===');
        
        const testPages = [
            0, // First page
            Math.floor(result.images.length * 0.25), // 25%
            Math.floor(result.images.length * 0.5),  // 50% - likely stuck point
            Math.floor(result.images.length * 0.75), // 75%
            result.images.length - 1 // Last page
        ];
        
        for (const pageIndex of testPages) {
            if (pageIndex < result.images.length) {
                const image = result.images[pageIndex];
                console.log(`\nTesting page ${pageIndex + 1}/${result.images.length}: ${image.label}`);
                console.log(`URL: ${image.url}`);
                
                try {
                    // Test with short timeout to see if this page is problematic
                    const testResponse = await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Error('TIMEOUT'));
                        }, 10000); // 10 second timeout
                        
                        https.get(image.url, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0',
                                'Referer': 'https://www.loc.gov/'
                            }
                        }, (res) => {
                            clearTimeout(timeout);
                            let size = 0;
                            res.on('data', chunk => size += chunk.length);
                            res.on('end', () => resolve({ status: res.statusCode, size }));
                        }).on('error', (err) => {
                            clearTimeout(timeout);
                            reject(err);
                        });
                    });
                    
                    console.log(`✅ SUCCESS: Status ${testResponse.status}, Size: ${(testResponse.size / 1024 / 1024).toFixed(2)} MB`);
                    
                } catch (error) {
                    console.log(`❌ FAILED: ${error.message}`);
                    if (error.message === 'TIMEOUT') {
                        console.log(`🔍 POTENTIAL STUCK POINT: Page ${pageIndex + 1} timed out`);
                    }
                }
            }
        }
        
        console.log('\n=== Analysis Complete ===');
        console.log('Check above for any TIMEOUT or FAILED entries to identify stuck points');
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

debugLOCStuck().catch(console.error);