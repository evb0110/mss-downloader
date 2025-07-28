const fetch = require('node-fetch');
const https = require('https');

// Create a custom agent to handle SSL and timeout issues
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    timeout: 30000,
    keepAlive: true
});

async function testGrazManifestError() {
    console.log('Testing Graz manifest loading issue...\n');
    
    // Test different scenarios that might cause "ошибка во время добавления манифеста"
    const testCases = [
        {
            name: 'Valid titleinfo URL',
            url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538'
        },
        {
            name: 'Valid pageview URL',
            url: 'https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540'
        },
        {
            name: 'Invalid manuscript ID',
            url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/9999999'
        },
        {
            name: 'Malformed URL',
            url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/'
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n=== Testing: ${testCase.name} ===`);
        console.log(`URL: ${testCase.url}`);
        
        try {
            // Extract manuscript ID
            const manuscriptIdMatch = testCase.url.match(/\/(\d+)$/);
            if (!manuscriptIdMatch) {
                throw new Error('Could not extract manuscript ID from Graz URL');
            }
            
            let manuscriptId = manuscriptIdMatch[1];
            console.log(`Extracted ID: ${manuscriptId}`);
            
            // Handle pageview conversion
            if (testCase.url.includes('/pageview/')) {
                const pageviewId = parseInt(manuscriptId);
                const titleinfoId = (pageviewId - 2).toString();
                console.log(`Converting pageview ID ${pageviewId} to titleinfo ID ${titleinfoId}`);
                manuscriptId = titleinfoId;
            }
            
            // Construct manifest URL
            const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${manuscriptId}/manifest`;
            console.log(`Manifest URL: ${manifestUrl}`);
            
            // Test manifest with different approaches
            console.log('\n1. Testing with standard fetch...');
            try {
                const response1 = await fetch(manifestUrl, {
                    headers: {
                        'Accept': 'application/json, application/ld+json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 10000
                });
                console.log(`   Status: ${response1.status} ${response1.statusText}`);
                if (!response1.ok) {
                    const text = await response1.text();
                    console.log(`   Error body: ${text.substring(0, 200)}`);
                }
            } catch (e) {
                console.log(`   Error: ${e.message}`);
            }
            
            console.log('\n2. Testing with HTTPS agent...');
            try {
                const response2 = await fetch(manifestUrl, {
                    agent: httpsAgent,
                    headers: {
                        'Accept': 'application/json, application/ld+json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 10000
                });
                console.log(`   Status: ${response2.status} ${response2.statusText}`);
                
                if (response2.ok) {
                    const text = await response2.text();
                    console.log(`   Response size: ${(text.length / 1024).toFixed(1)} KB`);
                    
                    // Try to parse JSON
                    try {
                        const manifest = JSON.parse(text);
                        console.log(`   Manifest parsed successfully`);
                        console.log(`   Type: ${manifest['@type'] || manifest.type}`);
                        console.log(`   Label: ${manifest.label || 'No label'}`);
                    } catch (parseError) {
                        console.log(`   JSON parse error: ${parseError.message}`);
                        console.log(`   First 200 chars: ${text.substring(0, 200)}`);
                    }
                }
            } catch (e) {
                console.log(`   Error: ${e.message}`);
                console.log(`   Error code: ${e.code}`);
                console.log(`   Error type: ${e.name}`);
            }
            
        } catch (error) {
            console.log(`\nTest case failed: ${error.message}`);
        }
    }
    
    console.log('\n\n=== Testing Direct HTTPS Request ===');
    // Test raw HTTPS request to understand connection issues
    const url = new URL('https://unipub.uni-graz.at/i3f/v20/8224538/manifest');
    
    const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
        },
        timeout: 10000
    };
    
    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            console.log(`Status: ${res.statusCode}`);
            console.log(`Headers:`, res.headers);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`Response size: ${(data.length / 1024).toFixed(1)} KB`);
                resolve();
            });
        });
        
        req.on('error', (e) => {
            console.error(`Request error: ${e.message}`);
            console.error(`Error code: ${e.code}`);
            resolve();
        });
        
        req.on('timeout', () => {
            console.error('Request timeout');
            req.destroy();
            resolve();
        });
        
        req.end();
    });
}

testGrazManifestError().catch(console.error);