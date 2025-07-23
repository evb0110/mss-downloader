const https = require('https');
const http = require('http');

async function fetchWithRedirects(url, options = {}, maxRedirects = 5) {
    console.log(`Fetching: ${url}`);
    
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                ...options.headers
            },
            timeout: 30000
        };

        const req = protocol.request(requestOptions, (res) => {
            console.log(`Status: ${res.statusCode}`);
            console.log('Headers:', res.headers);
            
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                if (maxRedirects <= 0) {
                    reject(new Error('Too many redirects'));
                    return;
                }
                const redirectUrl = new URL(res.headers.location, url).href;
                console.log(`Redirecting to: ${redirectUrl}`);
                fetchWithRedirects(redirectUrl, options, maxRedirects - 1).then(resolve).catch(reject);
                return;
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString();
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: body
                });
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

async function investigateToronto() {
    try {
        console.log('=== Toronto Library Investigation ===\n');
        
        // Test 1: Main page
        console.log('1. Testing main page...');
        const mainResponse = await fetchWithRedirects('https://collections.library.utoronto.ca/view/fisher:F10025');
        
        if (mainResponse.body) {
            // Check for various patterns
            const patterns = {
                'IIIF': /iiif|manifest/i,
                'ContentDM': /contentdm|cdm/i,
                'Islandora': /islandora/i,
                'DSpace': /dspace/i,
                'Mirador': /mirador/i,
                'OpenSeadragon': /openseadragon/i,
                'Initial State': /__INITIAL_STATE__|window\._/i,
                'Image URLs': /\.(jpg|jpeg|png|tif|tiff)["']/gi,
                'API endpoints': /\/api\/|\/rest\/|\/iiif\//i
            };
            
            console.log('\nPattern matches:');
            for (const [name, pattern] of Object.entries(patterns)) {
                const matches = mainResponse.body.match(pattern);
                if (matches) {
                    console.log(`- ${name}: Found (${matches.length} matches)`);
                    if (name === 'Image URLs') {
                        console.log(`  Sample URLs:`);
                        matches.slice(0, 3).forEach(m => console.log(`    ${m}`));
                    }
                }
            }
            
            // Extract any JavaScript variables
            const jsVarPattern = /window\.(\w+)\s*=\s*({[\s\S]*?});/g;
            let jsMatch;
            console.log('\nJavaScript variables found:');
            while ((jsMatch = jsVarPattern.exec(mainResponse.body)) !== null) {
                console.log(`- window.${jsMatch[1]} (${jsMatch[2].length} chars)`);
            }
            
            // Look for viewer initialization
            const viewerPatterns = [
                /new\s+(\w+Viewer)\(/,
                /(\w+)\.init\(/,
                /viewer\s*[:=]\s*new/i
            ];
            
            console.log('\nViewer initialization:');
            viewerPatterns.forEach(pattern => {
                const match = mainResponse.body.match(pattern);
                if (match) {
                    console.log(`- Found: ${match[0]}`);
                }
            });
            
            // Save HTML for manual inspection
            require('fs').writeFileSync('.devkit/toronto-page.html', mainResponse.body);
            console.log('\nSaved HTML to .devkit/toronto-page.html for inspection');
        }
        
        // Test 2: Try common API endpoints
        console.log('\n2. Testing common API endpoints...');
        const apiEndpoints = [
            '/iiif/fisher:F10025/manifest.json',
            '/api/items/fisher:F10025',
            '/rest/items/fisher:F10025',
            '/islandora/object/fisher:F10025/datastream/MODS',
            '/cdm/singleitem/collection/fisher/id/F10025'
        ];
        
        for (const endpoint of apiEndpoints) {
            try {
                console.log(`\nTrying: ${endpoint}`);
                const url = `https://collections.library.utoronto.ca${endpoint}`;
                const response = await fetchWithRedirects(url);
                console.log(`- Status: ${response.status}`);
                if (response.status === 200) {
                    console.log(`- Success! Content-Type: ${response.headers['content-type']}`);
                    if (response.body.length < 1000) {
                        console.log(`- Body preview: ${response.body.substring(0, 200)}...`);
                    }
                }
            } catch (err) {
                console.log(`- Error: ${err.message}`);
            }
        }
        
    } catch (err) {
        console.error('Investigation failed:', err);
    }
}

investigateToronto();