const https = require('https');

// Test improved BNE implementation that uses GET requests instead of HEAD
function createCustomFetch() {
    const httpsAgent = new https.Agent({
        rejectUnauthorized: false
    });
    
    return async function customFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            
            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    ...options.headers
                },
                agent: httpsAgent
            };
            
            const req = https.request(requestOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        headers: new Map(Object.entries(res.headers)),
                        text: () => Promise.resolve(data),
                        json: () => Promise.resolve(JSON.parse(data))
                    });
                });
            });
            
            req.on('error', (err) => {
                reject(err);
            });
            
            req.end();
        });
    };
}

// Test improved BNE page discovery that uses GET requests for validation
async function testBneImprovedImplementation() {
    console.log('Testing improved BNE page discovery implementation...');
    
    const customFetch = createCustomFetch();
    const originalUrl = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    
    // Extract manuscript ID
    const idMatch = originalUrl.match(/[?&]id=(\d+)/);
    if (!idMatch) {
        console.error('Could not extract manuscript ID from BNE URL');
        return;
    }
    
    const manuscriptId = idMatch[1];
    console.log(`Manuscript ID: ${manuscriptId}`);
    
    // Improved page discovery using GET requests with size checking
    const pageLinks = [];
    let consecutiveFailures = 0;
    
    console.log('Discovering BNE manuscript pages with improved method...');
    
    const startTime = Date.now();
    
    for (let page = 1; page <= 200; page++) {
        const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&jpeg=true`;
        
        try {
            const response = await customFetch(testUrl);
            
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                const contentLength = response.headers.get('content-length');
                
                if (contentType?.includes('image')) {
                    // Check if the response is a valid image by checking content length
                    const responseSize = parseInt(contentLength || '0', 10);
                    
                    if (responseSize > 1024) { // Minimum valid image size
                        pageLinks.push(testUrl);
                        consecutiveFailures = 0;
                        console.log(`✓ Found BNE page ${page} (${responseSize} bytes)`);
                    } else {
                        console.log(`✗ BNE page ${page} too small (${responseSize} bytes) - likely error page`);
                        consecutiveFailures++;
                    }
                } else {
                    console.log(`✗ BNE page ${page} invalid content-type: ${contentType}`);
                    consecutiveFailures++;
                }
            } else {
                console.log(`✗ BNE page ${page} HTTP error: ${response.status}`);
                consecutiveFailures++;
            }
            
            if (consecutiveFailures >= 5) {
                console.log(`Stopping page discovery after ${consecutiveFailures} consecutive failures`);
                break;
            }
            
        } catch (error) {
            console.log(`✗ BNE page ${page} error: ${error.message}`);
            consecutiveFailures++;
            
            if (consecutiveFailures >= 5) {
                console.log(`Stopping page discovery after ${consecutiveFailures} consecutive failures`);
                break;
            }
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const endTime = Date.now();
    const discoveryTime = (endTime - startTime) / 1000;
    
    console.log(`\nBNE page discovery completed in ${discoveryTime}s:`);
    console.log(`✓ Found ${pageLinks.length} pages`);
    console.log(`✓ Manuscript ID: ${manuscriptId}`);
    console.log(`✓ Total pages: ${pageLinks.length}`);
    console.log(`✓ First page: ${pageLinks[0] || 'None'}`);
    console.log(`✓ Last page: ${pageLinks[pageLinks.length - 1] || 'None'}`);
    
    // Test maximum resolution discovery
    console.log('\nTesting maximum resolution options...');
    
    const resolutionTests = [
        { param: 'jpeg=true', description: 'Standard JPEG' },
        { param: 'jpeg=true&size=full', description: 'Full size JPEG' },
        { param: 'jpeg=true&size=max', description: 'Maximum size JPEG' },
        { param: 'jpeg=true&quality=90', description: 'High quality JPEG' },
        { param: 'jpeg=true&dpi=300', description: 'High DPI JPEG' }
    ];
    
    for (const test of resolutionTests) {
        const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1&${test.param}`;
        
        try {
            const response = await customFetch(testUrl, { method: 'HEAD' });
            
            if (response.ok && response.headers.get('content-type')?.includes('image')) {
                const contentLength = response.headers.get('content-length');
                const responseSize = parseInt(contentLength || '0', 10);
                console.log(`✓ ${test.description}: ${responseSize} bytes`);
            } else {
                console.log(`✗ ${test.description}: Failed (${response.status})`);
            }
        } catch (error) {
            console.log(`✗ ${test.description}: Error - ${error.message}`);
        }
    }
    
    return {
        pageLinks,
        totalPages: pageLinks.length,
        library: 'bne',
        displayName: `BNE Manuscript ${manuscriptId}`,
        originalUrl: originalUrl,
        discoveryTime: discoveryTime
    };
}

testBneImprovedImplementation().then(result => {
    console.log('\n=== FINAL RESULT ===');
    console.log(JSON.stringify(result, null, 2));
}).catch(console.error);