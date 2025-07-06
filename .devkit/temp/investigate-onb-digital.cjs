const https = require('https');
const { URL } = require('url');

async function investigateONBDigital() {
    console.log('=== ONB Digital Investigation ===');
    
    const manuscriptId = '1000B160';
    
    // Test the main onb.digital domain
    console.log('\n=== Testing onb.digital domain ===');
    
    try {
        const response = await makeRequest('https://onb.digital');
        console.log(`onb.digital status: ${response.statusCode}`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        
        // Look for manuscript/viewer references
        const viewerRefs = response.body.match(/href="[^"]*viewer[^"]*"/gi);
        if (viewerRefs) {
            console.log('Viewer references found:');
            viewerRefs.slice(0, 5).forEach(ref => console.log(`  ${ref}`));
        }
        
        // Look for API references
        const apiRefs = response.body.match(/[^"]*api[^"]*\.json/gi);
        if (apiRefs) {
            console.log('API references found:');
            apiRefs.slice(0, 5).forEach(ref => console.log(`  ${ref}`));
        }
        
        // Look for IIIF references
        const iiifRefs = response.body.match(/[^"]*iiif[^"]*\.[^"]*(?:json|xml)/gi);
        if (iiifRefs) {
            console.log('IIIF references found:');
            iiifRefs.slice(0, 5).forEach(ref => console.log(`  ${ref}`));
        }
        
        // Look for search patterns
        const searchPatterns = response.body.match(/search[^"]*\?[^"]*id[^"]*/gi);
        if (searchPatterns) {
            console.log('Search patterns found:');
            searchPatterns.slice(0, 5).forEach(pattern => console.log(`  ${pattern}`));
        }
        
    } catch (error) {
        console.log(`Error checking onb.digital: ${error.message}`);
    }
    
    // Try different endpoints on onb.digital
    console.log('\n=== Testing onb.digital endpoints ===');
    
    const endpoints = [
        `https://onb.digital/iiif/manifest/${manuscriptId}`,
        `https://onb.digital/iiif/manifest/${manuscriptId}.json`,
        `https://onb.digital/iiif/${manuscriptId}/manifest`,
        `https://onb.digital/iiif/${manuscriptId}/manifest.json`,
        `https://onb.digital/api/manifest/${manuscriptId}`,
        `https://onb.digital/api/manifest/${manuscriptId}.json`,
        `https://onb.digital/manifest/${manuscriptId}`,
        `https://onb.digital/manifest/${manuscriptId}.json`,
        `https://onb.digital/api/${manuscriptId}`,
        `https://onb.digital/api/${manuscriptId}.json`,
        `https://onb.digital/viewer/${manuscriptId}`,
        `https://onb.digital/search?id=${manuscriptId}`,
        `https://onb.digital/detail/${manuscriptId}`,
        `https://onb.digital/item/${manuscriptId}`,
        `https://onb.digital/object/${manuscriptId}`,
        `https://onb.digital/${manuscriptId}`,
        `https://onb.digital/iiif/${manuscriptId}/info.json`,
        `https://onb.digital/image/${manuscriptId}/info.json`
    ];
    
    for (const endpoint of endpoints) {
        try {
            const response = await makeRequest(endpoint);
            console.log(`✓ ${endpoint.replace('https://onb.digital', '')} - Status: ${response.statusCode}`);
            
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
                        
                        // Check for Austrian National Library specific fields
                        if (data.label || data.title) {
                            console.log(`  Title/Label:`, data.label || data.title);
                        }
                        
                        if (data.metadata) {
                            console.log(`  Metadata fields:`, data.metadata.length);
                        }
                        
                        // Save successful manifests
                        if (data.sequences || data.items || data.canvases) {
                            const fs = require('fs');
                            const filename = `.devkit/temp/onb-digital-manifest-${manuscriptId}.json`;
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
                console.log(`❌ Domain not found: onb.digital`);
                break;
            } else if (error.message.includes('timeout')) {
                console.log(`⏱ ${endpoint.replace('https://onb.digital', '')} - Timeout`);
            } else {
                console.log(`❌ ${endpoint.replace('https://onb.digital', '')} - ${error.message}`);
            }
        }
    }
    
    // Also try to check if there are other viewer patterns
    console.log('\n=== Testing alternative viewer patterns ===');
    
    const viewerPatterns = [
        `https://viewer.onb.ac.at/api/${manuscriptId}`,
        `https://viewer.onb.ac.at/api/${manuscriptId}.json`,
        `https://viewer.onb.ac.at/data/${manuscriptId}`,
        `https://viewer.onb.ac.at/data/${manuscriptId}.json`,
        `https://viewer.onb.ac.at/config/${manuscriptId}`,
        `https://viewer.onb.ac.at/config/${manuscriptId}.json`,
        `https://viewer.onb.ac.at/manuscript/${manuscriptId}`,
        `https://viewer.onb.ac.at/manuscript/${manuscriptId}.json`,
        `https://viewer.onb.ac.at/item/${manuscriptId}`,
        `https://viewer.onb.ac.at/item/${manuscriptId}.json`
    ];
    
    for (const pattern of viewerPatterns) {
        try {
            const response = await makeRequest(pattern);
            console.log(`✓ ${pattern.replace('https://viewer.onb.ac.at', '')} - Status: ${response.statusCode}`);
            
            if (response.statusCode === 200 && response.headers['content-type']?.includes('application/json')) {
                try {
                    const data = JSON.parse(response.body);
                    console.log(`  JSON Response keys:`, Object.keys(data));
                    
                    // Save any successful JSON responses
                    const fs = require('fs');
                    const filename = `.devkit/temp/onb-viewer-data-${manuscriptId}.json`;
                    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
                    console.log(`  Saved data to: ${filename}`);
                } catch (e) {
                    console.log(`  JSON parse error: ${e.message}`);
                }
            }
        } catch (error) {
            if (error.message.includes('timeout')) {
                console.log(`⏱ ${pattern.replace('https://viewer.onb.ac.at', '')} - Timeout`);
            } else {
                console.log(`❌ ${pattern.replace('https://viewer.onb.ac.at', '')} - ${error.message}`);
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
        
        req.setTimeout(5000, () => {
            req.abort();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

investigateONBDigital().catch(console.error);