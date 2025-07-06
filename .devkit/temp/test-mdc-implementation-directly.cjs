const https = require('https');
const fs = require('fs');
const path = require('path');

// Test the MDC Catalonia implementation step by step
const testUrl = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';

console.log('Testing MDC Catalonia implementation step by step...');

// Replicate the exact logic from EnhancedManuscriptDownloaderService
class MDCTester {
    
    async fetchDirect(url, options = {}) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : https;
            const requestOptions = {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    ...options.headers
                }
            };
            
            const req = client.get(url, requestOptions, (res) => {
                let data = '';
                
                res.on('data', chunk => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        headers: {
                            get: (name) => res.headers[name.toLowerCase()]
                        },
                        json: async () => JSON.parse(data),
                        text: async () => data,
                        buffer: async () => Buffer.from(data)
                    });
                });
            });
            
            req.on('error', (err) => {
                reject(err);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }
    
    async fetchWithFallback(url, options = {}) {
        try {
            return await this.fetchDirect(url, options);
        } catch (error) {
            console.log(`Network error, trying curl fallback: ${error.message}`);
            
            // Try curl fallback
            const { execSync } = require('child_process');
            try {
                const headers = options.headers || {};
                const userAgent = headers['User-Agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
                
                const curlCmd = `curl -s -m 30 --retry 2 --retry-delay 1 -H "User-Agent: ${userAgent}" "${url}"`;
                const result = execSync(curlCmd, { encoding: 'utf8', timeout: 35000 });
                
                return {
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: {
                        get: () => 'application/json'
                    },
                    json: async () => JSON.parse(result),
                    text: async () => result
                };
            } catch (curlError) {
                throw new Error(`Both fetch and curl failed: ${curlError.message}`);
            }
        }
    }
    
    async loadMdcCataloniaManifest(originalUrl) {
        try {
            console.log('\\n=== Starting MDC Catalonia Manifest Load ===');
            console.log('URL:', originalUrl);
            
            // Extract collection and item ID from URL
            const urlMatch = originalUrl.match(/mdc\.csuc\.cat\/digital\/collection\/([^\/]+)\/id\/(\d+)(?:\/rec\/(\d+))?/);
            if (!urlMatch) {
                throw new Error('Could not extract collection and item ID from MDC Catalonia URL');
            }
            
            const collection = urlMatch[1];
            const itemId = urlMatch[2];
            console.log(`Collection: ${collection}, Item ID: ${itemId}`);
            
            // Step 1: Get compound object structure using CONTENTdm API
            const compoundUrl = `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/${collection}/${itemId}/json`;
            console.log('Fetching compound object structure...');
            console.log('Compound URL:', compoundUrl);
            
            const compoundResponse = await this.fetchWithFallback(compoundUrl);
            if (!compoundResponse.ok) {
                throw new Error(`Failed to fetch compound object info: ${compoundResponse.status}`);
            }
            
            const compoundData = await compoundResponse.json();
            console.log('Compound data keys:', Object.keys(compoundData));
            
            // Check if this is a compound object with multiple pages
            let pageArray = compoundData.page;
            if (!pageArray && compoundData.node && compoundData.node.page) {
                pageArray = compoundData.node.page;
            }
            
            if (!pageArray || !Array.isArray(pageArray)) {
                console.log('❌ Not a compound object, treating as single page document');
                
                // Try to get IIIF info for single page
                const iiifInfoUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/info.json`;
                console.log('Trying IIIF info URL:', iiifInfoUrl);
                
                const infoResponse = await this.fetchWithFallback(iiifInfoUrl);
                if (!infoResponse.ok) {
                    throw new Error(`Failed to fetch IIIF info for single page: ${infoResponse.status}`);
                }
                
                const iiifInfo = await infoResponse.json();
                const singleImageUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/full/,2000/0/default.jpg`;
                
                console.log(`Single page manuscript: ${iiifInfo.width}x${iiifInfo.height} pixels`);
                
                return {
                    pageLinks: [singleImageUrl],
                    totalPages: 1,
                    library: 'mdc_catalonia',
                    displayName: `MDC Catalonia ${collection} ${itemId}`,
                    originalUrl: originalUrl,
                };
            }
            
            // Step 2: Process compound object pages
            console.log(`✅ Found compound object with ${pageArray.length} pages`);
            const pageLinks = [];
            let validPages = 0;
            
            console.log('Processing pages...');
            for (let i = 0; i < Math.min(10, pageArray.length); i++) {
                const page = pageArray[i];
                if (!page.pageptr) {
                    console.log(`Skipping page ${i+1} without pageptr`);
                    continue;
                }
                
                const pageId = page.pageptr;
                const iiifInfoUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${pageId}/info.json`;
                
                try {
                    const iiifResponse = await this.fetchWithFallback(iiifInfoUrl);
                    if (!iiifResponse.ok) {
                        console.log(`IIIF endpoint failed for page ${pageId}: ${iiifResponse.status}`);
                        continue;
                    }
                    
                    const iiifData = await iiifResponse.json();
                    const imageUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${pageId}/full/,2000/0/default.jpg`;
                    pageLinks.push(imageUrl);
                    validPages++;
                    
                    const pageTitle = page.pagetitle || `Page ${validPages}`;
                    console.log(`Page ${validPages}: ${pageTitle} (${pageId}) - ${iiifData.width}x${iiifData.height}px`);
                    
                } catch (error) {
                    console.log(`Error processing page ${pageId}: ${error.message}`);
                    continue;
                }
                
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No valid pages found in compound object');
            }
            
            console.log(`✅ Successfully processed ${validPages} pages`);
            
            return {
                pageLinks: pageLinks,
                totalPages: pageArray.length,
                library: 'mdc_catalonia',
                displayName: `MDC Catalonia ${collection} ${itemId}`,
                originalUrl: originalUrl,
            };
            
        } catch (error) {
            console.error('❌ loadMdcCataloniaManifest failed:', error.message);
            throw error;
        }
    }
}

async function runTest() {
    const tester = new MDCTester();
    
    try {
        const manifest = await tester.loadMdcCataloniaManifest(testUrl);
        
        console.log('\\n=== FINAL RESULTS ===');
        console.log('✅ Success!');
        console.log('Total pages:', manifest.totalPages);
        console.log('Valid pages processed:', manifest.pageLinks.length);
        console.log('Library:', manifest.library);
        console.log('Display name:', manifest.displayName);
        
        // Test downloading one image
        console.log('\\n=== Testing Image Download ===');
        const testImageUrl = manifest.pageLinks[0];
        console.log('Test image URL:', testImageUrl);
        
        const imageResponse = await tester.fetchWithFallback(testImageUrl);
        console.log('Image response status:', imageResponse.status);
        
        if (imageResponse.ok) {
            const buffer = await imageResponse.buffer();
            console.log(`Image size: ${(buffer.length / 1024).toFixed(2)}KB`);
            console.log('✅ Image download successful');
        } else {
            console.log('❌ Image download failed');
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
}

runTest().then(success => {
    console.log('\\n=== TEST COMPLETED ===');
    console.log('Success:', success);
}).catch(console.error);