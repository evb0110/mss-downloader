const https = require('https');

// Test URL reported as hanging
const testUrl = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
const manuscriptId = '0000007619';

console.log('🧪 Testing BNE manuscript loading for hanging issue...\n');

// Function to make HTTPS request
function fetchBneWithHttps(url, options = {}) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Request timeout after 30 seconds'));
        }, 30000);

        https.get(url, options, (res) => {
            clearTimeout(timeout);
            resolve({
                ok: res.statusCode >= 200 && res.statusCode < 300,
                status: res.statusCode,
                headers: {
                    get: (name) => res.headers[name.toLowerCase()]
                }
            });
        }).on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

// Test robust page discovery with progress logging
async function testRobustDiscovery() {
    console.log('Starting robust BNE page discovery...');
    console.log(`Manuscript ID: ${manuscriptId}`);
    
    const discoveredPages = [];
    const seenContentHashes = new Set();
    let consecutiveDuplicates = 0;
    let consecutiveErrors = 0;
    const maxConsecutiveDuplicates = 5;
    const maxConsecutiveErrors = 3;
    const maxPages = 50; // Reduced for testing
    
    const startTime = Date.now();
    
    for (let page = 1; page <= maxPages; page++) {
        const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&pdf=true`;
        
        // Log progress every 10 pages
        if (page % 10 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`Progress: Testing page ${page}/${maxPages} (${elapsed}s elapsed)...`);
        }
        
        try {
            const response = await fetchBneWithHttps(testUrl, { method: 'HEAD' });
            
            if (response.ok) {
                const contentLength = response.headers.get('content-length');
                const contentType = response.headers.get('content-type');
                
                if (contentLength && parseInt(contentLength) > 1000) {
                    const contentHash = `${contentType}-${contentLength}`;
                    
                    if (seenContentHashes.has(contentHash) && discoveredPages.length > 0) {
                        consecutiveDuplicates++;
                        console.log(`  Page ${page}: Duplicate detected (${consecutiveDuplicates}/${maxConsecutiveDuplicates})`);
                        
                        if (consecutiveDuplicates >= maxConsecutiveDuplicates) {
                            console.log(`\n✅ Stopping after ${consecutiveDuplicates} consecutive duplicates - manuscript complete`);
                            break;
                        }
                    } else {
                        seenContentHashes.add(contentHash);
                        consecutiveDuplicates = 0;
                        consecutiveErrors = 0;
                        
                        discoveredPages.push({
                            page,
                            contentLength: contentLength || '0',
                            contentType: contentType || 'application/pdf'
                        });
                        
                        console.log(`  Page ${page}: ✅ Valid page found (${(parseInt(contentLength) / 1024 / 1024).toFixed(2)} MB)`);
                    }
                } else {
                    consecutiveErrors++;
                    console.log(`  Page ${page}: ❌ Small/invalid response (${contentLength} bytes)`);
                    if (consecutiveErrors >= maxConsecutiveErrors) {
                        console.log(`\n⚠️ Stopping after ${consecutiveErrors} consecutive small/invalid responses`);
                        break;
                    }
                }
            } else {
                consecutiveErrors++;
                console.log(`  Page ${page}: ❌ HTTP ${response.status}`);
                if (consecutiveErrors >= maxConsecutiveErrors || response.status === 404) {
                    console.log(`\n⚠️ Stopping on HTTP ${response.status} after ${consecutiveErrors} errors`);
                    break;
                }
            }
        } catch (error) {
            consecutiveErrors++;
            console.log(`  Page ${page}: ❌ Network error: ${error.message}`);
            if (consecutiveErrors >= maxConsecutiveErrors) {
                console.log(`\n⚠️ Stopping after ${consecutiveErrors} consecutive network errors`);
                break;
            }
        }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n📊 Discovery completed in ${totalTime} seconds`);
    console.log(`📄 Total pages found: ${discoveredPages.length}`);
    
    if (discoveredPages.length > 0) {
        console.log('\n📋 Page size distribution:');
        const sizes = discoveredPages.map(p => parseInt(p.contentLength));
        console.log(`  Min: ${(Math.min(...sizes) / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Max: ${(Math.max(...sizes) / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Avg: ${(sizes.reduce((a, b) => a + b, 0) / sizes.length / 1024 / 1024).toFixed(2)} MB`);
    }
}

// Test with timeout wrapper
async function runTest() {
    const testTimeout = setTimeout(() => {
        console.error('\n❌ TEST TIMEOUT: Process is hanging after 2 minutes!');
        console.error('This confirms the hanging issue.');
        process.exit(1);
    }, 120000); // 2 minute timeout
    
    try {
        await testRobustDiscovery();
        clearTimeout(testTimeout);
        console.log('\n✅ Test completed without hanging');
    } catch (error) {
        clearTimeout(testTimeout);
        console.error('\n❌ Test failed with error:', error.message);
    }
}

runTest();