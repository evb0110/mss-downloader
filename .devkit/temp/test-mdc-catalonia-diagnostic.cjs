const https = require('https');
const { execSync } = require('child_process');

async function testMDCCataloniaURL() {
    console.log('=== MDC Catalonia Diagnostic Test ===');
    
    const originalUrl = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';
    console.log('Testing original URL:', originalUrl);
    
    // Extract collection and item ID from URL
    const urlMatch = originalUrl.match(/mdc\.csuc\.cat\/digital\/collection\/([^/]+)\/id\/(\d+)(?:\/rec\/(\d+))?/);
    if (!urlMatch) {
        console.error('Could not extract collection and item ID from URL');
        return;
    }
    
    const collection = urlMatch[1];
    const itemId = urlMatch[2];
    console.log(`Extracted: collection=${collection}, itemId=${itemId}`);
    
    // Test URLs that the implementation would use
    const testUrls = [
        // Original URL - test if it loads
        originalUrl,
        // Compound object API
        `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/${collection}/${itemId}/json`,
        // IIIF info endpoint
        `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/info.json`,
        // Base domain test
        'https://mdc.csuc.cat/',
        // Direct test - alternative compound object endpoint
        `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetItemInfo/${collection}/${itemId}/json`
    ];
    
    for (const url of testUrls) {
        console.log(`\n--- Testing: ${url} ---`);
        
        // Test with curl first (most reliable)
        try {
            console.log('Testing with curl...');
            const curlCmd = `curl -s -m 30 --retry 2 --retry-delay 1 -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${url}"`;
            const result = execSync(curlCmd, { encoding: 'utf8', timeout: 35000 });
            
            if (result.trim() === '') {
                console.log('❌ CURL: Empty response');
            } else {
                console.log('✅ CURL: Success');
                console.log('Response length:', result.length);
                
                // Try to parse as JSON if it looks like JSON
                if (result.trim().startsWith('{') || result.trim().startsWith('[')) {
                    try {
                        const parsed = JSON.parse(result);
                        console.log('✅ JSON parse: Success');
                        console.log('Response keys:', Object.keys(parsed));
                        if (parsed.code && parsed.message) {
                            console.log('⚠️  API Error:', parsed.code, parsed.message);
                        }
                    } catch (e) {
                        console.log('❌ JSON parse failed:', e.message);
                    }
                } else {
                    console.log('Response preview:', result.substring(0, 200) + '...');
                }
            }
        } catch (error) {
            console.log('❌ CURL failed:', error.message);
        }
        
        // Test with Node.js https module
        try {
            console.log('Testing with Node.js https...');
            const response = await testWithHttps(url);
            console.log('✅ HTTPS: Success');
            console.log('Status:', response.status);
            console.log('Headers:', response.headers);
            console.log('Response length:', response.data.length);
        } catch (error) {
            console.log('❌ HTTPS failed:', error.message);
        }
    }
    
    console.log('\n=== Additional DNS/Network Tests ===');
    
    // Test DNS resolution
    try {
        console.log('Testing DNS resolution...');
        const dnsResult = execSync('nslookup mdc.csuc.cat', { encoding: 'utf8' });
        console.log('✅ DNS Resolution works');
        console.log(dnsResult);
    } catch (error) {
        console.log('❌ DNS Resolution failed:', error.message);
    }
    
    // Test basic connectivity
    try {
        console.log('Testing basic connectivity...');
        const pingResult = execSync('ping -c 3 mdc.csuc.cat', { encoding: 'utf8' });
        console.log('✅ Ping works');
        console.log(pingResult);
    } catch (error) {
        console.log('❌ Ping failed:', error.message);
    }
}

function testWithHttps(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 30000
        };
        
        const req = https.get(url, options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data: data
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

testMDCCataloniaURL().catch(console.error);