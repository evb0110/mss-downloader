const https = require('https');
const { URL } = require('url');

async function analyzeONBViewer() {
    const testUrl = 'https://viewer.onb.ac.at/1000B160';
    
    console.log('=== ONB Viewer Analysis ===');
    console.log('URL:', testUrl);
    
    try {
        // Test the main page
        const response = await makeRequest(testUrl);
        console.log('Status:', response.statusCode);
        console.log('Headers:', response.headers);
        console.log('Content-Type:', response.headers['content-type']);
        
        // Look for common IIIF patterns
        const body = response.body;
        
        // Check for IIIF manifest references
        const iiifPatterns = [
            /manifest\.json/gi,
            /\/iiif\//gi,
            /info\.json/gi,
            /\/full\/\d+,/gi,
            /\/full\/full\//gi,
            /\/api\//gi,
            /mirador/gi,
            /openseadragon/gi,
            /universalviewer/gi,
            /dzi/gi,
            /deepzoom/gi
        ];
        
        console.log('\n=== Pattern Analysis ===');
        for (const pattern of iiifPatterns) {
            const matches = body.match(pattern);
            if (matches) {
                console.log(`Found ${pattern.source}:`, matches.slice(0, 5));
            }
        }
        
        // Look for JavaScript API endpoints
        const apiEndpointPattern = /["']https?:\/\/[^"']*(?:api|iiif|manifest|image)[^"']*["']/gi;
        const apiMatches = body.match(apiEndpointPattern);
        if (apiMatches) {
            console.log('\n=== API Endpoints ===');
            apiMatches.forEach((match, index) => {
                if (index < 10) { // Show first 10 matches
                    console.log(match);
                }
            });
        }
        
        // Check for data attributes or config objects
        const configPatterns = [
            /window\.\w+\s*=\s*{[^}]*}/gi,
            /data-\w+="[^"]*"/gi,
            /__INITIAL_STATE__/gi,
            /config\s*[:=]\s*{/gi
        ];
        
        console.log('\n=== Config Patterns ===');
        for (const pattern of configPatterns) {
            const matches = body.match(pattern);
            if (matches) {
                console.log(`Found ${pattern.source}:`, matches.slice(0, 3));
            }
        }
        
        // Try to find image URLs
        const imagePatterns = [
            /https?:\/\/[^"'\s]*\.(?:jpg|jpeg|png|tiff|jp2|webp)/gi,
            /\/image\/[^"'\s]*/gi,
            /\/full\/\d+,/gi
        ];
        
        console.log('\n=== Image URL Patterns ===');
        for (const pattern of imagePatterns) {
            const matches = body.match(pattern);
            if (matches) {
                console.log(`Found ${pattern.source}:`, matches.slice(0, 5));
            }
        }
        
        // Check for potential viewer configuration
        const viewerIndicators = [
            'mirador',
            'openseadragon',
            'universalviewer',
            'leaflet',
            'zoomify',
            'deepzoom',
            'iiif'
        ];
        
        console.log('\n=== Viewer Technology Detection ===');
        for (const indicator of viewerIndicators) {
            if (body.toLowerCase().includes(indicator)) {
                console.log(`Found ${indicator} references`);
            }
        }
        
    } catch (error) {
        console.error('Error analyzing ONB viewer:', error.message);
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
        
        req.setTimeout(10000, () => {
            req.abort();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

analyzeONBViewer().catch(console.error);