const https = require('https');
const http = require('http');

// Test the specific URL that's failing
const testUrl = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';

console.log('Testing MDC Catalonia URL:', testUrl);

// Extract collection and item ID
const urlMatch = testUrl.match(/mdc\.csuc\.cat\/digital\/collection\/([^\/]+)\/id\/(\d+)(?:\/rec\/(\d+))?/);
if (!urlMatch) {
    console.error('Could not extract collection and item ID from URL');
    process.exit(1);
}

const collection = urlMatch[1];
const itemId = urlMatch[2];
console.log(`Collection: ${collection}, Item ID: ${itemId}`);

// Test the compound object API endpoint
const compoundUrl = `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/${collection}/${itemId}/json`;
console.log('Testing compound object API:', compoundUrl);

// Function to test HTTP request
function testRequest(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        const req = client.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        }, (res) => {
            let data = '';
            
            res.on('data', chunk => {
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
        
        req.on('error', (err) => {
            reject(err);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

// Test both the original URL and the compound API
async function runTests() {
    console.log('\n=== Testing Original URL ===');
    try {
        const result = await testRequest(testUrl);
        console.log('Status:', result.status);
        console.log('Content-Type:', result.headers['content-type']);
        console.log('Content length:', result.data.length);
        console.log('First 500 chars:', result.data.substring(0, 500));
    } catch (error) {
        console.error('Original URL failed:', error.message);
    }
    
    console.log('\n=== Testing Compound API ===');
    try {
        const result = await testRequest(compoundUrl);
        console.log('Status:', result.status);
        console.log('Content-Type:', result.headers['content-type']);
        console.log('Data:', result.data);
        
        // Try to parse JSON
        try {
            const jsonData = JSON.parse(result.data);
            console.log('JSON parsed successfully');
            console.log('Keys:', Object.keys(jsonData));
            if (jsonData.page) {
                console.log('Pages found:', Array.isArray(jsonData.page) ? jsonData.page.length : 'Not an array');
            }
        } catch (parseError) {
            console.error('JSON parse error:', parseError.message);
        }
    } catch (error) {
        console.error('Compound API failed:', error.message);
    }
    
    // Test IIIF info endpoint
    console.log('\n=== Testing IIIF Info ===');
    const iiifInfoUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/info.json`;
    try {
        const result = await testRequest(iiifInfoUrl);
        console.log('Status:', result.status);
        console.log('Data:', result.data);
    } catch (error) {
        console.error('IIIF Info failed:', error.message);
    }
}

runTests().catch(console.error);