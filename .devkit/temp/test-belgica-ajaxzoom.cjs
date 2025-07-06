const https = require('https');
const http = require('http');
const { URL } = require('url');
const zlib = require('zlib');
const fs = require('fs');

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

async function testAjaxZoom() {
    console.log('=== BELGICA KBR AJAX-ZOOM ANALYSIS ===');
    
    const originalUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
    const mapPath = 'A/1/5/8/9/4/8/5/0000-00-00_00/';
    const baseUrl = 'https://viewerd.kbr.be/';
    
    // Test AJAX-Zoom endpoints
    const testUrls = [
        // Directory listing
        `${baseUrl}AJAX/axZm/zoomLoad.php?zoomDir=display/${mapPath}`,
        
        // Map/info query
        `${baseUrl}AJAX/axZm/zoomLoad.php?zoomData=eNpLtDK0qs60MrROtDKyqi4G8pQKlKyLrYyBDH1HfUN9U30LfUt9EyBpqm9cMAS6YBRvYKAPUgZUlaZknWRlYF1bC1wwuzYSCg,,&example=map&idn_dir=${mapPath}`,
        
        // Info query
        `${baseUrl}AJAX/axZm/zoomLoad.php?zoomDir=display/${mapPath}&example=info`,
        
        // Full example
        `${baseUrl}AJAX/axZm/zoomLoad.php?zoomDir=display/${mapPath}&example=full`,
        
        // Direct directory access
        `${baseUrl}display/${mapPath}`,
        
        // Thumbs query
        `${baseUrl}AJAX/axZm/zoomLoad.php?zoomDir=display/${mapPath}&example=thumbs`,
        
        // Batch query
        `${baseUrl}AJAX/axZm/zoomBatch.php?zoomDir=display/${mapPath}`,
        
        // Download query
        `${baseUrl}AJAX/axZm/zoomDownload.php?zoomDir=display/${mapPath}`,
    ];
    
    for (const testUrl of testUrls) {
        console.log(`\n=== Testing: ${testUrl} ===`);
        
        try {
            const response = await fetch(testUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'Referer': `${baseUrl}gallery.php?map=${mapPath}`
                }
            });
            
            console.log(`Status: ${response.status} ${response.statusText}`);
            console.log(`Content-Type: ${response.headers.get('content-type')}`);
            
            if (response.ok) {
                const content = await response.text();
                console.log(`Response length: ${content.length} characters`);
                console.log(`First 500 characters: ${content.substring(0, 500)}`);
                
                // Save successful responses
                const filename = testUrl.split('/').pop().replace(/[^a-zA-Z0-9.-]/g, '_');
                fs.writeFileSync(`/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/temp/axzm-${filename}-response.txt`, content);
                console.log(`Response saved to axzm-${filename}-response.txt`);
            } else {
                console.log('Request failed');
            }
        } catch (error) {
            console.log(`Error: ${error.message}`);
        }
    }
    
    // Test if there are any direct image files in the directory
    console.log('\n=== Testing Direct Image Access ===');
    const imagePatterns = [
        '1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg',
        '001.jpg', '002.jpg', '003.jpg', '004.jpg', '005.jpg',
        '0001.jpg', '0002.jpg', '0003.jpg', '0004.jpg', '0005.jpg',
        'BE-KBR00_1.jpg', 'BE-KBR00_2.jpg', 'BE-KBR00_3.jpg',
        'BE-KBR00_001.jpg', 'BE-KBR00_002.jpg', 'BE-KBR00_003.jpg',
        'BE-KBR00_0001.jpg', 'BE-KBR00_0002.jpg', 'BE-KBR00_0003.jpg',
        'page_1.jpg', 'page_2.jpg', 'page_3.jpg',
        'img_1.jpg', 'img_2.jpg', 'img_3.jpg',
        'image_1.jpg', 'image_2.jpg', 'image_3.jpg'
    ];
    
    for (const pattern of imagePatterns.slice(0, 10)) { // Test first 10 patterns
        const imageUrl = `${baseUrl}display/${mapPath}${pattern}`;
        console.log(`\nTesting image: ${imageUrl}`);
        
        try {
            const response = await fetch(imageUrl, {
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
                    'Referer': `${baseUrl}gallery.php?map=${mapPath}`
                }
            });
            
            console.log(`Status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const imageData = await response.arrayBuffer();
                console.log(`✓ Found image: ${pattern} (${imageData.byteLength} bytes)`);
                if (imageData.byteLength > 1000) {
                    console.log(`✓ Valid image size for ${pattern}`);
                    break; // Found a working pattern
                }
            } else {
                console.log(`✗ ${pattern} not found`);
            }
        } catch (error) {
            console.log(`✗ Error testing ${pattern}: ${error.message}`);
        }
    }
}

testAjaxZoom().catch(console.error);