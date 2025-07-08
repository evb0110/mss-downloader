const https = require('https');
const fs = require('fs');
const path = require('path');

// University of Toronto Collections Analysis
// URL: https://collections.library.utoronto.ca/view/fisher2:F6521
// This is a different URL pattern than the existing IIIF implementation

async function analyzeTorontoCollections() {
    console.log('🔍 Analyzing University of Toronto Collections URL Pattern...');
    
    const testUrl = 'https://collections.library.utoronto.ca/view/fisher2:F6521';
    const itemId = 'fisher2:F6521';
    
    try {
        // 1. Try to fetch the main collections page
        console.log('\n📄 Fetching collections page...');
        const mainPageContent = await fetchUrl(testUrl, {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        });
        
        // Save the page content for analysis
        fs.writeFileSync(
            path.join(__dirname, `toronto-collections-page-${itemId.replace(':', '-')}.html`),
            mainPageContent
        );
        
        console.log('✅ Collections page fetched successfully');
        
        // 2. Look for IIIF manifest patterns in the collections page
        console.log('\n🔍 Searching for IIIF manifest patterns...');
        const manifestPatterns = [
            /manifest[^"']*\.json/gi,
            /iiif[^"']*manifest/gi,
            /manifest[^"']*iiif/gi,
            /"manifest"\s*:\s*"([^"]+)"/gi,
            /data-manifest[^"']*"([^"]+)"/gi,
            /manifest[_-]?url[^"']*"([^"]+)"/gi,
            /https?:\/\/[^"']*iiif[^"']*manifest[^"']*/gi,
            /https?:\/\/[^"']*manifest[^"']*iiif[^"']*/gi
        ];
        
        const foundManifests = [];
        manifestPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(mainPageContent)) !== null) {
                foundManifests.push(match[0]);
            }
        });
        
        if (foundManifests.length > 0) {
            console.log('Found manifest patterns:', foundManifests);
        }
        
        // 3. Test various IIIF manifest URL constructions
        console.log('\n🧪 Testing IIIF manifest URL patterns...');
        
        const potentialManifestUrls = [
            // Direct IIIF manifest URLs based on existing implementation
            `https://iiif.library.utoronto.ca/presentation/v2/${itemId}/manifest`,
            `https://iiif.library.utoronto.ca/presentation/v2/${itemId.replace(':', '%3A')}/manifest`,
            `https://iiif.library.utoronto.ca/presentation/v3/${itemId}/manifest`,
            `https://iiif.library.utoronto.ca/presentation/v3/${itemId.replace(':', '%3A')}/manifest`,
            
            // Collections-based manifest URLs
            `https://collections.library.utoronto.ca/iiif/${itemId}/manifest`,
            `https://collections.library.utoronto.ca/iiif/${itemId.replace(':', '%3A')}/manifest`,
            `https://collections.library.utoronto.ca/api/iiif/${itemId}/manifest`,
            `https://collections.library.utoronto.ca/api/iiif/${itemId.replace(':', '%3A')}/manifest`,
            
            // Alternative formats
            `https://digitalcollections.library.utoronto.ca/iiif/${itemId}/manifest`,
            `https://digitalcollections.library.utoronto.ca/iiif/${itemId.replace(':', '%3A')}/manifest`,
            `https://iiif.library.utoronto.ca/manifest/${itemId}`,
            `https://iiif.library.utoronto.ca/manifest/${itemId.replace(':', '%3A')}`,
            
            // Try JSON extensions
            `https://collections.library.utoronto.ca/iiif/${itemId}.json`,
            `https://collections.library.utoronto.ca/api/iiif/${itemId}.json`,
            `https://iiif.library.utoronto.ca/presentation/v2/${itemId}.json`,
            `https://iiif.library.utoronto.ca/presentation/v3/${itemId}.json`
        ];
        
        let workingManifest = null;
        
        for (const url of potentialManifestUrls) {
            try {
                console.log(`Testing: ${url}`);
                const response = await fetchUrl(url);
                
                if (response.includes('"@context"') && (response.includes('manifest') || response.includes('Manifest'))) {
                    console.log(`✅ Found working manifest: ${url}`);
                    
                    // Parse and analyze the manifest
                    const manifest = JSON.parse(response);
                    await analyzeManifest(manifest, url);
                    
                    // Save the manifest
                    fs.writeFileSync(
                        path.join(__dirname, `toronto-collections-manifest-${itemId.replace(':', '-')}.json`),
                        JSON.stringify(manifest, null, 2)
                    );
                    
                    workingManifest = { url, manifest };
                    break;
                }
            } catch (error) {
                console.log(`❌ Failed: ${error.message}`);
            }
        }
        
        if (!workingManifest) {
            // 4. Try to find API endpoints in the page
            console.log('\n🔍 Searching for API endpoints in page content...');
            const apiPatterns = [
                /api[^"']*\/[^"']*json/gi,
                /\/api\/[^"']+/gi,
                /data-api[^"']*"([^"]+)"/gi,
                /apiUrl[^"']*"([^"]+)"/gi,
                /endpoint[^"']*"([^"]+)"/gi,
                /https?:\/\/[^"']*api[^"']*/gi
            ];
            
            apiPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(mainPageContent)) !== null) {
                    console.log('Found API pattern:', match[0]);
                }
            });
            
            // 5. Look for viewer configuration
            console.log('\n👁️ Searching for viewer configuration...');
            const viewerPatterns = [
                /viewer[^"']*config[^"']*/gi,
                /config[^"']*viewer[^"']*/gi,
                /data-viewer[^"']*"([^"]+)"/gi,
                /viewerUrl[^"']*"([^"]+)"/gi
            ];
            
            viewerPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(mainPageContent)) !== null) {
                    console.log('Found viewer pattern:', match[0]);
                }
            });
        }
        
        return {
            success: !!workingManifest,
            manifestUrl: workingManifest?.url,
            manifest: workingManifest?.manifest,
            itemId: itemId,
            originalUrl: testUrl
        };
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        return {
            success: false,
            error: error.message,
            itemId: itemId,
            originalUrl: testUrl
        };
    }
}

async function analyzeManifest(manifest, manifestUrl) {
    console.log('\n📊 Analyzing manifest structure...');
    
    console.log('Manifest @context:', manifest['@context']);
    console.log('Manifest @type:', manifest['@type'] || manifest.type);
    console.log('Manifest label:', manifest.label || 'No label');
    console.log('Manifest viewingDirection:', manifest.viewingDirection || 'Not specified');
    
    // IIIF v2 structure
    if (manifest.sequences && manifest.sequences.length > 0) {
        console.log('IIIF v2 Structure:');
        const sequence = manifest.sequences[0];
        console.log('- Canvases:', sequence.canvases?.length || 0);
        
        if (sequence.canvases && sequence.canvases.length > 0) {
            const canvas = sequence.canvases[0];
            console.log('- First canvas:', canvas['@id'] || canvas.id);
            console.log('- Canvas dimensions:', canvas.width, 'x', canvas.height);
            
            if (canvas.images && canvas.images.length > 0) {
                const image = canvas.images[0];
                const resource = image.resource || image;
                console.log('- Image resource:', resource['@id'] || resource.id);
                
                if (resource.service) {
                    console.log('- Image service:', resource.service['@id'] || resource.service.id);
                    console.log('- Service profile:', resource.service.profile || resource.service['@context']);
                    
                    // Test maximum resolution
                    const serviceId = resource.service['@id'] || resource.service.id;
                    const testUrls = [
                        `${serviceId}/full/max/0/default.jpg`,
                        `${serviceId}/full/full/0/default.jpg`,
                        `${serviceId}/full/2000,/0/default.jpg`,
                        `${serviceId}/full/4000,/0/default.jpg`,
                        `${serviceId}/full/!2000,2000/0/default.jpg`,
                        `${serviceId}/full/pct:100/0/default.jpg`
                    ];
                    
                    console.log('\n🔍 Testing image resolution options...');
                    for (const testUrl of testUrls) {
                        try {
                            const response = await fetchUrlHead(testUrl);
                            const contentLength = response.headers['content-length'];
                            console.log(`✅ ${testUrl} - Size: ${contentLength || 'Unknown'} bytes`);
                        } catch (error) {
                            console.log(`❌ ${testUrl} - Error: ${error.message}`);
                        }
                    }
                }
            }
        }
    }
    
    // IIIF v3 structure
    if (manifest.items && manifest.items.length > 0) {
        console.log('IIIF v3 Structure:');
        const item = manifest.items[0];
        console.log('- Items:', manifest.items.length);
        console.log('- First item:', item.id);
        console.log('- Item dimensions:', item.width, 'x', item.height);
        
        if (item.items && item.items.length > 0) {
            const annotationPage = item.items[0];
            if (annotationPage.items && annotationPage.items.length > 0) {
                const annotation = annotationPage.items[0];
                if (annotation.body) {
                    console.log('- Image body:', annotation.body.id);
                    if (annotation.body.service) {
                        const service = Array.isArray(annotation.body.service) ? annotation.body.service[0] : annotation.body.service;
                        console.log('- Image service:', service.id);
                        console.log('- Service profile:', service.profile);
                    }
                }
            }
        }
    }
}

function fetchUrl(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                ...headers
            }
        };
        
        const req = https.get(url, options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.setTimeout(15000, () => {
            req.abort();
            reject(new Error('Request timeout'));
        });
    });
}

function fetchUrlHead(url) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };
        
        const req = https.request(url, options, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ headers: res.headers, statusCode: res.statusCode });
            } else {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            }
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

// Run the analysis
analyzeTorontoCollections().then(result => {
    console.log('\n📋 Analysis Result:', result);
    
    // Save analysis results
    fs.writeFileSync(
        path.join(__dirname, 'toronto-collections-analysis.json'),
        JSON.stringify(result, null, 2)
    );
    
    console.log('\n✅ Analysis completed. Results saved to toronto-collections-analysis.json');
}).catch(error => {
    console.error('❌ Analysis failed:', error);
});