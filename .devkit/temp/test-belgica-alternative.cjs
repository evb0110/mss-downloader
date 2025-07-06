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

async function testAlternativeDocuments() {
    console.log('=== TESTING ALTERNATIVE BELGICA KBR DOCUMENTS ===');
    
    // Test different document URLs from search results
    const testUrls = [
        'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16863699', // Euripides' Medea
        'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/10741832', // Manuscript provisional record
    ];
    
    for (const testUrl of testUrls) {
        console.log(`\n=== Testing: ${testUrl} ===`);
        
        try {
            // Step 1: Fetch document page
            const documentResponse = await fetch(testUrl, {
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
            
            console.log(`Document Status: ${documentResponse.status} ${documentResponse.statusText}`);
            
            if (documentResponse.ok) {
                const documentPageHtml = await documentResponse.text();
                console.log(`Document page length: ${documentPageHtml.length} characters`);
                
                // Check if document page contains UURL
                const uurlMatch = documentPageHtml.match(/https:\/\/uurl\.kbr\.be\/(\d+)/);
                if (uurlMatch) {
                    console.log(`✓ Found UURL: ${uurlMatch[0]}`);
                    
                    // Test UURL access
                    const uurlResponse = await fetch(uurlMatch[0], {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Referer': testUrl
                        }
                    });
                    
                    console.log(`UURL Status: ${uurlResponse.status} ${uurlResponse.statusText}`);
                    
                    if (uurlResponse.ok) {
                        const uurlPageHtml = await uurlResponse.text();
                        console.log(`UURL page length: ${uurlPageHtml.length} characters`);
                        
                        // Extract map parameter
                        const mapMatch = uurlPageHtml.match(/map=([^"'&]+)/);
                        if (mapMatch) {
                            console.log(`✓ Found map parameter: ${mapMatch[1]}`);
                            
                            // Test AJAX-Zoom batch endpoint for this document
                            const batchUrl = `https://viewerd.kbr.be/AJAX/axZm/zoomBatch.php?zoomDir=display/${mapMatch[1]}`;
                            console.log(`Testing batch endpoint: ${batchUrl}`);
                            
                            const batchResponse = await fetch(batchUrl, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                    'Accept': '*/*',
                                    'Referer': `https://viewerd.kbr.be/gallery.php?map=${mapMatch[1]}`
                                }
                            });
                            
                            console.log(`Batch Status: ${batchResponse.status} ${batchResponse.statusText}`);
                            
                            if (batchResponse.ok) {
                                const batchContent = await batchResponse.text();
                                console.log(`Batch response length: ${batchContent.length} characters`);
                                console.log(`Batch response preview: ${batchContent.substring(0, 500)}`);
                                
                                // Check if it requires password
                                if (batchContent.includes('password')) {
                                    console.log('⚠ This document requires password authentication');
                                } else {
                                    console.log('✓ Document appears to be publicly accessible');
                                }
                            } else {
                                console.log('✗ Batch endpoint failed');
                            }
                        } else {
                            console.log('✗ Map parameter not found');
                        }
                    } else {
                        console.log('✗ UURL access failed');
                    }
                } else {
                    console.log('✗ UURL not found in document page');
                    
                    // Check if document exists but has different structure
                    if (documentPageHtml.includes('viewer') || documentPageHtml.includes('image')) {
                        console.log('ℹ Document may use different viewer technology');
                    } else {
                        console.log('ℹ Document may not have images available');
                    }
                }
            } else {
                console.log('✗ Document page access failed');
            }
            
        } catch (error) {
            console.error(`Error testing ${testUrl}: ${error.message}`);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

testAlternativeDocuments().catch(console.error);