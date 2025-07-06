const https = require('https');
const http = require('http');

// Test the current implementation logic
const testUrl = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';

console.log('Testing current MDC Catalonia implementation...');

// Extract collection and item ID using the same regex as the implementation
const urlMatch = testUrl.match(/mdc\.csuc\.cat\/digital\/collection\/([^\/]+)\/id\/(\d+)(?:\/rec\/(\d+))?/);
if (!urlMatch) {
    console.error('Could not extract collection and item ID from URL');
    process.exit(1);
}

const collection = urlMatch[1];
const itemId = urlMatch[2];
console.log(`Collection: ${collection}, Item ID: ${itemId}`);

// Step 1: Get compound object structure using CONTENTdm API
const compoundUrl = `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/${collection}/${itemId}/json`;
console.log('Fetching compound object structure...');

function fetchDirect(url, options = {}) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
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
                    headers: res.headers,
                    json: async () => JSON.parse(data),
                    text: async () => data
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

async function runTest() {
    try {
        // Test compound object API
        console.log('\n=== Testing Compound Object API ===');
        const compoundResponse = await fetchDirect(compoundUrl);
        console.log('Status:', compoundResponse.status);
        
        if (!compoundResponse.ok) {
            throw new Error(`Failed to fetch compound object info: ${compoundResponse.status}`);
        }
        
        const compoundData = await compoundResponse.json();
        console.log('Compound data keys:', Object.keys(compoundData));
        
        // Check page array handling
        let pageArray = compoundData.page;
        if (!pageArray && compoundData.node && compoundData.node.page) {
            pageArray = compoundData.node.page;
        }
        
        if (!pageArray || !Array.isArray(pageArray)) {
            console.log('❌ Not a compound object, treating as single page document');
            
            // This would trigger the problematic IIIF info call
            const iiifInfoUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/info.json`;
            console.log('Would try IIIF info URL:', iiifInfoUrl);
            
            const infoResponse = await fetchDirect(iiifInfoUrl);
            console.log('IIIF info status:', infoResponse.status);
            
            if (!infoResponse.ok) {
                throw new Error(`Failed to fetch IIIF info for single page: ${infoResponse.status}`);
            }
            
        } else {
            console.log('✅ Compound object detected');
            console.log('Pages found:', pageArray.length);
            
            // Test first few pages
            console.log('\n=== Testing First 3 Pages ===');
            for (let i = 0; i < Math.min(3, pageArray.length); i++) {
                const page = pageArray[i];
                if (!page.pageptr) {
                    console.log(`Skipping page ${i} without pageptr`);
                    continue;
                }
                
                const pageId = page.pageptr;
                const iiifInfoUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${pageId}/info.json`;
                
                try {
                    const iiifResponse = await fetchDirect(iiifInfoUrl);
                    if (iiifResponse.ok) {
                        const iiifData = await iiifResponse.json();
                        const imageUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${pageId}/full/,2000/0/default.jpg`;
                        console.log(`Page ${i+1}: ${page.pagetitle || 'No title'} (${pageId}) - ${iiifData.width}x${iiifData.height}px`);
                        console.log(`  Image URL: ${imageUrl}`);
                    } else {
                        console.log(`Page ${i+1}: IIIF endpoint failed (${iiifResponse.status})`);
                    }
                } catch (error) {
                    console.log(`Page ${i+1}: Error - ${error.message}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
    
    return true;
}

runTest().then(success => {
    console.log('\n=== Test Results ===');
    console.log('Success:', success);
}).catch(console.error);