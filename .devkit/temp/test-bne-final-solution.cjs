const https = require('https');

// Final BNE solution that uses HEAD requests properly
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

// Test final BNE solution
async function testBneFinalSolution() {
    console.log('Testing final BNE solution...');
    
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
    
    // Final page discovery solution
    const pageLinks = [];
    let consecutiveFailures = 0;
    
    console.log('Discovering BNE manuscript pages with final solution...');
    
    const startTime = Date.now();
    
    for (let page = 1; page <= 200; page++) {
        const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&jpeg=true`;
        
        try {
            // Use HEAD request for validation
            const response = await customFetch(testUrl, { method: 'HEAD' });
            
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                const contentLength = response.headers.get('content-length');
                
                if (contentType?.includes('image')) {
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
    
    if (pageLinks.length > 0) {
        console.log(`✓ Manuscript ID: ${manuscriptId}`);
        console.log(`✓ Total pages: ${pageLinks.length}`);
        console.log(`✓ First page: ${pageLinks[0]}`);
        console.log(`✓ Last page: ${pageLinks[pageLinks.length - 1]}`);
        
        // Test downloading a few sample pages
        console.log('\nTesting sample page downloads...');
        
        const samplePages = [1, Math.floor(pageLinks.length / 2), pageLinks.length];
        
        for (const pageIndex of samplePages) {
            if (pageIndex <= pageLinks.length) {
                const pageUrl = pageLinks[pageIndex - 1];
                console.log(`\nTesting page ${pageIndex} download: ${pageUrl}`);
                
                try {
                    const response = await customFetch(pageUrl);
                    
                    if (response.ok) {
                        const contentType = response.headers.get('content-type');
                        const contentLength = response.headers.get('content-length');
                        const responseSize = parseInt(contentLength || '0', 10);
                        
                        console.log(`✓ Page ${pageIndex} download successful: ${responseSize} bytes, ${contentType}`);
                    } else {
                        console.log(`✗ Page ${pageIndex} download failed: HTTP ${response.status}`);
                    }
                } catch (error) {
                    console.log(`✗ Page ${pageIndex} download error: ${error.message}`);
                }
            }
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

testBneFinalSolution().then(result => {
    console.log('\n=== FINAL RESULT ===');
    console.log(JSON.stringify(result, null, 2));
}).catch(console.error);