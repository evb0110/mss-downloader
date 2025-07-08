const https = require('https');
const fs = require('fs');
const path = require('path');

// Test implementation for University of Toronto library
// Handle both patterns:
// 1. Direct IIIF: https://iiif.library.utoronto.ca/presentation/v2/mscodex0001/manifest
// 2. Collections: https://collections.library.utoronto.ca/view/fisher2:F6521

async function testTorontoImplementation() {
    console.log('🧪 Testing University of Toronto Implementation...');
    
    const testUrls = [
        // Direct IIIF pattern (existing)
        'https://iiif.library.utoronto.ca/presentation/v2/mscodex0001/manifest',
        
        // Collections pattern (new)
        'https://collections.library.utoronto.ca/view/fisher2:F6521'
    ];
    
    const results = [];
    
    for (const url of testUrls) {
        console.log(`\n🔍 Testing: ${url}`);
        
        try {
            const result = await processTorontoUrl(url);
            results.push({
                url,
                success: true,
                result
            });
            
            console.log(`✅ Success: Found ${result.totalPages} pages`);
            
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            results.push({
                url,
                success: false,
                error: error.message
            });
        }
    }
    
    // Save test results
    fs.writeFileSync(
        path.join(__dirname, 'toronto-implementation-test-results.json'),
        JSON.stringify(results, null, 2)
    );
    
    console.log('\n📋 Test Results Summary:');
    results.forEach(result => {
        console.log(`- ${result.url}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    });
    
    return results;
}

async function processTorontoUrl(url) {
    const library = detectLibraryType(url);
    if (library !== 'toronto') {
        throw new Error('URL not recognized as Toronto library');
    }
    
    return await loadTorontoManifest(url);
}

function detectLibraryType(url) {
    // Updated detection logic to handle both patterns
    if (url.includes('iiif.library.utoronto.ca') || url.includes('collections.library.utoronto.ca')) {
        return 'toronto';
    }
    return null;
}

async function loadTorontoManifest(torontoUrl) {
    try {
        let manifestUrl = torontoUrl;
        let displayName = 'University of Toronto Manuscript';
        
        // Handle collections.library.utoronto.ca URLs
        if (torontoUrl.includes('collections.library.utoronto.ca')) {
            // Extract item ID from URL: https://collections.library.utoronto.ca/view/fisher2:F6521
            const viewMatch = torontoUrl.match(/\/view\/([^\/]+)/);
            if (viewMatch) {
                const itemId = viewMatch[1];
                displayName = `University of Toronto - ${itemId}`;
                
                // Try different manifest URL patterns
                const manifestPatterns = [
                    `https://iiif.library.utoronto.ca/presentation/v2/${itemId}/manifest`,
                    `https://iiif.library.utoronto.ca/presentation/v2/${itemId.replace(':', '%3A')}/manifest`,
                    `https://iiif.library.utoronto.ca/presentation/v3/${itemId}/manifest`,
                    `https://iiif.library.utoronto.ca/presentation/v3/${itemId.replace(':', '%3A')}/manifest`,
                    `https://collections.library.utoronto.ca/iiif/${itemId}/manifest`,
                    `https://collections.library.utoronto.ca/iiif/${itemId.replace(':', '%3A')}/manifest`,
                    `https://collections.library.utoronto.ca/api/iiif/${itemId}/manifest`,
                    `https://collections.library.utoronto.ca/api/iiif/${itemId.replace(':', '%3A')}/manifest`
                ];
                
                console.log(`🔍 Extracted item ID: ${itemId}`);
                console.log('🧪 Testing manifest URLs...');
                
                for (const testUrl of manifestPatterns) {
                    try {
                        console.log(`  Testing: ${testUrl}`);
                        const response = await fetchDirect(testUrl);
                        if (response.ok) {
                            const content = await response.text();
                            if (content.includes('"@context"') && (content.includes('manifest') || content.includes('Manifest'))) {
                                manifestUrl = testUrl;
                                console.log(`  ✅ Found working manifest: ${testUrl}`);
                                break;
                            }
                        }
                    } catch (error) {
                        console.log(`  ❌ Failed: ${error.message}`);
                    }
                }
                
                if (manifestUrl === torontoUrl) {
                    throw new Error(`No working manifest URL found for item ${itemId}`);
                }
            } else {
                throw new Error('Could not extract item ID from collections URL');
            }
        }
        
        // Handle direct IIIF URLs
        else if (torontoUrl.includes('iiif.library.utoronto.ca')) {
            if (!torontoUrl.includes('/manifest')) {
                manifestUrl = torontoUrl.endsWith('/') ? `${torontoUrl}manifest` : `${torontoUrl}/manifest`;
            }
        }
        
        // Load IIIF manifest
        console.log(`📄 Loading manifest: ${manifestUrl}`);
        const response = await fetchDirect(manifestUrl);
        if (!response.ok) {
            throw new Error(`Failed to load manifest: ${response.status} ${response.statusText}`);
        }
        
        const manifestText = await response.text();
        const manifest = JSON.parse(manifestText);
        
        // Process manifest to extract page URLs
        const pageLinks = [];
        
        // Handle IIIF v2 structure
        if (manifest.sequences && manifest.sequences.length > 0) {
            console.log('📊 Processing IIIF v2 manifest...');
            const sequence = manifest.sequences[0];
            
            if (sequence.canvases) {
                for (const canvas of sequence.canvases) {
                    if (canvas.images && canvas.images.length > 0) {
                        const image = canvas.images[0];
                        const resource = image.resource || image;
                        
                        let maxResUrl = resource['@id'];
                        
                        // Check for IIIF service
                        if (resource.service && resource.service['@id']) {
                            const serviceId = resource.service['@id'];
                            // Use maximum quality parameters for Toronto IIIF
                            maxResUrl = `${serviceId}/full/max/0/default.jpg`;
                        } else if (maxResUrl.includes('/full/')) {
                            // Fallback: ensure maximum resolution
                            const serviceBase = maxResUrl.split('/full/')[0];
                            maxResUrl = `${serviceBase}/full/max/0/default.jpg`;
                        }
                        
                        pageLinks.push(maxResUrl);
                    }
                }
            }
        }
        
        // Handle IIIF v3 structure
        else if (manifest.items && manifest.items.length > 0) {
            console.log('📊 Processing IIIF v3 manifest...');
            
            for (const item of manifest.items) {
                if (item.items && item.items.length > 0) {
                    const annotationPage = item.items[0];
                    if (annotationPage.items && annotationPage.items.length > 0) {
                        const annotation = annotationPage.items[0];
                        if (annotation.body) {
                            let maxResUrl = annotation.body.id;
                            
                            // Check for IIIF service
                            if (annotation.body.service) {
                                const service = Array.isArray(annotation.body.service) ? annotation.body.service[0] : annotation.body.service;
                                if (service && service.id) {
                                    maxResUrl = `${service.id}/full/max/0/default.jpg`;
                                }
                            }
                            
                            pageLinks.push(maxResUrl);
                        }
                    }
                }
            }
        }
        
        if (pageLinks.length === 0) {
            throw new Error('No images found in manifest');
        }
        
        console.log(`📊 Found ${pageLinks.length} pages`);
        
        // Test first few image URLs
        console.log('🧪 Testing image URLs...');
        for (let i = 0; i < Math.min(3, pageLinks.length); i++) {
            try {
                const testResponse = await fetchDirect(pageLinks[i], { method: 'HEAD' });
                const contentLength = testResponse.headers.get('content-length');
                console.log(`  Page ${i + 1}: ${pageLinks[i]} - Size: ${contentLength || 'Unknown'} bytes`);
            } catch (error) {
                console.log(`  Page ${i + 1}: ERROR - ${error.message}`);
            }
        }
        
        return {
            pageLinks,
            totalPages: pageLinks.length,
            library: 'toronto',
            displayName,
            originalUrl: torontoUrl,
            manifestUrl: manifestUrl
        };
        
    } catch (error) {
        throw new Error(`Failed to load University of Toronto manuscript: ${error.message}`);
    }
}

async function fetchDirect(url, options = {}) {
    const defaultOptions = {
        method: options.method || 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            ...options.headers
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = https.request(url, defaultOptions, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                if (defaultOptions.method !== 'HEAD') {
                    data += chunk;
                }
            });
            
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    headers: new Map(Object.entries(res.headers)),
                    text: () => Promise.resolve(data)
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.setTimeout(15000, () => {
            req.abort();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

// Run the test
testTorontoImplementation().then(() => {
    console.log('\n✅ Test completed successfully');
}).catch(error => {
    console.error('\n❌ Test failed:', error);
});