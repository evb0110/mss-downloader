const https = require('https');
const http = require('http');
const { URL } = require('url');
const { execSync } = require('child_process');

async function testMDCCatalonia() {
    const testUrl = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';
    console.log('Testing MDC Catalonia URL:', testUrl);
    
    try {
        // Test 1: Direct fetch using Node.js
        console.log('\n--- Test 1: Direct Node.js HTTPS request ---');
        await testDirectFetch(testUrl);
        
        // Test 2: Try with curl
        console.log('\n--- Test 2: Curl request ---');
        testCurl(testUrl);
        
        // Test 3: Try IIIF manifest
        console.log('\n--- Test 3: IIIF Manifest ---');
        await testIIIFManifest();
        
        // Test 4: Try direct image URL
        console.log('\n--- Test 4: Direct Image URL ---');
        await testDirectImage();
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

async function testDirectFetch(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 30000,
            rejectUnauthorized: false // Try bypassing SSL verification
        };
        
        console.log('Connecting to:', options.hostname);
        
        const req = https.request(options, (res) => {
            console.log('Status Code:', res.statusCode);
            console.log('Headers:', JSON.stringify(res.headers, null, 2));
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('Response length:', data.length);
                if (data.length > 0) {
                    console.log('First 500 chars:', data.substring(0, 500));
                }
                resolve();
            });
        });
        
        req.on('error', (error) => {
            console.error('Request error:', error.code, error.message);
            if (error.code === 'ECONNREFUSED') {
                console.log('Connection refused - server might be down');
            } else if (error.code === 'ETIMEDOUT') {
                console.log('Connection timed out - server might be slow or blocking');
            } else if (error.code === 'ENOTFOUND') {
                console.log('DNS lookup failed - hostname not found');
            }
            reject(error);
        });
        
        req.on('timeout', () => {
            console.error('Request timeout after 30 seconds');
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

function testCurl(url) {
    try {
        console.log('Testing with curl...');
        
        // First try basic curl
        try {
            const result = execSync(`curl -I -m 10 --connect-timeout 10 "${url}"`, { encoding: 'utf8' });
            console.log('Curl HEAD response:', result);
        } catch (curlError) {
            console.error('Curl HEAD failed:', curlError.message);
        }
        
        // Try with SSL bypass
        try {
            const result = execSync(`curl -k -I -m 10 --connect-timeout 10 "${url}"`, { encoding: 'utf8' });
            console.log('Curl with SSL bypass:', result);
        } catch (curlError) {
            console.error('Curl with SSL bypass failed:', curlError.message);
        }
        
        // Try to get first few bytes
        try {
            const result = execSync(`curl -s -m 10 --connect-timeout 10 --max-filesize 1000 "${url}" | head -c 500`, { encoding: 'utf8' });
            console.log('First 500 bytes:', result);
        } catch (curlError) {
            console.error('Curl content failed:', curlError.message);
        }
        
    } catch (error) {
        console.error('Curl test failed:', error);
    }
}

async function testIIIFManifest() {
    // Based on the code pattern, try to fetch compound object XML
    const compoundUrl = 'https://mdc.csuc.cat/utils/getfile/collection/incunableBC/id/175331/filename/175332';
    console.log('Testing compound object URL:', compoundUrl);
    
    try {
        const result = execSync(`curl -s -m 10 "${compoundUrl}" | head -c 1000`, { encoding: 'utf8' });
        console.log('Compound object response:', result);
    } catch (error) {
        console.error('Compound object fetch failed:', error.message);
    }
}

async function testDirectImage() {
    // Try a direct IIIF image URL based on the pattern in code
    const imageUrl = 'https://mdc.csuc.cat/digital/iiif/incunableBC/175332/full/full/0/default.jpg';
    console.log('Testing direct image URL:', imageUrl);
    
    try {
        const result = execSync(`curl -I -m 10 "${imageUrl}"`, { encoding: 'utf8' });
        console.log('Direct image response:', result);
    } catch (error) {
        console.error('Direct image fetch failed:', error.message);
    }
}

// Run the test
testMDCCatalonia();