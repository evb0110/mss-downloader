const https = require('https');
const fs = require('fs');
const path = require('path');

async function fetchUrl(url, options = {}) {
    console.log(`\nFetching: ${url}`);
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': options.acceptHeader || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
                ...options.headers
            },
            rejectUnauthorized: false,
            timeout: 60000
        };
        
        const req = https.request(reqOptions, (res) => {
            const elapsed = Date.now() - startTime;
            console.log(`Response: ${res.statusCode} in ${elapsed}ms`);
            console.log(`Headers:`, res.headers);
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data, elapsed, headers: res.headers }));
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        req.end();
    });
}

async function fetchNBMViewer(codice) {
    // Fetch the viewer page
    const viewerUrl = `https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=${codice}`;
    const result = await fetchUrl(viewerUrl);
    
    if (result.status === 200) {
        console.log(`\nAnalyzing HTML response for codice=${codice}...`);
        fs.writeFileSync(`.devkit/reports/verona-nbm-response.html`, result.data);
        
        // Look for iframe src
        const iframeMatch = result.data.match(/<iframe[^>]+src=["']([^"']+)["'][^>]*>/i);
        if (iframeMatch) {
            console.log(`Found iframe src: ${iframeMatch[1]}`);
            
            // If it's a relative URL, make it absolute
            let iframeUrl = iframeMatch[1];
            if (!iframeUrl.startsWith('http')) {
                if (iframeUrl.startsWith('/')) {
                    iframeUrl = `https://nbm.regione.veneto.it${iframeUrl}`;
                } else {
                    iframeUrl = `https://nbm.regione.veneto.it/${iframeUrl}`;
                }
            }
            
            console.log(`\nFetching iframe content from: ${iframeUrl}`);
            const iframeResult = await fetchUrl(iframeUrl);
            
            if (iframeResult.status === 200) {
                // Look for manifest in iframe content
                const manifestMatches = iframeResult.data.match(/manifest[^"']*\.json/gi);
                if (manifestMatches) {
                    console.log('Found manifest references in iframe:');
                    manifestMatches.forEach(m => console.log(`  ${m}`));
                }
                
                // Look for data attributes or script vars
                const dataManifestMatch = iframeResult.data.match(/data-manifest=["']([^"']+)["']/i);
                if (dataManifestMatch) {
                    console.log(`Found data-manifest: ${dataManifestMatch[1]}`);
                }
                
                // Check for JavaScript variables
                const varMatches = iframeResult.data.match(/var\s+\w*manifest\w*\s*=\s*["']([^"']+)["']/gi);
                if (varMatches) {
                    console.log('Found JavaScript manifest variables:');
                    varMatches.forEach(m => console.log(`  ${m}`));
                }
            }
        }
    }
    
    return result;
}

async function testVerona() {
    console.log('Testing Verona Library access patterns...\n');
    
    // Test NBM viewer pages
    const testCodices = [15, 14, 16];
    
    for (const codice of testCodices) {
        console.log(`\n=== Testing codice=${codice} ===`);
        try {
            await fetchNBMViewer(codice);
        } catch (error) {
            console.log(`Error: ${error.message}`);
        }
    }
    
    // Test known manifest mapping
    console.log('\n\n=== Testing known manifest mappings ===');
    const manifestMappings = {
        '14': 'CVII1001',
        '15': 'LXXXIX841',
        '16': 'CVI913',
        '17': 'msClasseIII81'
    };
    
    for (const [codice, manifestId] of Object.entries(manifestMappings)) {
        console.log(`\nTesting manifest for codice=${codice} (${manifestId}):`);
        
        try {
            const manifestUrl = `https://nbm.regione.veneto.it/documenti/mirador_json/manifest/${manifestId}.json`;
            const result = await fetchUrl(manifestUrl, {
                acceptHeader: 'application/json, application/ld+json;q=0.9, */*;q=0.8'
            });
            
            if (result.status === 200) {
                const manifest = JSON.parse(result.data);
                console.log('✓ Manifest loaded successfully');
                console.log(`  Label: ${manifest.label || manifest['@label'] || 'No label'}`);
                console.log(`  Canvases: ${manifest.sequences?.[0]?.canvases?.length || 0}`);
                
                // Save manifest
                fs.writeFileSync(`.devkit/reports/verona-manifest-${codice}.json`, JSON.stringify(manifest, null, 2));
                
                // Test first image
                const firstCanvas = manifest.sequences?.[0]?.canvases?.[0];
                if (firstCanvas) {
                    const imageUrl = firstCanvas.images?.[0]?.resource?.['@id'];
                    if (imageUrl) {
                        console.log(`  First image URL: ${imageUrl}`);
                        
                        // Quick test of image URL
                        try {
                            const imgResult = await fetchUrl(imageUrl, {
                                acceptHeader: 'image/jpeg, image/png, image/*'
                            });
                            console.log(`  Image status: ${imgResult.status} (${imgResult.elapsed}ms)`);
                            if (imgResult.headers['content-type']) {
                                console.log(`  Content-Type: ${imgResult.headers['content-type']}`);
                                console.log(`  Content-Length: ${imgResult.headers['content-length'] || 'unknown'}`);
                            }
                        } catch (imgError) {
                            console.log(`  Image error: ${imgError.message}`);
                        }
                    }
                }
            } else {
                console.log(`✗ Manifest failed with status ${result.status}`);
            }
        } catch (error) {
            console.log(`✗ Error: ${error.message}`);
        }
    }
}

testVerona().then(() => {
    console.log('\n\nTest completed. Check .devkit/reports/ for saved responses.');
}).catch(error => {
    console.error('Test failed:', error);
});