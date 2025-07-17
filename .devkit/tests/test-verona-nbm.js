const https = require('https');
const fs = require('fs');

async function testNbmUrl(url) {
    console.log(`\nTesting NBM URL: ${url}`);
    console.log('==================================');
    
    const startTime = Date.now();
    
    try {
        const response = await new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive'
                },
                rejectUnauthorized: false, // SSL bypass
                timeout: 60000
            };
            
            const req = https.request(options, (res) => {
                const elapsed = Date.now() - startTime;
                console.log(`Response received in ${elapsed}ms`);
                console.log(`Status: ${res.statusCode}`);
                console.log(`Headers:`, res.headers);
                
                let data = '';
                res.on('data', chunk => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    console.log(`Total response size: ${data.length} bytes`);
                    resolve({ status: res.statusCode, headers: res.headers, data });
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.on('error', reject);
            req.end();
        });
        
        // Save response
        fs.writeFileSync('.devkit/reports/verona-nbm-response.html', response.data);
        console.log('Response saved to .devkit/reports/verona-nbm-response.html');
        
        // Look for viewer frame or manifest
        if (response.data.includes('viewer/iframe')) {
            console.log('Found viewer iframe');
            
            // Extract iframe URL
            const iframeMatch = response.data.match(/src=["']([^"']+viewer\/iframe[^"']+)["']/);
            if (iframeMatch) {
                console.log(`Iframe URL: ${iframeMatch[1]}`);
                
                // Test iframe URL
                const iframeUrl = new URL(iframeMatch[1], url).href;
                console.log(`\nTesting iframe URL: ${iframeUrl}`);
                
                const iframeResponse = await testNbmUrl(iframeUrl);
                
                // Look for manifest in iframe response
                const manifestMatch = iframeResponse.data.match(/manifest[^"']+\.json/);
                if (manifestMatch) {
                    console.log(`Found manifest: ${manifestMatch[0]}`);
                }
            }
        }
        
        return response;
        
    } catch (error) {
        console.error(`Error: ${error.message}`);
        throw error;
    }
}

// Test the NBM URL
testNbmUrl('https://nbm.regione.veneto.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15')
    .then(() => {
        console.log('\nTest completed successfully');
    })
    .catch((error) => {
        console.error('\nTest failed:', error);
        process.exit(1);
    });