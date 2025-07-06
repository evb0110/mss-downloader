const https = require('https');

// Test the difference between HEAD and GET requests for BNE
function createCustomFetch() {
    const httpsAgent = new https.Agent({
        rejectUnauthorized: false
    });
    
    return async function customFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            
            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    ...options.headers
                },
                agent: httpsAgent
            };
            
            const req = https.request(requestOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        headers: new Map(Object.entries(res.headers)),
                        text: () => Promise.resolve(data),
                        json: () => Promise.resolve(JSON.parse(data))
                    });
                });
            });
            
            req.on('error', (err) => {
                reject(err);
            });
            
            req.end();
        });
    };
}

async function testBneHeadVsGet() {
    console.log('Testing BNE HEAD vs GET requests...');
    
    const customFetch = createCustomFetch();
    const manuscriptId = '0000007619';
    
    // Test multiple pages to verify the issue
    const testPages = [1, 2, 3, 4, 5];
    
    for (const page of testPages) {
        const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&jpeg=true`;
        console.log(`\nTesting page ${page}: ${testUrl}`);
        
        // Test HEAD request
        try {
            const headResponse = await customFetch(testUrl, { method: 'HEAD' });
            console.log(`HEAD Status: ${headResponse.status}, Content-Type: ${headResponse.headers.get('content-type')}`);
            
            const headIsImage = headResponse.ok && headResponse.headers.get('content-type')?.includes('image');
            console.log(`HEAD Request - Is Image: ${headIsImage}`);
        } catch (error) {
            console.log(`HEAD Request Error: ${error.message}`);
        }
        
        // Test GET request
        try {
            const getResponse = await customFetch(testUrl);
            console.log(`GET Status: ${getResponse.status}, Content-Type: ${getResponse.headers.get('content-type')}`);
            
            const getIsImage = getResponse.ok && getResponse.headers.get('content-type')?.includes('image');
            console.log(`GET Request - Is Image: ${getIsImage}`);
            
            if (getIsImage) {
                console.log(`✓ Page ${page} found with GET request`);
            } else {
                console.log(`✗ Page ${page} not found with GET request`);
            }
        } catch (error) {
            console.log(`GET Request Error: ${error.message}`);
        }
    }
    
    // Test higher page numbers to find the limit
    console.log('\nTesting higher page numbers to find manuscript limit...');
    const higherPages = [10, 20, 30, 40, 50];
    
    for (const page of higherPages) {
        const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&jpeg=true`;
        
        try {
            const response = await customFetch(testUrl);
            const isImage = response.ok && response.headers.get('content-type')?.includes('image');
            console.log(`Page ${page}: Status ${response.status}, Is Image: ${isImage}`);
            
            if (isImage) {
                console.log(`✓ Page ${page} exists`);
            } else {
                console.log(`✗ Page ${page} does not exist`);
            }
        } catch (error) {
            console.log(`Page ${page}: Error - ${error.message}`);
        }
    }
}

testBneHeadVsGet().catch(console.error);