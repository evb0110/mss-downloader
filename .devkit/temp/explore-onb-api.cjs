const https = require('https');
const { URL } = require('url');

async function exploreONBAPI() {
    const baseUrl = 'https://viewer.onb.ac.at';
    const manuscriptId = '1000B160';
    
    console.log('=== ONB API Exploration ===');
    console.log('Base URL:', baseUrl);
    console.log('Manuscript ID:', manuscriptId);
    
    // Common API patterns to test
    const apiPatterns = [
        // IIIF manifest patterns
        `/api/manifest/${manuscriptId}`,
        `/api/manifest/${manuscriptId}.json`,
        `/iiif/manifest/${manuscriptId}`,
        `/iiif/manifest/${manuscriptId}.json`,
        `/iiif/${manuscriptId}/manifest`,
        `/iiif/${manuscriptId}/manifest.json`,
        `/manifest/${manuscriptId}`,
        `/manifest/${manuscriptId}.json`,
        
        // API info patterns
        `/api/info/${manuscriptId}`,
        `/api/info/${manuscriptId}.json`,
        `/api/${manuscriptId}`,
        `/api/${manuscriptId}.json`,
        `/api/v1/${manuscriptId}`,
        `/api/v2/${manuscriptId}`,
        
        // Common viewer API patterns
        `/viewer/api/${manuscriptId}`,
        `/viewer/manifest/${manuscriptId}`,
        `/data/${manuscriptId}`,
        `/data/${manuscriptId}.json`,
        
        // Image API patterns
        `/iiif/${manuscriptId}/info.json`,
        `/image/${manuscriptId}/info.json`,
        `/images/${manuscriptId}/info.json`,
        
        // Generic patterns
        `/${manuscriptId}`,
        `/${manuscriptId}.json`,
        `/${manuscriptId}/manifest`,
        `/${manuscriptId}/info`
    ];
    
    console.log('\n=== Testing API Endpoints ===');
    
    for (const pattern of apiPatterns) {
        const url = baseUrl + pattern;
        try {
            const response = await makeRequest(url);
            console.log(`✓ ${pattern} - Status: ${response.statusCode}`);
            
            if (response.statusCode === 200) {
                console.log(`  Content-Type: ${response.headers['content-type']}`);
                
                // If it's JSON, try to parse it
                if (response.headers['content-type']?.includes('application/json')) {
                    try {
                        const data = JSON.parse(response.body);
                        console.log(`  JSON Response keys:`, Object.keys(data));
                        if (data.sequences || data.items || data.canvases) {
                            console.log(`  *** IIIF Manifest found! ***`);
                            console.log(`  Sequences:`, data.sequences?.length || 'N/A');
                            console.log(`  Items:`, data.items?.length || 'N/A');
                            console.log(`  Canvases:`, data.canvases?.length || 'N/A');
                        }
                    } catch (e) {
                        console.log(`  JSON parse error: ${e.message}`);
                    }
                }
                
                // Show first 200 characters of response
                const preview = response.body.substring(0, 200);
                console.log(`  Preview: ${preview}...`);
            }
        } catch (error) {
            if (error.message.includes('timeout')) {
                console.log(`⏱ ${pattern} - Timeout`);
            } else if (error.message.includes('ENOTFOUND')) {
                console.log(`❌ ${pattern} - DNS Error`);
            } else {
                console.log(`❌ ${pattern} - ${error.message}`);
            }
        }
    }
    
    // Also try to check for common ONB-specific patterns
    console.log('\n=== ONB-Specific Patterns ===');
    const onbPatterns = [
        '/onb-iiif/',
        '/digital/',
        '/digitale-sammlungen/',
        '/viewer-api/',
        '/api/viewer/',
        '/sammlungen/',
        '/digital-collections/'
    ];
    
    for (const pattern of onbPatterns) {
        const url = baseUrl + pattern + manuscriptId;
        try {
            const response = await makeRequest(url);
            console.log(`✓ ${pattern} - Status: ${response.statusCode}`);
        } catch (error) {
            console.log(`❌ ${pattern} - ${error.message}`);
        }
    }
}

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            }
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.setTimeout(5000, () => {
            req.abort();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

exploreONBAPI().catch(console.error);