const https = require('https');

const manuscriptIds = ['8224538', '5892688'];

async function testIIIFEndpoint(manuscriptId) {
    const url = `https://unipub.uni-graz.at/i3f/v20/${manuscriptId}/manifest`;
    console.log(`\nTesting IIIF endpoint: ${url}`);
    
    return new Promise((resolve) => {
        const urlParts = new URL(url);
        
        const options = {
            hostname: urlParts.hostname,
            port: 443,
            path: urlParts.pathname,
            method: 'GET',
            headers: {
                'Referer': 'https://unipub.uni-graz.at/',
                'Accept': 'application/json, application/ld+json, image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'de-AT,de;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 30000
        };
        
        const req = https.request(options, (res) => {
            console.log(`Status: ${res.statusCode}`);
            console.log(`Headers:`, JSON.stringify(res.headers, null, 2));
            
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`Response length: ${data.length} bytes`);
                if (data.length > 0) {
                    console.log(`First 500 chars: ${data.substring(0, 500)}`);
                    
                    // Try to parse as JSON
                    try {
                        const json = JSON.parse(data);
                        console.log('Valid JSON manifest received!');
                        console.log(`Canvas count: ${json.sequences?.[0]?.canvases?.length || 0}`);
                    } catch (e) {
                        console.log('Response is not valid JSON');
                    }
                }
                resolve(true);
            });
        });
        
        req.on('error', (err) => {
            console.log(`Error: ${err.message}`);
            resolve(false);
        });
        
        req.on('timeout', () => {
            console.log(`Request timeout`);
            req.destroy();
            resolve(false);
        });
        
        req.end();
    });
}

async function runTests() {
    console.log('Testing direct IIIF endpoints for University of Graz...');
    
    for (const id of manuscriptIds) {
        await testIIIFEndpoint(id);
    }
}

runTests().catch(console.error);