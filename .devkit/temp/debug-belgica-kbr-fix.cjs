const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const zlib = require('zlib');

class BelgicaKbrDebugger {
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
            'Sec-Fetch-Site': 'none',
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
                    
                    // Handle gzip decompression
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

    async analyzeKbrArchitecture(documentUrl) {
        console.log('=== Belgica KBR Architecture Analysis ===');
        console.log(`Document URL: ${documentUrl}`);
        
        const results = {
            documentId: documentUrl.match(/\/BELGICA\/doc\/SYRACUSE\/(\d+)/)?.[1],
            steps: {},
            finalUrls: [],
            errors: []
        };
        
        try {
            // Step 1: Fetch document page
            console.log('\n1. Fetching document page...');
            const docResponse = await this.fetchWithHeaders(documentUrl);
            
            console.log(`   Document page status: ${docResponse.status}`);
            console.log(`   Document page size: ${docResponse.data.length} characters`);
            
            if (docResponse.status !== 200) {
                console.log(`   Document page content: ${docResponse.data.substring(0, 500)}...`);
                throw new Error(`Document page returned ${docResponse.status}: ${docResponse.error || 'Unknown error'}`);
            }
            
            // Save document page for debugging
            fs.writeFileSync(path.join(__dirname, 'document-page-debug.html'), docResponse.data);
            
            // Extract UURL
            const uurlMatch = docResponse.data.match(/https:\/\/uurl\.kbr\.be\/(\d+)/);
            if (!uurlMatch) {
                console.log('   UURL not found. Searching for other patterns...');
                
                // Check for other possible patterns
                const patterns = [
                    /uurl\.kbr\.be\/(\d+)/,
                    /UURL[^"]*(\d+)/,
                    /kbr\.be\/(\d+)/,
                    /iframe[^>]*src="[^"]*uurl[^"]*"/
                ];
                
                for (const pattern of patterns) {
                    const match = docResponse.data.match(pattern);
                    if (match) {
                        console.log(`   Found potential pattern: ${match[0]}`);
                    }
                }
                
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
            
            // Step 2: Fetch UURL page
            console.log('\n2. Fetching UURL page...');
            const uurlResponse = await this.fetchWithHeaders(uurlUrl);
            
            if (uurlResponse.status !== 200) {
                throw new Error(`UURL page returned ${uurlResponse.status}`);
            }
            
            // Extract gallery URL with map parameter
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
            console.log(`   ✓ Gallery URL: ${galleryUrl}`);
            
            // Step 3: Try multiple approaches to access images
            console.log('\n3. Testing image access approaches...');
            
            // Approach 1: Direct directory listing (current failing approach)
            console.log('\n   3a. Testing direct directory listing...');
            const directoryUrl = `https://viewerd.kbr.be/display/${mapPath}`;
            const dirResponse = await this.fetchWithHeaders(directoryUrl);
            
            results.steps.step3a = {
                approach: 'direct_directory',
                url: directoryUrl,
                status: dirResponse.status,
                success: dirResponse.status === 200
            };
            
            if (dirResponse.status === 200) {
                console.log(`   ✓ Directory listing accessible: ${directoryUrl}`);
                
                // Look for image files
                const imageRegex = /BE-KBR00_[^"]*\.jpg/g;
                const imageMatches = dirResponse.data.match(imageRegex) || [];
                
                if (imageMatches.length > 0) {
                    const uniqueImages = Array.from(new Set(imageMatches)).sort();
                    results.finalUrls = uniqueImages.map(filename => 
                        `https://viewerd.kbr.be/display/${mapPath}${filename}`
                    );
                    console.log(`   ✓ Found ${uniqueImages.length} images via directory listing`);
                } else {
                    console.log('   ✗ No images found in directory listing');
                }
            } else {
                console.log(`   ✗ Directory listing failed: ${dirResponse.status} ${dirResponse.error || ''}`);
            }
            
            // Approach 2: Gallery page analysis
            console.log('\n   3b. Analyzing gallery page...');
            const galleryResponse = await this.fetchWithHeaders(galleryUrl);
            
            results.steps.step3b = {
                approach: 'gallery_page',
                url: galleryUrl,
                status: galleryResponse.status,
                success: galleryResponse.status === 200
            };
            
            if (galleryResponse.status === 200) {
                console.log(`   ✓ Gallery page accessible: ${galleryUrl}`);
                
                // Save gallery HTML for analysis
                fs.writeFileSync(path.join(__dirname, 'gallery-page-analysis.html'), galleryResponse.data);
                
                // Look for axZm configuration
                const axzmMatch = galleryResponse.data.match(/ajaxZoom\.queryString\s*=\s*['"](.*?)['"]/);
                if (axzmMatch) {
                    console.log(`   ✓ Found axZm configuration: ${axzmMatch[1]}`);
                    results.steps.step3b.axzmConfig = axzmMatch[1];
                }
                
                // Look for image URLs in the gallery
                const imageUrls = [];
                const galleryImageRegex = /https:\/\/viewerd\.kbr\.be\/display\/[^"'>\s]+\.jpg/g;
                const galleryMatches = galleryResponse.data.match(galleryImageRegex) || [];
                
                for (const match of galleryMatches) {
                    if (!imageUrls.includes(match)) {
                        imageUrls.push(match);
                    }
                }
                
                if (imageUrls.length > 0) {
                    results.finalUrls = imageUrls;
                    console.log(`   ✓ Found ${imageUrls.length} images via gallery analysis`);
                } else {
                    console.log('   ✗ No images found in gallery page');
                }
            } else {
                console.log(`   ✗ Gallery page failed: ${galleryResponse.status} ${galleryResponse.error || ''}`);
            }
            
            // Approach 3: Try with different referrer headers
            console.log('\n   3c. Testing with referrer headers...');
            const referrerHeaders = {
                'Referer': galleryUrl,
                'Origin': 'https://viewerd.kbr.be'
            };
            
            const dirWithReferrerResponse = await this.fetchWithHeaders(directoryUrl, referrerHeaders);
            
            results.steps.step3c = {
                approach: 'with_referrer',
                url: directoryUrl,
                status: dirWithReferrerResponse.status,
                success: dirWithReferrerResponse.status === 200
            };
            
            if (dirWithReferrerResponse.status === 200) {
                console.log(`   ✓ Directory accessible with referrer: ${directoryUrl}`);
                
                const imageRegex = /BE-KBR00_[^"]*\.jpg/g;
                const imageMatches = dirWithReferrerResponse.data.match(imageRegex) || [];
                
                if (imageMatches.length > 0) {
                    const uniqueImages = Array.from(new Set(imageMatches)).sort();
                    results.finalUrls = uniqueImages.map(filename => 
                        `https://viewerd.kbr.be/display/${mapPath}${filename}`
                    );
                    console.log(`   ✓ Found ${uniqueImages.length} images with referrer headers`);
                } else {
                    console.log('   ✗ No images found with referrer headers');
                }
            } else {
                console.log(`   ✗ Directory with referrer failed: ${dirWithReferrerResponse.status} ${dirWithReferrerResponse.error || ''}`);
            }
            
            // Approach 4: Try to enumerate image files by pattern
            console.log('\n   3d. Testing image enumeration...');
            const commonPatterns = [
                'BE-KBR00_000001.jpg',
                'BE-KBR00_000002.jpg',
                'BE-KBR00_000003.jpg',
                'BE-KBR00_000004.jpg',
                'BE-KBR00_000005.jpg',
                'BE-KBR00_001.jpg',
                'BE-KBR00_002.jpg',
                'BE-KBR00_003.jpg',
                'BE-KBR00_004.jpg',
                'BE-KBR00_005.jpg',
                '001.jpg',
                '002.jpg',
                '003.jpg',
                '004.jpg',
                '005.jpg'
            ];
            
            const workingImages = [];
            for (const pattern of commonPatterns) {
                const testUrl = `https://viewerd.kbr.be/display/${mapPath}${pattern}`;
                try {
                    const imageResponse = await this.fetchWithHeaders(testUrl, referrerHeaders);
                    if (imageResponse.status === 200 && imageResponse.data.length > 1000) {
                        workingImages.push(testUrl);
                        console.log(`   ✓ Found working image: ${pattern}`);
                    }
                } catch (error) {
                    // Silent fail for enumeration
                }
            }
            
            results.steps.step3d = {
                approach: 'enumeration',
                workingImages,
                success: workingImages.length > 0
            };
            
            if (workingImages.length > 0) {
                console.log(`   ✓ Found ${workingImages.length} images via enumeration`);
                if (results.finalUrls.length === 0) {
                    results.finalUrls = workingImages;
                }
            } else {
                console.log('   ✗ No images found via enumeration');
            }
            
        } catch (error) {
            console.error(`Analysis failed: ${error.message}`);
            results.errors.push(error.message);
        }
        
        // Save results
        fs.writeFileSync(
            path.join(__dirname, 'belgica-kbr-debug-results.json'),
            JSON.stringify(results, null, 2)
        );
        
        console.log('\n=== Summary ===');
        console.log(`Document ID: ${results.documentId}`);
        console.log(`Steps completed: ${Object.keys(results.steps).length}`);
        console.log(`Final URLs found: ${results.finalUrls.length}`);
        console.log(`Errors: ${results.errors.length}`);
        
        if (results.finalUrls.length > 0) {
            console.log('\n✓ SUCCESS: Found working image URLs');
            console.log('First few URLs:');
            results.finalUrls.slice(0, 3).forEach((url, i) => {
                console.log(`  ${i + 1}. ${url}`);
            });
        } else {
            console.log('\n✗ FAILED: No working image URLs found');
        }
        
        return results;
    }
}

async function main() {
    const analyzer = new BelgicaKbrDebugger();
    const documentUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
    
    try {
        const results = await analyzer.analyzeKbrArchitecture(documentUrl);
        
        // Test a few image URLs if found
        if (results.finalUrls.length > 0) {
            console.log('\n=== Testing Image Access ===');
            
            for (let i = 0; i < Math.min(3, results.finalUrls.length); i++) {
                const imageUrl = results.finalUrls[i];
                console.log(`\nTesting image ${i + 1}: ${imageUrl}`);
                
                try {
                    const response = await analyzer.fetchWithHeaders(imageUrl, {
                        'Referer': 'https://viewerd.kbr.be/gallery.php'
                    });
                    
                    if (response.status === 200) {
                        console.log(`   ✓ Accessible: ${response.data.length} bytes`);
                    } else {
                        console.log(`   ✗ Failed: ${response.status} ${response.error || ''}`);
                    }
                } catch (error) {
                    console.log(`   ✗ Error: ${error.message}`);
                }
            }
        }
        
        console.log('\nDebug analysis complete. Check belgica-kbr-debug-results.json for full results.');
        
    } catch (error) {
        console.error('Debug failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}