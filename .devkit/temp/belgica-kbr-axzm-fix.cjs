const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const zlib = require('zlib');

class BelgicaKbrAxZmFix {
    constructor() {
        this.baseHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Cache-Control': 'max-age=0'
        };
        
        this.timeout = 30000;
    }

    async fetchWithHeaders(url, additionalHeaders = {}) {
        const headers = { ...this.baseHeaders, ...additionalHeaders };
        
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers: headers,
                timeout: this.timeout
            };
            
            const req = protocol.request(options, (res) => {
                let data = Buffer.alloc(0);
                
                res.on('data', (chunk) => {
                    data = Buffer.concat([data, chunk]);
                });
                
                res.on('end', () => {
                    let finalData = data;
                    
                    if (res.headers['content-encoding'] === 'gzip') {
                        try {
                            finalData = zlib.gunzipSync(data);
                        } catch (error) {
                            console.error('Gzip decompression error:', error.message);
                        }
                    } else if (res.headers['content-encoding'] === 'deflate') {
                        try {
                            finalData = zlib.inflateSync(data);
                        } catch (error) {
                            console.error('Deflate decompression error:', error.message);
                        }
                    } else if (res.headers['content-encoding'] === 'br') {
                        try {
                            finalData = zlib.brotliDecompressSync(data);
                        } catch (error) {
                            console.error('Brotli decompression error:', error.message);
                        }
                    }
                    
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: finalData.toString('utf8'),
                        url: url
                    });
                });
            });
            
            req.on('error', (error) => {
                resolve({
                    status: 0,
                    headers: {},
                    data: '',
                    url: url,
                    error: error.message
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                resolve({
                    status: 0,
                    headers: {},
                    data: '',
                    url: url,
                    error: 'Request timeout'
                });
            });
            
            req.end();
        });
    }

    async fetchBinary(url, headers = {}) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers: { ...this.baseHeaders, ...headers },
                timeout: this.timeout
            };
            
            const req = protocol.request(options, (res) => {
                let data = Buffer.alloc(0);
                
                res.on('data', (chunk) => {
                    data = Buffer.concat([data, chunk]);
                });
                
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: data,
                        url: url
                    });
                });
            });
            
            req.on('error', (error) => {
                resolve({
                    status: 0,
                    headers: {},
                    data: Buffer.alloc(0),
                    url: url,
                    error: error.message
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                resolve({
                    status: 0,
                    headers: {},
                    data: Buffer.alloc(0),
                    url: url,
                    error: 'Request timeout'
                });
            });
            
            req.end();
        });
    }

    async fixBelgicaKbrDownload(documentUrl) {
        console.log('=== Belgica KBR axZm Fix Implementation ===');
        console.log(`Document URL: ${documentUrl}`);
        
        const results = {
            documentId: documentUrl.match(/\/BELGICA\/doc\/SYRACUSE\/(\d+)/)?.[1],
            steps: {},
            imageUrls: [],
            errors: []
        };
        
        try {
            // Step 1: Extract UURL from document page
            console.log('\n1. Extracting UURL from document page...');
            const docResponse = await this.fetchWithHeaders(documentUrl);
            
            if (docResponse.status !== 200) {
                throw new Error(`Document page returned ${docResponse.status}`);
            }
            
            const uurlMatch = docResponse.data.match(/https:\/\/uurl\.kbr\.be\/(\d+)/);
            if (!uurlMatch) {
                throw new Error('Could not find UURL in document page');
            }
            
            const uurlId = uurlMatch[1];
            const uurlUrl = `https://uurl.kbr.be/${uurlId}`;
            
            results.steps.step1 = {
                success: true,
                uurlId,
                uurlUrl
            };
            
            console.log(`   ✓ Found UURL: ${uurlUrl}`);
            
            // Step 2: Extract map path from UURL
            console.log('\n2. Extracting map path from UURL...');
            const uurlResponse = await this.fetchWithHeaders(uurlUrl);
            
            if (uurlResponse.status !== 200) {
                throw new Error(`UURL page returned ${uurlResponse.status}`);
            }
            
            const mapMatch = uurlResponse.data.match(/map=([^"'&]+)/);
            if (!mapMatch) {
                throw new Error('Could not find map parameter in UURL page');
            }
            
            const mapPath = mapMatch[1];
            const galleryUrl = `https://viewerd.kbr.be/gallery.php?map=${mapPath}`;
            
            results.steps.step2 = {
                success: true,
                mapPath,
                galleryUrl
            };
            
            console.log(`   ✓ Found map path: ${mapPath}`);
            
            // Step 3: Get axZm configuration from gallery page
            console.log('\n3. Analyzing axZm configuration...');
            const galleryResponse = await this.fetchWithHeaders(galleryUrl);
            
            if (galleryResponse.status !== 200) {
                throw new Error(`Gallery page returned ${galleryResponse.status}`);
            }
            
            results.steps.step3 = {
                success: true,
                galleryUrl
            };
            
            console.log(`   ✓ Gallery page accessible`);
            
            // Step 4: Use axZm API to get image information
            console.log('\n4. Querying axZm API for image data...');
            
            const axzmApiUrl = `https://viewerd.kbr.be/AJAX/axZm/zoomLoad.php`;
            const axzmHeaders = {
                'Referer': galleryUrl,
                'Origin': 'https://viewerd.kbr.be',
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            };
            
            // Try different axZm API approaches
            const apiAttempts = [
                // Approach 1: Direct zoomDir query
                {
                    name: 'zoomDir query',
                    params: `zoomDir=display/${mapPath}&example=full&idn_dir=${mapPath}`
                },
                // Approach 2: Gallery query
                {
                    name: 'gallery query',
                    params: `zoomDir=display/${mapPath}&example=gallery&idn_dir=${mapPath}`
                },
                // Approach 3: Info query
                {
                    name: 'info query',
                    params: `zoomDir=display/${mapPath}&example=info&idn_dir=${mapPath}`
                }
            ];
            
            let workingImages = [];
            
            for (const attempt of apiAttempts) {
                console.log(`\n   4${String.fromCharCode(97 + apiAttempts.indexOf(attempt))}. Testing ${attempt.name}...`);
                
                const apiUrl = `${axzmApiUrl}?${attempt.params}`;
                const apiResponse = await this.fetchWithHeaders(apiUrl, axzmHeaders);
                
                console.log(`       Status: ${apiResponse.status}`);
                
                if (apiResponse.status === 200) {
                    console.log(`       Response length: ${apiResponse.data.length} characters`);
                    
                    // Save API response for analysis
                    fs.writeFileSync(
                        path.join(__dirname, `axzm-${attempt.name.replace(/\s+/g, '-')}-response.json`),
                        apiResponse.data
                    );
                    
                    // Try to parse as JSON
                    try {
                        const apiData = JSON.parse(apiResponse.data);
                        console.log(`       ✓ Valid JSON response`);
                        
                        // Look for image URLs in the response
                        if (apiData.images && Array.isArray(apiData.images)) {
                            console.log(`       ✓ Found ${apiData.images.length} images in response`);
                            workingImages = apiData.images.map(img => 
                                img.url || img.src || img.path || img
                            );
                        } else if (apiData.pic && Array.isArray(apiData.pic)) {
                            console.log(`       ✓ Found ${apiData.pic.length} pics in response`);
                            workingImages = apiData.pic.map(pic => 
                                pic.url || pic.src || pic.path || pic
                            );
                        } else {
                            console.log(`       Available keys: ${Object.keys(apiData).join(', ')}`);
                        }
                    } catch (parseError) {
                        console.log(`       ✗ Not valid JSON: ${parseError.message}`);
                    }
                } else {
                    console.log(`       ✗ Failed: ${apiResponse.status} ${apiResponse.error || ''}`);
                }
                
                if (workingImages.length > 0) {
                    console.log(`       ✓ Found ${workingImages.length} images via ${attempt.name}`);
                    break;
                }
            }
            
            // Step 5: If axZm API fails, try directory enumeration with proper headers
            if (workingImages.length === 0) {
                console.log('\n5. Attempting directory enumeration with session headers...');
                
                const sessionHeaders = {
                    'Referer': galleryUrl,
                    'Origin': 'https://viewerd.kbr.be',
                    'Cookie': 'viewer_session=active' // Try to establish session
                };
                
                // Try common image patterns
                const imagePatterns = [
                    'BE-KBR00_000001.jpg',
                    'BE-KBR00_000002.jpg',
                    'BE-KBR00_000003.jpg',
                    'BE-KBR00_000004.jpg',
                    'BE-KBR00_000005.jpg',
                    'BE-KBR00_000006.jpg',
                    'BE-KBR00_000007.jpg',
                    'BE-KBR00_000008.jpg',
                    'BE-KBR00_000009.jpg',
                    'BE-KBR00_000010.jpg',
                    '1.jpg',
                    '2.jpg',
                    '3.jpg',
                    '4.jpg',
                    '5.jpg',
                    '6.jpg',
                    '7.jpg',
                    '8.jpg',
                    '9.jpg',
                    '10.jpg'
                ];
                
                const discoveredImages = [];
                
                for (const pattern of imagePatterns) {
                    const testUrl = `https://viewerd.kbr.be/display/${mapPath}${pattern}`;
                    const imageResponse = await this.fetchBinary(testUrl, sessionHeaders);
                    
                    if (imageResponse.status === 200 && imageResponse.data.length > 10000) {
                        console.log(`   ✓ Found working image: ${pattern} (${imageResponse.data.length} bytes)`);
                        discoveredImages.push(testUrl);
                    } else if (imageResponse.status === 200) {
                        console.log(`   ? Small response for ${pattern}: ${imageResponse.data.length} bytes`);
                    }
                }
                
                if (discoveredImages.length > 0) {
                    workingImages = discoveredImages;
                    console.log(`   ✓ Found ${discoveredImages.length} images via enumeration`);
                } else {
                    console.log('   ✗ No images found via enumeration');
                }
            }
            
            // Step 6: Test maximum resolution parameters
            if (workingImages.length > 0) {
                console.log('\n6. Testing maximum resolution options...');
                
                const testImage = workingImages[0];
                const resolutionTests = [
                    { name: 'original', url: testImage },
                    { name: 'max quality', url: testImage.replace('.jpg', '_max.jpg') },
                    { name: 'full resolution', url: testImage.replace('.jpg', '_full.jpg') },
                    { name: 'high quality', url: testImage.replace('.jpg', '_high.jpg') }
                ];
                
                let bestUrl = testImage;
                let maxSize = 0;
                
                for (const test of resolutionTests) {
                    const testResponse = await this.fetchBinary(test.url, {
                        'Referer': galleryUrl,
                        'Origin': 'https://viewerd.kbr.be'
                    });
                    
                    if (testResponse.status === 200) {
                        console.log(`   ✓ ${test.name}: ${testResponse.data.length} bytes`);
                        if (testResponse.data.length > maxSize) {
                            maxSize = testResponse.data.length;
                            bestUrl = test.url;
                        }
                    } else {
                        console.log(`   ✗ ${test.name}: ${testResponse.status}`);
                    }
                }
                
                console.log(`   ✓ Best resolution: ${bestUrl} (${maxSize} bytes)`);
                
                // Update all URLs to use best resolution pattern
                if (bestUrl !== testImage) {
                    const pattern = bestUrl.replace(testImage, '');
                    workingImages = workingImages.map(url => url + pattern);
                }
            }
            
            results.imageUrls = workingImages;
            
        } catch (error) {
            console.error(`Fix failed: ${error.message}`);
            results.errors.push(error.message);
        }
        
        // Save results
        fs.writeFileSync(
            path.join(__dirname, 'belgica-kbr-fix-results.json'),
            JSON.stringify(results, null, 2)
        );
        
        console.log('\n=== Fix Implementation Results ===');
        console.log(`Document ID: ${results.documentId}`);
        console.log(`Steps completed: ${Object.keys(results.steps).length}`);
        console.log(`Image URLs found: ${results.imageUrls.length}`);
        console.log(`Errors: ${results.errors.length}`);
        
        if (results.imageUrls.length > 0) {
            console.log('\n✓ SUCCESS: Found working image URLs');
            console.log('Image URLs:');
            results.imageUrls.forEach((url, i) => {
                console.log(`  ${i + 1}. ${url}`);
            });
        } else {
            console.log('\n✗ FAILED: No working image URLs found');
        }
        
        return results;
    }
}

async function main() {
    const fixer = new BelgicaKbrAxZmFix();
    const documentUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
    
    try {
        const results = await fixer.fixBelgicaKbrDownload(documentUrl);
        
        if (results.imageUrls.length > 0) {
            console.log('\n=== Testing Final Image URLs ===');
            
            for (let i = 0; i < Math.min(3, results.imageUrls.length); i++) {
                const imageUrl = results.imageUrls[i];
                console.log(`\nTesting image ${i + 1}: ${imageUrl}`);
                
                const response = await fixer.fetchBinary(imageUrl, {
                    'Referer': 'https://viewerd.kbr.be/gallery.php',
                    'Origin': 'https://viewerd.kbr.be'
                });
                
                if (response.status === 200) {
                    console.log(`   ✓ Accessible: ${response.data.length} bytes`);
                    
                    // Save first image as test
                    if (i === 0) {
                        fs.writeFileSync(
                            path.join(__dirname, 'belgica-kbr-test-image.jpg'),
                            response.data
                        );
                        console.log(`   ✓ Saved test image: belgica-kbr-test-image.jpg`);
                    }
                } else {
                    console.log(`   ✗ Failed: ${response.status} ${response.error || ''}`);
                }
            }
        }
        
        console.log('\nFix implementation complete. Check belgica-kbr-fix-results.json for full results.');
        
    } catch (error) {
        console.error('Fix failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}