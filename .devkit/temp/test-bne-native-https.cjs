const https = require('https');
const { URL } = require('url');

async function testBneWithNativeHttps() {
    console.log('=== Testing BNE with Native HTTPS Module ===');
    
    const manuscriptId = '0000007619';
    const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1&jpeg=true`;
    
    console.log(`Testing URL: ${testUrl}`);
    
    // Parse URL for native HTTPS request
    const url = new URL(testUrl);
    
    const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'HEAD',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        rejectUnauthorized: false  // SSL bypass
    };
    
    console.log('\n1. Testing with native HTTPS module...');
    
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            console.log(`Status: ${res.statusCode}`);
            console.log(`Content-Type: ${res.headers['content-type']}`);
            console.log(`Content-Length: ${res.headers['content-length']}`);
            
            if (res.statusCode === 200 && res.headers['content-type']?.includes('image')) {
                console.log('✓ BNE endpoint is accessible with native HTTPS');
                resolve('success');
            } else {
                console.log('✗ BNE endpoint is not returning valid image');
                resolve('no-image');
            }
        });
        
        req.on('error', (error) => {
            console.log(`✗ Error with native HTTPS: ${error.message}`);
            reject(error);
        });
        
        req.setTimeout(10000, () => {
            console.log('✗ Request timed out');
            req.destroy();
            reject(new Error('Timeout'));
        });
        
        req.end();
    });
}

// Test multiple pages
async function testMultiplePages() {
    console.log('\n2. Testing multiple pages with native HTTPS...');
    
    const manuscriptId = '0000007619';
    
    for (let page = 1; page <= 5; page++) {
        const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&jpeg=true`;
        const url = new URL(testUrl);
        
        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            rejectUnauthorized: false
        };
        
        try {
            const result = await new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    const isValid = res.statusCode === 200 && res.headers['content-type']?.includes('image');
                    console.log(`Page ${page}: Status ${res.statusCode}, Content-Type: ${res.headers['content-type']}`);
                    
                    if (isValid) {
                        console.log(`  ✓ Page ${page} is valid`);
                        resolve('valid');
                    } else {
                        console.log(`  ✗ Page ${page} is not valid`);
                        resolve('invalid');
                    }
                });
                
                req.on('error', (error) => {
                    console.log(`  ✗ Page ${page}: ${error.message}`);
                    reject(error);
                });
                
                req.setTimeout(5000, () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
                
                req.end();
            });
        } catch (error) {
            console.log(`  ✗ Page ${page}: ${error.message}`);
        }
    }
}

async function main() {
    try {
        await testBneWithNativeHttps();
        await testMultiplePages();
        console.log('\n=== Native HTTPS Test Complete ===');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

main();