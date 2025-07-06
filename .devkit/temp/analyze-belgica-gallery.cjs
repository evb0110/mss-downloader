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

async function analyzeGallery() {
    const originalUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
    
    console.log('=== BELGICA KBR GALLERY ANALYSIS ===');
    
    try {
        // Get the document page
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
        
        const documentPageHtml = await documentResponse.text();
        const uurlMatch = documentPageHtml.match(/https:\/\/uurl\.kbr\.be\/(\d+)/);
        
        if (!uurlMatch) {
            throw new Error('Could not find UURL');
        }
        
        const uurlUrl = uurlMatch[0];
        console.log(`Found UURL: ${uurlUrl}`);
        
        // Get the UURL page
        const uurlResponse = await fetch(uurlUrl, {
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
        
        const uurlPageHtml = await uurlResponse.text();
        const mapMatch = uurlPageHtml.match(/map=([^"'&]+)/);
        
        if (!mapMatch) {
            throw new Error('Could not find map parameter');
        }
        
        const mapPath = mapMatch[1];
        console.log(`Found map path: ${mapPath}`);
        
        // Get the gallery page
        const galleryUrl = `https://viewerd.kbr.be/gallery.php?map=${mapPath}`;
        console.log(`Gallery URL: ${galleryUrl}`);
        
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
                'Referer': uurlUrl
            }
        });
        
        const galleryPageHtml = await galleryResponse.text();
        
        // Save gallery page for analysis
        fs.writeFileSync('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/temp/belgica-gallery-page.html', galleryPageHtml);
        console.log('Gallery page saved for analysis');
        
        // Look for image references in the gallery page
        console.log('\n=== ANALYZING GALLERY PAGE FOR IMAGE PATTERNS ===');
        
        // Look for various image patterns
        const imagePatterns = [
            /src="[^"]*\/display\/[^"]*\.jpg"/g,
            /src="[^"]*\/display\/[^"]*\.jpeg"/g,
            /src="[^"]*\/display\/[^"]*\.png"/g,
            /\/display\/[^"'\s]*\.(jpg|jpeg|png|gif)/g,
            /BE-KBR\d*_\d+\.(jpg|jpeg|png|gif)/g,
            /\w+_\d+\.(jpg|jpeg|png|gif)/g,
            /\d+\.(jpg|jpeg|png|gif)/g
        ];
        
        for (const pattern of imagePatterns) {
            const matches = galleryPageHtml.match(pattern);
            if (matches && matches.length > 0) {
                console.log(`\nFound ${matches.length} matches for pattern: ${pattern}`);
                matches.slice(0, 10).forEach((match, index) => {
                    console.log(`  ${index + 1}: ${match}`);
                });
                if (matches.length > 10) {
                    console.log(`  ... and ${matches.length - 10} more`);
                }
            }
        }
        
        // Look for JavaScript variables that might contain image data
        console.log('\n=== LOOKING FOR JAVASCRIPT IMAGE DATA ===');
        
        const jsPatterns = [
            /var\s+\w+\s*=\s*\[[\s\S]*?\]/g,
            /var\s+\w+\s*=\s*\{[\s\S]*?\}/g,
            /images\s*=\s*\[[\s\S]*?\]/g,
            /pages\s*=\s*\[[\s\S]*?\]/g,
            /tiles\s*=\s*\[[\s\S]*?\]/g
        ];
        
        for (const pattern of jsPatterns) {
            const matches = galleryPageHtml.match(pattern);
            if (matches && matches.length > 0) {
                console.log(`\nFound ${matches.length} JS data structures:`);
                matches.slice(0, 5).forEach((match, index) => {
                    console.log(`  ${index + 1}: ${match.substring(0, 200)}...`);
                });
            }
        }
        
        // Look for AJAX URLs or API endpoints
        console.log('\n=== LOOKING FOR AJAX/API ENDPOINTS ===');
        
        const ajaxPatterns = [
            /https?:\/\/[^"'\s]+\.php[^"'\s]*/g,
            /https?:\/\/[^"'\s]+\/api\/[^"'\s]*/g,
            /\.php\?[^"'\s]+/g,
            /url\s*:\s*['""]([^'"]+)['"]/g,
            /ajax\s*:\s*['""]([^'"]+)['"]/g
        ];
        
        for (const pattern of ajaxPatterns) {
            const matches = galleryPageHtml.match(pattern);
            if (matches && matches.length > 0) {
                console.log(`\nFound ${matches.length} AJAX/API endpoints:`);
                matches.slice(0, 10).forEach((match, index) => {
                    console.log(`  ${index + 1}: ${match}`);
                });
            }
        }
        
        // Show relevant sections of the gallery page
        console.log('\n=== GALLERY PAGE HEAD SECTION ===');
        const headMatch = galleryPageHtml.match(/<head[\s\S]*?<\/head>/i);
        if (headMatch) {
            console.log(headMatch[0].substring(0, 1000));
        }
        
        console.log('\n=== GALLERY PAGE BODY SECTION (first 2000 chars) ===');
        const bodyMatch = galleryPageHtml.match(/<body[\s\S]*?<\/body>/i);
        if (bodyMatch) {
            console.log(bodyMatch[0].substring(0, 2000));
        }
        
    } catch (error) {
        console.error('Error during gallery analysis:', error.message);
    }
}

analyzeGallery().catch(console.error);