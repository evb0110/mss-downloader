const https = require('https');
const fs = require('fs').promises;
const path = require('path');

// Test URL
const testUrl = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
const manuscriptId = '0000007619';

// Optimized fetch with SSL bypass
function fetchBneWithHttps(url, options = {}) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Request timeout'));
        }, 10000);

        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/pdf,*/*',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache'
            },
            rejectUnauthorized: false
        };

        const req = https.request(requestOptions, (res) => {
            clearTimeout(timeout);
            
            if (options.method === 'HEAD') {
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
            } else {
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    clearTimeout(timeout);
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        data: Buffer.concat(chunks)
                    });
                });
            }
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

// Test optimized parallel discovery
async function testOptimizedBneDiscovery() {
    const discoveredPages = [];
    const seenContentHashes = new Set();
    const maxPages = 200;
    const batchSize = 10;
    
    console.log('🧪 Testing OPTIMIZED BNE page discovery...');
    console.log(`Manuscript ID: ${manuscriptId}\n`);
    
    const startTime = Date.now();
    
    for (let batchStart = 1; batchStart <= maxPages; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize - 1, maxPages);
        
        if (batchStart % 20 === 1) {
            console.log(`Processing pages ${batchStart}-${batchEnd}...`);
        }
        
        // Create promises for batch
        const batchPromises = [];
        for (let page = batchStart; page <= batchEnd; page++) {
            const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&pdf=true`;
            batchPromises.push(
                fetchBneWithHttps(testUrl, { method: 'HEAD' })
                    .then(response => ({ page, response, error: null }))
                    .catch(error => ({ page, response: null, error }))
            );
        }
        
        // Wait for all in batch
        const batchResults = await Promise.all(batchPromises);
        
        // Process results
        let validPagesInBatch = 0;
        let errorsInBatch = 0;
        
        for (const result of batchResults) {
            if (result.error) {
                errorsInBatch++;
            } else if (result.response && result.response.ok) {
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
                        validPagesInBatch++;
                    }
                }
            } else if (result.response && result.response.status === 404) {
                errorsInBatch++;
            }
        }
        
        // Stop if no valid pages found
        if (validPagesInBatch === 0 && errorsInBatch >= batchSize / 2) {
            console.log(`Stopping - no valid pages found in batch ${batchStart}-${batchEnd}`);
            break;
        }
        
        // Progress update
        if (discoveredPages.length > 0 && discoveredPages.length % 50 === 0) {
            console.log(`Discovered ${discoveredPages.length} valid pages so far...`);
        }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Discovery completed in ${totalTime} seconds`);
    console.log(`📄 Total pages found: ${discoveredPages.length}`);
    
    // Download sample pages for validation
    if (discoveredPages.length > 0) {
        console.log('\n📥 Downloading 10 sample pages for validation...');
        
        const testDir = path.join(__dirname, `bne-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
        
        // Sort pages
        discoveredPages.sort((a, b) => a.page - b.page);
        
        // Download first 10 pages
        const pagesToTest = Math.min(10, discoveredPages.length);
        
        for (let i = 0; i < pagesToTest; i++) {
            const pageInfo = discoveredPages[i];
            const pageUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${pageInfo.page}&pdf=true`;
            
            console.log(`  Downloading page ${pageInfo.page}...`);
            
            try {
                const response = await fetchBneWithHttps(pageUrl);
                if (response.ok && response.data) {
                    const pdfPath = path.join(testDir, `page_${String(pageInfo.page).padStart(3, '0')}.pdf`);
                    await fs.writeFile(pdfPath, response.data);
                    console.log(`  ✅ Page ${pageInfo.page} saved (${(response.data.length / 1024 / 1024).toFixed(2)} MB)`);
                }
            } catch (error) {
                console.log(`  ❌ Page ${pageInfo.page} failed: ${error.message}`);
            }
        }
        
        console.log(`\n📁 Test files saved to: ${testDir}`);
        
        // Try to create merged PDF
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            
            const pdfFiles = (await fs.readdir(testDir))
                .filter(f => f.endsWith('.pdf'))
                .sort()
                .map(f => `"${path.join(testDir, f)}"`);
            
            if (pdfFiles.length > 0) {
                const mergedPath = path.join(testDir, 'bne_validation.pdf');
                await execAsync(`pdfunite ${pdfFiles.join(' ')} "${mergedPath}"`);
                console.log(`✅ Created validation PDF: ${path.basename(mergedPath)}`);
                
                // Validate
                const { stdout } = await execAsync(`pdfinfo "${mergedPath}" | head -10`);
                console.log('\n📋 PDF Info:');
                console.log(stdout);
            }
        } catch (error) {
            console.log('⚠️ Could not create merged PDF:', error.message);
        }
    }
}

testOptimizedBneDiscovery().catch(console.error);