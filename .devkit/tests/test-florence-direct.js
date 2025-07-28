const https = require('https');
const { URL } = require('url');

async function testFlorenceDirectConnection() {
    console.log('Testing direct connection to Florence library server...\n');
    
    const testUrls = [
        'https://cdm21059.contentdm.oclc.org/utils/getfile/collection/plutei/id/317515',
        'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:317515/full/full/0/default.jpg'
    ];
    
    for (const testUrl of testUrls) {
        console.log(`\nTesting: ${testUrl}`);
        const urlObj = new URL(testUrl);
        
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': '*/*',
                'Referer': 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/'
            },
            timeout: 60000, // 60 second timeout
            rejectUnauthorized: false // Allow self-signed certificates
        };
        
        const agent = new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 1000,
            maxSockets: 10,
            maxFreeSockets: 5,
            timeout: 120000,
            rejectUnauthorized: false
        });
        
        options.agent = agent;
        
        await new Promise((resolve) => {
            const startTime = Date.now();
            
            const req = https.request(options, (res) => {
                const elapsed = Date.now() - startTime;
                console.log(`✅ Connected successfully in ${elapsed}ms`);
                console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
                console.log(`   Headers:`, Object.keys(res.headers).join(', '));
                
                // Don't download the full content, just test connection
                res.destroy();
                resolve();
            });
            
            req.on('error', (error) => {
                const elapsed = Date.now() - startTime;
                console.error(`❌ Connection failed after ${elapsed}ms`);
                console.error(`   Error: ${error.code} - ${error.message}`);
                if (error.code === 'ETIMEDOUT') {
                    console.error(`   The server at ${urlObj.hostname} (${error.address || 'unknown IP'}) is not responding.`);
                }
                resolve();
            });
            
            req.on('timeout', () => {
                console.error('❌ Request timeout');
                req.destroy();
            });
            
            req.end();
        });
    }
    
    console.log('\n\nTest completed. The connection fixes have been applied.');
    console.log('If timeouts still occur, the issue is likely with the server itself.');
}

// Run the test
testFlorenceDirectConnection().catch(console.error);