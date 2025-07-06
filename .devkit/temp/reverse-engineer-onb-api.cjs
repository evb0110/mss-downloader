const https = require('https');
const { URL } = require('url');

async function reverseEngineerONBAPI() {
    console.log('=== Reverse Engineering ONB API ===');
    
    // Since the viewer is a React SPA, let's try to find the actual API endpoints
    // by analyzing the JavaScript bundle
    
    const manuscriptId = '1000B160';
    
    try {
        // First, let's get the main JavaScript bundle
        const jsResponse = await makeRequest('https://viewer.onb.ac.at/src.38e9595d.js');
        console.log('JavaScript bundle loaded, size:', jsResponse.body.length);
        
        // Look for API endpoint patterns in the JS code
        const apiPatterns = [
            /https?:\/\/[^"'\s]+\/api\/[^"'\s]*/gi,
            /https?:\/\/[^"'\s]+\/iiif\/[^"'\s]*/gi,
            /https?:\/\/[^"'\s]+\/manifest\/[^"'\s]*/gi,
            /https?:\/\/[^"'\s]+\/data\/[^"'\s]*/gi,
            /["'][^"']*api[^"']*["']/gi,
            /["'][^"']*iiif[^"']*["']/gi,
            /["'][^"']*manifest[^"']*["']/gi,
            /["'][^"']*\.json["']/gi
        ];
        
        console.log('\n=== API Patterns Found in JavaScript ===');
        for (const pattern of apiPatterns) {
            const matches = jsResponse.body.match(pattern);
            if (matches) {
                console.log(`\n${pattern.source}:`);
                // Remove duplicates and show first 10
                const uniqueMatches = [...new Set(matches)];
                uniqueMatches.slice(0, 10).forEach(match => {
                    console.log(`  ${match}`);
                });
            }
        }
        
        // Look for specific function names or endpoints
        const functionPatterns = [
            /fetchManifest[^(]*\([^)]*\)/gi,
            /loadManifest[^(]*\([^)]*\)/gi,
            /getManifest[^(]*\([^)]*\)/gi,
            /fetch[^(]*\([^)]*manifest[^)]*\)/gi,
            /axios[^(]*\([^)]*\)/gi,
            /\.get\([^)]*\)/gi,
            /\.post\([^)]*\)/gi
        ];
        
        console.log('\n=== Function Patterns Found ===');
        for (const pattern of functionPatterns) {
            const matches = jsResponse.body.match(pattern);
            if (matches) {
                console.log(`\n${pattern.source}:`);
                matches.slice(0, 5).forEach(match => {
                    console.log(`  ${match}`);
                });
            }
        }
        
        // Look for configuration objects
        const configPatterns = [
            /baseURL[^,}]*[,}]/gi,
            /apiUrl[^,}]*[,}]/gi,
            /apiEndpoint[^,}]*[,}]/gi,
            /manifestUrl[^,}]*[,}]/gi,
            /iiifUrl[^,}]*[,}]/gi
        ];
        
        console.log('\n=== Configuration Patterns Found ===');
        for (const pattern of configPatterns) {
            const matches = jsResponse.body.match(pattern);
            if (matches) {
                console.log(`\n${pattern.source}:`);
                matches.slice(0, 5).forEach(match => {
                    console.log(`  ${match}`);
                });
            }
        }
        
        // Try to find specific domains in the JavaScript
        const domainPatterns = [
            /https?:\/\/[^"'\s]*onb\.ac\.at[^"'\s]*/gi,
            /https?:\/\/[^"'\s]*\.onb\.ac\.at[^"'\s]*/gi,
            /https?:\/\/[^"'\s]*iiif[^"'\s]*/gi
        ];
        
        console.log('\n=== Domain Patterns Found ===');
        for (const pattern of domainPatterns) {
            const matches = jsResponse.body.match(pattern);
            if (matches) {
                console.log(`\n${pattern.source}:`);
                const uniqueMatches = [...new Set(matches)];
                uniqueMatches.slice(0, 10).forEach(match => {
                    console.log(`  ${match}`);
                });
            }
        }
        
        // Look for specific manuscript ID patterns
        const idPatterns = [
            new RegExp(`[^a-zA-Z0-9]${manuscriptId}[^a-zA-Z0-9]`, 'gi'),
            /\$\{[^}]*\}/gi,
            /\`[^`]*\$\{[^}]*\}[^`]*\`/gi
        ];
        
        console.log('\n=== ID and Template Patterns Found ===');
        for (const pattern of idPatterns) {
            const matches = jsResponse.body.match(pattern);
            if (matches) {
                console.log(`\n${pattern.source}:`);
                matches.slice(0, 10).forEach(match => {
                    console.log(`  ${match}`);
                });
            }
        }
        
    } catch (error) {
        console.log(`Error analyzing JavaScript: ${error.message}`);
    }
    
    // Also try to discover if there are any other API patterns by testing common variations
    console.log('\n=== Testing Alternative API Patterns ===');
    
    const alternativePatterns = [
        // Maybe there's a different base URL
        `https://iiif.onb.ac.at/${manuscriptId}/manifest.json`,
        `https://iiif.onb.ac.at/manifest/${manuscriptId}.json`,
        `https://iiif.onb.ac.at/2.1/${manuscriptId}/manifest.json`,
        `https://iiif.onb.ac.at/v2/${manuscriptId}/manifest.json`,
        `https://iiif.onb.ac.at/v3/${manuscriptId}/manifest.json`,
        
        // Maybe there's a different ID format
        `https://viewer.onb.ac.at/api/cod-${manuscriptId}`,
        `https://viewer.onb.ac.at/api/cod_${manuscriptId}`,
        `https://viewer.onb.ac.at/api/ONB_${manuscriptId}`,
        `https://viewer.onb.ac.at/api/onb-${manuscriptId}`,
        
        // Maybe there's a different endpoint structure
        `https://viewer.onb.ac.at/rest/manifest/${manuscriptId}`,
        `https://viewer.onb.ac.at/rest/api/${manuscriptId}`,
        `https://viewer.onb.ac.at/service/manifest/${manuscriptId}`,
        `https://viewer.onb.ac.at/service/api/${manuscriptId}`,
        
        // Maybe there's a GraphQL endpoint
        `https://viewer.onb.ac.at/graphql`,
        `https://api.onb.ac.at/graphql`,
        
        // Maybe there's a different port
        `https://viewer.onb.ac.at:8080/api/${manuscriptId}`,
        `https://viewer.onb.ac.at:3000/api/${manuscriptId}`
    ];
    
    for (const pattern of alternativePatterns) {
        try {
            const response = await makeRequest(pattern);
            console.log(`✓ ${pattern} - Status: ${response.statusCode}`);
            
            if (response.statusCode === 200 && response.headers['content-type']?.includes('application/json')) {
                try {
                    const data = JSON.parse(response.body);
                    console.log(`  *** JSON Response found! ***`);
                    console.log(`  Keys:`, Object.keys(data));
                    
                    // Save the response
                    const fs = require('fs');
                    const filename = `.devkit/temp/onb-api-response-${manuscriptId}.json`;
                    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
                    console.log(`  Saved to: ${filename}`);
                } catch (e) {
                    console.log(`  JSON parse error: ${e.message}`);
                }
            }
        } catch (error) {
            if (error.message.includes('timeout')) {
                console.log(`⏱ ${pattern} - Timeout`);
            } else {
                console.log(`❌ ${pattern} - ${error.message}`);
            }
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
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                'Referer': 'https://viewer.onb.ac.at/'
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

reverseEngineerONBAPI().catch(console.error);