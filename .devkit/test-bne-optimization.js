const https = require('https');

// Test URL
const testUrl = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
const manuscriptId = '0000007619';

console.log('🧪 Testing BNE manuscript loading optimization...\n');

// Optimized fetch with proper SSL handling
function fetchBneOptimized(url, options = {}) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Request timeout after 10 seconds'));
        }, 10000); // Reduced timeout for HEAD requests

        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/pdf,*/*',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache'
            },
            rejectUnauthorized: false // SSL bypass
        };

        const req = https.request(requestOptions, (res) => {
            clearTimeout(timeout);
            
            const headers = new Map();
            Object.entries(res.headers).forEach(([key, value]) => {
                headers.set(key.toLowerCase(), value);
            });
            
            resolve({
                ok: res.statusCode >= 200 && res.statusCode < 300,
                status: res.statusCode,
                headers: {
                    get: (name) => headers.get(name.toLowerCase())
                }
            });
        });

        req.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// Test parallel discovery for speed improvement
async function testParallelDiscovery() {
    console.log('Testing OPTIMIZED parallel page discovery...');
    console.log(`Manuscript ID: ${manuscriptId}`);
    
    const startTime = Date.now();
    const batchSize = 10; // Process 10 pages at a time
    const maxPages = 100; // Test first 100 pages
    
    const discoveredPages = [];
    const seenContentHashes = new Set();
    let shouldStop = false;
    
    for (let batchStart = 1; batchStart <= maxPages && !shouldStop; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize - 1, maxPages);
        console.log(`\nProcessing pages ${batchStart}-${batchEnd} in parallel...`);
        
        // Create promises for batch
        const batchPromises = [];
        for (let page = batchStart; page <= batchEnd; page++) {
            const pageUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&pdf=true`;
            batchPromises.push(
                fetchBneOptimized(pageUrl, { method: 'HEAD' })
                    .then(response => ({ page, response, error: null }))
                    .catch(error => ({ page, response: null, error }))
            );
        }
        
        // Wait for all in batch
        const batchResults = await Promise.all(batchPromises);
        
        // Process results
        let consecutiveErrors = 0;
        for (const result of batchResults) {
            if (result.error) {
                console.log(`  Page ${result.page}: ❌ Error: ${result.error.message}`);
                consecutiveErrors++;
            } else if (result.response.ok) {
                const contentLength = result.response.headers.get('content-length');
                const contentType = result.response.headers.get('content-type');
                
                if (contentLength && parseInt(contentLength) > 1000) {
                    const contentHash = `${contentType}-${contentLength}`;
                    
                    if (!seenContentHashes.has(contentHash)) {
                        seenContentHashes.add(contentHash);
                        discoveredPages.push({
                            page: result.page,
                            contentLength,
                            contentType
                        });
                        console.log(`  Page ${result.page}: ✅ Valid (${(parseInt(contentLength) / 1024 / 1024).toFixed(2)} MB)`);
                    } else {
                        console.log(`  Page ${result.page}: ⚠️ Duplicate content`);
                    }
                    consecutiveErrors = 0;
                } else {
                    console.log(`  Page ${result.page}: ❌ Invalid size (${contentLength} bytes)`);
                    consecutiveErrors++;
                }
            } else {
                console.log(`  Page ${result.page}: ❌ HTTP ${result.response.status}`);
                consecutiveErrors++;
                if (result.response.status === 404) {
                    shouldStop = true;
                }
            }
        }
        
        // Stop if too many errors
        if (consecutiveErrors >= batchSize) {
            console.log('\n⚠️ Stopping due to too many errors in batch');
            break;
        }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n📊 Parallel discovery completed in ${totalTime} seconds`);
    console.log(`📄 Total valid pages found: ${discoveredPages.length}`);
    
    return { discoveredPages, totalTime };
}

// Test sequential discovery (current implementation)
async function testSequentialDiscovery() {
    console.log('\nTesting CURRENT sequential page discovery...');
    console.log(`Manuscript ID: ${manuscriptId}`);
    
    const startTime = Date.now();
    const maxPages = 50; // Reduced for comparison
    const discoveredPages = [];
    const seenContentHashes = new Set();
    let consecutiveErrors = 0;
    
    for (let page = 1; page <= maxPages; page++) {
        const pageUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&pdf=true`;
        
        if (page % 10 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`Progress: Page ${page}/${maxPages} (${elapsed}s)...`);
        }
        
        try {
            const response = await fetchBneOptimized(pageUrl, { method: 'HEAD' });
            
            if (response.ok) {
                const contentLength = response.headers.get('content-length');
                const contentType = response.headers.get('content-type');
                
                if (contentLength && parseInt(contentLength) > 1000) {
                    const contentHash = `${contentType}-${contentLength}`;
                    if (!seenContentHashes.has(contentHash)) {
                        seenContentHashes.add(contentHash);
                        discoveredPages.push({ page, contentLength, contentType });
                    }
                    consecutiveErrors = 0;
                } else {
                    consecutiveErrors++;
                }
            } else {
                consecutiveErrors++;
                if (consecutiveErrors >= 3 || response.status === 404) break;
            }
        } catch (error) {
            consecutiveErrors++;
            if (consecutiveErrors >= 3) break;
        }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n📊 Sequential discovery completed in ${totalTime} seconds`);
    console.log(`📄 Total valid pages found: ${discoveredPages.length}`);
    
    return { discoveredPages, totalTime };
}

// Run comparison
async function runComparison() {
    try {
        console.log('='.repeat(60));
        const parallelResult = await testParallelDiscovery();
        
        console.log('\n' + '='.repeat(60));
        const sequentialResult = await testSequentialDiscovery();
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 PERFORMANCE COMPARISON:');
        console.log(`  Parallel:   ${parallelResult.totalTime}s for ${parallelResult.discoveredPages.length} pages`);
        console.log(`  Sequential: ${sequentialResult.totalTime}s for ${sequentialResult.discoveredPages.length} pages`);
        
        const speedup = (parseFloat(sequentialResult.totalTime) / parseFloat(parallelResult.totalTime)).toFixed(1);
        console.log(`  Speed improvement: ${speedup}x faster with parallel processing`);
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

runComparison();