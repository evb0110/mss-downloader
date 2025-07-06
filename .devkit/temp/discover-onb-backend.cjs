const https = require('https');
const { URL } = require('url');

async function discoverONBBackend() {
    console.log('=== ONB Backend Discovery ===');
    
    // Try different possible backend domains
    const backendDomains = [
        'https://iiif.onb.ac.at',
        'https://api.onb.ac.at', 
        'https://digital.onb.ac.at',
        'https://digitale-sammlungen.onb.ac.at',
        'https://sammlungen.onb.ac.at',
        'https://images.onb.ac.at',
        'https://data.onb.ac.at',
        'https://manifest.onb.ac.at',
        'https://viewer-api.onb.ac.at',
        'https://onb.ac.at',
        'https://www.onb.ac.at'
    ];
    
    const manuscriptId = '1000B160';
    
    for (const domain of backendDomains) {
        console.log(`\n=== Testing domain: ${domain} ===`);
        
        const endpoints = [
            `${domain}/iiif/manifest/${manuscriptId}`,
            `${domain}/iiif/manifest/${manuscriptId}.json`,
            `${domain}/iiif/${manuscriptId}/manifest`,
            `${domain}/iiif/${manuscriptId}/manifest.json`,
            `${domain}/api/manifest/${manuscriptId}`,
            `${domain}/api/manifest/${manuscriptId}.json`,
            `${domain}/manifest/${manuscriptId}`,
            `${domain}/manifest/${manuscriptId}.json`,
            `${domain}/${manuscriptId}/manifest`,
            `${domain}/${manuscriptId}/manifest.json`,
            `${domain}/api/${manuscriptId}`,
            `${domain}/api/${manuscriptId}.json`,
            `${domain}/iiif/${manuscriptId}/info.json`,
            `${domain}/image/${manuscriptId}/info.json`
        ];
        
        for (const endpoint of endpoints) {
            try {
                const response = await makeRequest(endpoint);
                console.log(`✓ ${endpoint.replace(domain, '')} - Status: ${response.statusCode}`);
                
                if (response.statusCode === 200) {
                    console.log(`  Content-Type: ${response.headers['content-type']}`);
                    
                    // Check if it's JSON and potentially a manifest
                    if (response.headers['content-type']?.includes('application/json')) {
                        try {
                            const data = JSON.parse(response.body);
                            console.log(`  JSON Response keys:`, Object.keys(data));
                            
                            // Check for IIIF manifest indicators
                            if (data['@context'] || data.context) {
                                console.log(`  *** IIIF Context found! ***`);
                                console.log(`  Context:`, data['@context'] || data.context);
                            }
                            
                            if (data.sequences || data.items || data.canvases) {
                                console.log(`  *** IIIF Manifest found! ***`);
                                console.log(`  Sequences:`, data.sequences?.length || 'N/A');
                                console.log(`  Items:`, data.items?.length || 'N/A');
                                console.log(`  Canvases:`, data.canvases?.length || 'N/A');
                            }
                            
                            if (data.id || data['@id']) {
                                console.log(`  ID:`, data.id || data['@id']);
                            }
                            
                            if (data.type || data['@type']) {
                                console.log(`  Type:`, data.type || data['@type']);
                            }
                            
                            // Save successful manifests
                            if (data.sequences || data.items || data.canvases) {
                                const fs = require('fs');
                                const filename = `.devkit/temp/onb-manifest-${manuscriptId}.json`;
                                fs.writeFileSync(filename, JSON.stringify(data, null, 2));
                                console.log(`  Saved manifest to: ${filename}`);
                            }
                        } catch (e) {
                            console.log(`  JSON parse error: ${e.message}`);
                        }
                    }
                    
                    // Show first 200 characters of response for non-JSON
                    if (!response.headers['content-type']?.includes('application/json')) {
                        const preview = response.body.substring(0, 200);
                        console.log(`  Preview: ${preview}...`);
                    }
                }
            } catch (error) {
                if (error.message.includes('ENOTFOUND')) {
                    console.log(`❌ Domain not found: ${domain}`);
                    break; // Skip other endpoints for this domain
                } else if (error.message.includes('timeout')) {
                    console.log(`⏱ ${endpoint.replace(domain, '')} - Timeout`);
                } else {
                    console.log(`❌ ${endpoint.replace(domain, '')} - ${error.message}`);
                }
            }
        }
    }
    
    // Also try to check the main ONB website for clues
    console.log('\n=== Checking main ONB website ===');
    try {
        const response = await makeRequest('https://www.onb.ac.at');
        console.log(`ONB main website status: ${response.statusCode}`);
        
        // Look for digital collection links
        const digitalLinks = response.body.match(/href="[^"]*digital[^"]*"/gi);
        if (digitalLinks) {
            console.log('Digital collection links found:');
            digitalLinks.slice(0, 5).forEach(link => console.log(`  ${link}`));
        }
        
        // Look for IIIF references
        const iiifRefs = response.body.match(/[^"]*iiif[^"]*\.[^"]*(?:json|xml)/gi);
        if (iiifRefs) {
            console.log('IIIF references found:');
            iiifRefs.slice(0, 5).forEach(ref => console.log(`  ${ref}`));
        }
    } catch (error) {
        console.log(`Error checking main ONB website: ${error.message}`);
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

discoverONBBackend().catch(console.error);