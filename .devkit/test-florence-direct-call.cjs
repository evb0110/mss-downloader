const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

const fetchFn = (url, options = {}) => {
    const https = require('https');
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                ...options.headers
            },
            timeout: 30000
        };

        https.get(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: async () => data,
                    json: async () => JSON.parse(data)
                });
            });
        }).on('error', reject);
    });
};

async function testFlorenceDirectCall() {
    console.log('=== Testing Florence Direct Function Call ===\n');
    
    const loader = new SharedManifestLoaders(fetchFn);
    const url = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
    
    try {
        console.log('Calling getFlorenceManifest directly...');
        const result = await loader.getFlorenceManifest(url);
        
        console.log(`✅ SUCCESS: Found ${result.images.length} pages`);
        
        if (result.images.length > 1) {
            console.log('✅ Multi-page support working!');
            console.log('First 5 pages:');
            for (let i = 0; i < Math.min(5, result.images.length); i++) {
                console.log(`  Page ${i + 1}: ${result.images[i].label} - ${result.images[i].url}`);
            }
        } else {
            console.log('❌ Still only getting 1 page');
        }
        
    } catch (error) {
        console.error('❌ Direct call failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testFlorenceDirectCall().catch(console.error);