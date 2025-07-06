const https = require('https');
const http = require('http');
const { URL } = require('url');
const zlib = require('zlib');

// Simple fetch implementation for Node.js with gzip support
function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const req = client.request({
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        }, (res) => {
            let stream = res;
            
            // Handle gzip compression
            if (res.headers['content-encoding'] === 'gzip') {
                stream = zlib.createGunzip();
                res.pipe(stream);
            } else if (res.headers['content-encoding'] === 'deflate') {
                stream = zlib.createInflate();
                res.pipe(stream);
            }
            
            let data = '';
            stream.on('data', chunk => data += chunk);
            stream.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    headers: {
                        get: (name) => res.headers[name.toLowerCase()]
                    },
                    text: () => Promise.resolve(data),
                    arrayBuffer: () => Promise.resolve(Buffer.from(data, 'binary'))
                });
            });
            
            stream.on('error', reject);
        });
        
        req.on('error', reject);
        req.end();
    });
}

async function diagnosticTest() {
    const originalUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
    
    console.log('=== BELGICA KBR DIAGNOSTIC TEST ===');
    console.log(`Testing URL: ${originalUrl}`);
    
    try {
        // Step 1: Test direct access to the document page
        console.log('\n1. Testing direct access to document page...');
        const documentResponse = await fetch(originalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1'
            }
        });
        
        console.log(`Status: ${documentResponse.status}`);
        console.log(`Status Text: ${documentResponse.statusText}`);
        console.log(`Content-Type: ${documentResponse.headers.get('content-type')}`);
        
        if (documentResponse.ok) {
            const documentPageHtml = await documentResponse.text();
            console.log(`Page length: ${documentPageHtml.length} characters`);
            
            // Check if it's actually the document page we expect
            if (documentPageHtml.includes('BELGICA')) {
                console.log('✓ Document page loaded successfully');
                
                // Look for UURL pattern
                const uurlMatch = documentPageHtml.match(/https:\/\/uurl\.kbr\.be\/(\d+)/);
                if (uurlMatch) {
                    console.log(`✓ Found UURL ID: ${uurlMatch[1]}`);
                    console.log(`✓ UURL: ${uurlMatch[0]}`);
                    
                    // Test UURL access
                    console.log('\n2. Testing UURL access...');
                    const uurlResponse = await fetch(uurlMatch[0], {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'DNT': '1',
                            'Connection': 'keep-alive',
                            'Upgrade-Insecure-Requests': '1',
                            'Sec-Fetch-Dest': 'document',
                            'Sec-Fetch-Mode': 'navigate',
                            'Sec-Fetch-Site': 'cross-site',
                            'Referer': originalUrl
                        }
                    });
                    
                    console.log(`UURL Status: ${uurlResponse.status}`);
                    console.log(`UURL Status Text: ${uurlResponse.statusText}`);
                    
                    if (uurlResponse.ok) {
                        const uurlPageHtml = await uurlResponse.text();
                        console.log(`UURL page length: ${uurlPageHtml.length} characters`);
                        
                        // Look for map parameter
                        const mapMatch = uurlPageHtml.match(/map=([^"'&]+)/);
                        if (mapMatch) {
                            console.log(`✓ Found map parameter: ${mapMatch[1]}`);
                            
                            // Test gallery access
                            console.log('\n3. Testing gallery access...');
                            const galleryUrl = `https://viewerd.kbr.be/gallery.php?map=${mapMatch[1]}`;
                            const galleryResponse = await fetch(galleryUrl, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                    'Accept-Language': 'en-US,en;q=0.5',
                                    'Accept-Encoding': 'gzip, deflate, br',
                                    'DNT': '1',
                                    'Connection': 'keep-alive',
                                    'Upgrade-Insecure-Requests': '1',
                                    'Sec-Fetch-Dest': 'iframe',
                                    'Sec-Fetch-Mode': 'navigate',
                                    'Sec-Fetch-Site': 'cross-site',
                                    'Referer': uurlMatch[0]
                                }
                            });
                            
                            console.log(`Gallery Status: ${galleryResponse.status}`);
                            console.log(`Gallery Status Text: ${galleryResponse.statusText}`);
                            
                            if (galleryResponse.ok) {
                                const galleryPageHtml = await galleryResponse.text();
                                console.log(`Gallery page length: ${galleryPageHtml.length} characters`);
                                console.log('✓ Gallery page loaded successfully');
                                
                                // Test image access
                                console.log('\n4. Testing image access...');
                                const testImageUrl = `https://viewerd.kbr.be/display/${mapMatch[1]}BE-KBR00_0001.jpg`;
                                const imageResponse = await fetch(testImageUrl, {
                                    headers: {
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                                        'Accept-Language': 'en-US,en;q=0.5',
                                        'Accept-Encoding': 'gzip, deflate, br',
                                        'DNT': '1',
                                        'Connection': 'keep-alive',
                                        'Sec-Fetch-Dest': 'image',
                                        'Sec-Fetch-Mode': 'no-cors',
                                        'Sec-Fetch-Site': 'same-origin',
                                        'Referer': galleryUrl
                                    }
                                });
                                
                                console.log(`Image Status: ${imageResponse.status}`);
                                console.log(`Image Status Text: ${imageResponse.statusText}`);
                                console.log(`Image Content-Type: ${imageResponse.headers.get('content-type')}`);
                                
                                if (imageResponse.ok) {
                                    const imageData = await imageResponse.arrayBuffer();
                                    console.log(`Image size: ${imageData.byteLength} bytes`);
                                    if (imageData.byteLength > 1000) {
                                        console.log('✓ Valid image found!');
                                    } else {
                                        console.log('⚠ Image too small, might be error page');
                                    }
                                } else {
                                    console.log('✗ Image access failed');
                                }
                            } else {
                                console.log('✗ Gallery access failed');
                            }
                        } else {
                            console.log('✗ Map parameter not found in UURL page');
                        }
                    } else {
                        console.log('✗ UURL access failed');
                    }
                } else {
                    console.log('✗ UURL not found in document page');
                    
                    // Save document page for analysis
                    const fs = require('fs');
                    fs.writeFileSync('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/temp/belgica-document-page.html', documentPageHtml);
                    console.log('Document page saved for analysis');
                    
                    // Show first 1000 characters to understand content
                    console.log('\nFirst 1000 characters of document page:');
                    console.log(documentPageHtml.substring(0, 1000));
                }
            } else {
                console.log('✗ Document page does not contain expected BELGICA content');
                
                // Save document page for analysis
                const fs = require('fs');
                fs.writeFileSync('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/temp/belgica-document-page.html', documentPageHtml);
                console.log('Document page saved for analysis');
                
                // Show first 1000 characters to understand content
                console.log('\nFirst 1000 characters of document page:');
                console.log(documentPageHtml.substring(0, 1000));
            }
        } else {
            console.log('✗ Document page access failed');
        }
        
    } catch (error) {
        console.error('Error during diagnostic test:', error.message);
        console.error(error.stack);
    }
}

diagnosticTest().catch(console.error);