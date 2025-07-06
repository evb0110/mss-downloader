const https = require('https');
const http = require('http');

// Custom fetch function that bypasses SSL verification like the app does
function createCustomFetch() {
    // Create HTTPS agent with SSL verification disabled
    const httpsAgent = new https.Agent({
        rejectUnauthorized: false
    });
    
    return async function customFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const protocol = urlObj.protocol === 'https:' ? https : http;
            
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
                }
            };
            
            if (protocol === https) {
                requestOptions.agent = httpsAgent;
            }
            
            const req = protocol.request(requestOptions, (res) => {
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

// Test BNE page detection with custom fetch
async function testBneComprehensive() {
    console.log('Testing BNE comprehensive page detection...');
    
    const customFetch = createCustomFetch();
    const originalUrl = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    
    // Extract manuscript ID
    const idMatch = originalUrl.match(/[?&]id=(\d+)/);
    if (!idMatch) {
        console.error('Could not extract manuscript ID from BNE URL');
        return;
    }
    
    const manuscriptId = idMatch[1];
    console.log(`Manuscript ID: ${manuscriptId}`);
    
    // Test the main viewer page first
    try {
        console.log('\n1. Testing main viewer page...');
        const response = await customFetch(originalUrl);
        console.log('Viewer Page Status:', response.status);
        console.log('Viewer Page Headers:', Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
            const html = await response.text();
            console.log('HTML Response Length:', html.length);
            
            // Look for image patterns in the HTML
            const imagePatterns = [
                /ImageProxy[^"']*?\?[^"']*?/gi,
                /pdf\.raw[^"']*?\?[^"']*?/gi,
                /id=\d+[^"']*?page=\d+/gi,
                /"([^"]*ImageProxy[^"]*?)"/gi,
                /"([^"]*pdf\.raw[^"]*?)"/gi
            ];
            
            console.log('\nSearching for image patterns in HTML...');
            imagePatterns.forEach((pattern, index) => {
                const matches = html.match(pattern);
                if (matches) {
                    console.log(`Pattern ${index + 1} matches:`, matches.slice(0, 3));
                }
            });
        }
        
    } catch (error) {
        console.error('Error testing viewer page:', error.message);
    }
    
    // Test the current implementation approach
    console.log('\n2. Testing current implementation approach...');
    const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1&jpeg=true`;
    console.log(`Testing URL: ${testUrl}`);
    
    try {
        const response = await customFetch(testUrl);
        console.log('Current Implementation Status:', response.status);
        console.log('Current Implementation Headers:', Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            console.log('Content-Type:', contentType);
            
            if (contentType?.includes('image')) {
                console.log('✓ Found image with current implementation');
            } else {
                console.log('✗ Not an image with current implementation');
            }
        }
    } catch (error) {
        console.error('Error testing current implementation:', error.message);
    }
    
    // Test alternative endpoint patterns
    console.log('\n3. Testing alternative endpoint patterns...');
    const alternativeUrls = [
        `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/ImageProxy?id=${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/ImageProxy?id=${manuscriptId}&page=1&size=full`,
        `https://bdh-rd.bne.es/ImageProxy?id=${manuscriptId}&page=1&size=full/max`,
        `https://bdh-rd.bne.es/imagen.do?id=${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/image.do?id=${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/viewer/image?id=${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/images/${manuscriptId}/page1.jpg`,
        `https://bdh-rd.bne.es/images/${manuscriptId}_001.jpg`
    ];
    
    for (const url of alternativeUrls) {
        try {
            const response = await customFetch(url);
            const contentType = response.headers.get('content-type');
            console.log(`${url}: Status ${response.status}, Content-Type: ${contentType}`);
            
            if (response.ok && contentType?.includes('image')) {
                console.log('  ✓ Found valid image endpoint!');
            }
        } catch (error) {
            console.log(`${url}: Error - ${error.message}`);
        }
    }
    
    // Test if we can get page count information
    console.log('\n4. Testing page count detection...');
    const pageCountUrls = [
        `https://bdh-rd.bne.es/api/manifest?id=${manuscriptId}`,
        `https://bdh-rd.bne.es/metadata?id=${manuscriptId}`,
        `https://bdh-rd.bne.es/info?id=${manuscriptId}`,
        `https://bdh-rd.bne.es/pages?id=${manuscriptId}`
    ];
    
    for (const url of pageCountUrls) {
        try {
            const response = await customFetch(url);
            console.log(`${url}: Status ${response.status}, Content-Type: ${response.headers.get('content-type')}`);
            
            if (response.ok) {
                const text = await response.text();
                console.log(`  Response (first 200 chars): ${text.substring(0, 200)}`);
            }
        } catch (error) {
            console.log(`${url}: Error - ${error.message}`);
        }
    }
}

testBneComprehensive().catch(console.error);