const https = require('https');

// Simulate the exact implementation from the service
async function testBneImplementation() {
    console.log('=== Testing BNE Implementation Debug ===');
    
    const manuscriptId = '0000007619';
    console.log(`Testing manuscript ID: ${manuscriptId}`);
    
    // Test the exact logic from loadBneManifest
    const pageLinks = [];
    let consecutiveFailures = 0;
    
    console.log('Starting page discovery...');
    
    // Test the fetchDirect equivalent with native HTTPS
    async function fetchDirectNative(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            
            const httpsOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    ...options.headers
                },
                rejectUnauthorized: false
            };
            
            const req = https.request(httpsOptions, (res) => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    headers: {
                        get: (name) => res.headers[name.toLowerCase()]
                    }
                });
            });
            
            req.on('error', reject);
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
            
            req.end();
        });
    }
    
    // Test page discovery logic
    for (let page = 1; page <= 20; page++) {
        const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&jpeg=true`;
        
        try {
            console.log(`Testing page ${page}...`);
            const response = await fetchDirectNative(testUrl, { method: 'HEAD' });
            
            console.log(`  Status: ${response.status}`);
            console.log(`  Content-Type: ${response.headers.get('content-type')}`);
            
            if (response.ok && response.headers.get('content-type')?.includes('image')) {
                pageLinks.push(testUrl);
                consecutiveFailures = 0;
                console.log(`  ✓ Found BNE page ${page}`);
            } else {
                consecutiveFailures++;
                console.log(`  ✗ Page ${page} not found (consecutive failures: ${consecutiveFailures})`);
                
                if (consecutiveFailures >= 5) {
                    console.log(`  Stopping page discovery after ${consecutiveFailures} consecutive failures`);
                    break;
                }
            }
        } catch (error) {
            consecutiveFailures++;
            console.log(`  ✗ Page ${page} error: ${error.message} (consecutive failures: ${consecutiveFailures})`);
            
            if (consecutiveFailures >= 5) {
                console.log(`  Stopping page discovery after ${consecutiveFailures} consecutive failures`);
                break;
            }
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n=== BNE Discovery Results ===`);
    console.log(`Total pages found: ${pageLinks.length}`);
    
    if (pageLinks.length === 0) {
        console.log('❌ No pages found for this BNE manuscript');
        return false;
    } else {
        console.log('✅ BNE manuscript discovery completed successfully');
        console.log('Found pages:');
        pageLinks.forEach((link, index) => {
            console.log(`  ${index + 1}: ${link}`);
        });
        return true;
    }
}

testBneImplementation().catch(console.error);