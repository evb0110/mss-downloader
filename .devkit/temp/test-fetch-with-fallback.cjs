const https = require('https');
const { execSync } = require('child_process');

// Test the exact fetchWithFallback behavior
async function testFetchWithFallback() {
    console.log('=== Testing fetchWithFallback behavior ===');
    
    const collection = 'incunableBC';
    const itemId = '175331';
    const compoundUrl = `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/${collection}/${itemId}/json`;
    
    console.log('1. Testing direct fetch...');
    try {
        const response = await fetchDirect(compoundUrl);
        console.log(`   Direct fetch status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`   ✅ Direct fetch successful: ${data.page ? data.page.length : 'N/A'} pages`);
        } else {
            console.log(`   ❌ Direct fetch failed: ${response.status}`);
        }
    } catch (error) {
        console.log(`   ❌ Direct fetch error: ${error.message}`);
        console.log(`   Error code: ${error.code}`);
        console.log(`   Error type: ${error.constructor.name}`);
        
        // This is where the fallback should kick in
        console.log('\n2. Testing curl fallback...');
        
        try {
            const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
            const curlCmd = `curl -s -m 30 --retry 2 --retry-delay 1 -H "User-Agent: ${userAgent}" "${compoundUrl}"`;
            const result = execSync(curlCmd, { encoding: 'utf8', timeout: 35000 });
            
            if (result.trim() === '') {
                console.log('   ❌ Curl fallback: Empty response');
            } else {
                console.log('   ✅ Curl fallback: Success');
                console.log(`   Response length: ${result.length}`);
                
                try {
                    const parsed = JSON.parse(result);
                    console.log(`   Pages found: ${parsed.page ? parsed.page.length : 'N/A'}`);
                } catch (e) {
                    console.log('   ❌ JSON parse failed');
                }
            }
        } catch (curlError) {
            console.log(`   ❌ Curl fallback error: ${curlError.message}`);
        }
    }
    
    console.log('\n3. Testing various network conditions...');
    
    // Test with different timeout values
    const testUrls = [
        compoundUrl,
        `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/info.json`,
        'https://mdc.csuc.cat/digital/custom/home'
    ];
    
    for (const url of testUrls) {
        console.log(`\n   Testing: ${url}`);
        
        try {
            const response = await fetchDirectWithTimeout(url, 5000);
            console.log(`   Status: ${response.status}`);
        } catch (error) {
            console.log(`   Error: ${error.message}`);
            console.log(`   Error code: ${error.code}`);
            
            // Check if this would trigger the fallback conditions
            const shouldFallback = error.code === 'ECONNREFUSED' || 
                                 error.code === 'ENOTFOUND' || 
                                 error.code === 'ETIMEDOUT' || 
                                 error.code === 'ENETUNREACH' ||
                                 error.message.includes('timeout') || 
                                 error.message.includes('ECONNREFUSED');
            
            console.log(`   Would trigger fallback: ${shouldFallback}`);
        }
    }
}

function fetchDirect(url, options = {}) {
    return new Promise((resolve, reject) => {
        const requestOptions = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                ...options.headers
            },
            timeout: 30000
        };
        
        const req = https.get(url, requestOptions, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: () => Promise.resolve(data),
                    json: () => Promise.resolve(JSON.parse(data))
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

function fetchDirectWithTimeout(url, timeout) {
    return new Promise((resolve, reject) => {
        const requestOptions = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: timeout
        };
        
        const req = https.get(url, requestOptions, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: () => Promise.resolve(data),
                    json: () => Promise.resolve(JSON.parse(data))
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

testFetchWithFallback().catch(console.error);