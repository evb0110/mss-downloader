const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const testUrls = [
    'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
    'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688'
];

async function testGrazConnection(url) {
    console.log(`\nTesting connection to: ${url}`);
    const startTime = Date.now();
    
    return new Promise((resolve) => {
        const urlParts = new URL(url);
        
        const options = {
            hostname: urlParts.hostname,
            port: 443,
            path: urlParts.pathname,
            method: 'GET',
            headers: {
                'Referer': 'https://unipub.uni-graz.at/',
                'Accept': 'application/json, application/ld+json, image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'de-AT,de;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 120000 // 2 minutes
        };
        
        const req = https.request(options, (res) => {
            const elapsedTime = Date.now() - startTime;
            console.log(`Response received in ${elapsedTime}ms`);
            console.log(`Status: ${res.statusCode}`);
            console.log(`Headers:`, JSON.stringify(res.headers, null, 2));
            
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`Response length: ${data.length} bytes`);
                if (data.length > 0) {
                    console.log(`First 500 chars: ${data.substring(0, 500)}`);
                }
                resolve(true);
            });
        });
        
        req.on('error', (err) => {
            const elapsedTime = Date.now() - startTime;
            console.log(`Error after ${elapsedTime}ms: ${err.message}`);
            console.log(`Error code: ${err.code}`);
            console.log(`Error stack:`, err.stack);
            resolve(false);
        });
        
        req.on('timeout', () => {
            const elapsedTime = Date.now() - startTime;
            console.log(`Request timeout after ${elapsedTime}ms`);
            req.destroy();
            resolve(false);
        });
        
        req.end();
    });
}

async function runTests() {
    console.log('Testing University of Graz connections...');
    console.log('Node version:', process.version);
    console.log('Platform:', process.platform);
    console.log('Current time:', new Date().toISOString());
    
    for (const url of testUrls) {
        await testGrazConnection(url);
    }
    
    // Now test with the actual app
    console.log('\n\nTesting with actual app implementation...');
    
    // Import the service
    const { EnhancedManuscriptDownloaderService } = require('../dist/main/services/EnhancedManuscriptDownloaderService.js');
    const service = new EnhancedManuscriptDownloaderService();
    
    for (const url of testUrls) {
        console.log(`\nParsing URL: ${url}`);
        try {
            const result = await service.parseManuscriptUrl(url);
            console.log('Success:', JSON.stringify(result, null, 2));
        } catch (error) {
            console.log('Error:', error.message);
            console.log('Error stack:', error.stack);
        }
    }
}

runTests().catch(console.error);