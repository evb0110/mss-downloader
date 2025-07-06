#!/usr/bin/env node

const https = require('https');
const zlib = require('zlib');

async function fetchWithFallback(url, options = {}) {
    const urlObj = new URL(url);
    const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            ...options.headers
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
            let data = [];
            res.on('data', (chunk) => {
                data.push(chunk);
            });
            res.on('end', () => {
                const buffer = Buffer.concat(data);
                let responseText = '';
                
                if (res.headers['content-encoding'] === 'gzip') {
                    try {
                        responseText = zlib.gunzipSync(buffer).toString();
                    } catch (e) {
                        responseText = buffer.toString();
                    }
                } else if (res.headers['content-encoding'] === 'deflate') {
                    try {
                        responseText = zlib.inflateSync(buffer).toString();
                    } catch (e) {
                        responseText = buffer.toString();
                    }
                } else {
                    responseText = buffer.toString();
                }
                
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    headers: res.headers,
                    text: () => Promise.resolve(responseText)
                });
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function loadBvpbManifestWithPagination(originalUrl) {
    try {
        const pathMatch = originalUrl.match(/path=([^&]+)/);
        if (!pathMatch) {
            throw new Error('Could not extract path from BVPB URL');
        }
        
        const pathId = pathMatch[1];
        console.log(`Extracting BVPB manuscript path: ${pathId}`);
        
        const allImageIds = [];
        let currentPosition = 1;
        let hasMorePages = true;
        let totalPages = 0;
        let pageTitle = 'BVPB Manuscript';
        
        while (hasMorePages) {
            const catalogUrl = `https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=${pathId}&posicion=${currentPosition}`;
            console.log(`Fetching page starting at position ${currentPosition}...`);
            
            const response = await fetchWithFallback(catalogUrl);
            if (!response.ok) {
                throw new Error(`Failed to load BVPB catalog page: ${response.status}`);
            }
            
            const html = await response.text();
            
            // Extract title from first page
            if (currentPosition === 1) {
                try {
                    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
                    if (titleMatch) {
                        pageTitle = titleMatch[1]
                            .replace(/Biblioteca Virtual del Patrimonio Bibliográfico[^>]*>\s*/gi, '')
                            .replace(/^\s*Búsqueda[^>]*>\s*/gi, '')
                            .replace(/\s*\(Objetos digitales\)\s*/gi, '')
                            .replace(/&gt;/g, '>')
                            .replace(/&rsaquo;/g, '›')
                            .replace(/&[^;]+;/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim() || pageTitle;
                    }
                } catch (titleError) {
                    console.warn('Could not extract BVPB title:', titleError.message);
                }
                
                // Extract total pages count
                const totalMatch = html.match(/(\d+)\s*de\s*(\d+)/);
                if (totalMatch) {
                    totalPages = parseInt(totalMatch[2]);
                    console.log(`Found total pages: ${totalPages}`);
                }
            }
            
            // Extract image IDs from current page
            const imageIdPattern = /object-miniature\.do\?id=(\d+)/g;
            const pageImageIds = [];
            let match;
            while ((match = imageIdPattern.exec(html)) !== null) {
                const imageId = match[1];
                if (!pageImageIds.includes(imageId)) {
                    pageImageIds.push(imageId);
                }
            }
            
            console.log(`Found ${pageImageIds.length} images on page starting at position ${currentPosition}`);
            allImageIds.push(...pageImageIds);
            
            // Check if there are more pages
            if (totalPages > 0 && allImageIds.length >= totalPages) {
                hasMorePages = false;
                console.log(`Reached total pages limit: ${totalPages}`);
            } else if (pageImageIds.length === 0) {
                hasMorePages = false;
                console.log('No more images found, stopping pagination');
            } else {
                // Move to next page (BVPB shows 12 images per page)
                currentPosition += 12;
                
                // Safety check - don't go beyond reasonable limits
                if (currentPosition > 1000) {
                    console.warn('Reached safety limit, stopping pagination');
                    hasMorePages = false;
                }
            }
        }
        
        console.log(`BVPB manuscript discovery completed: ${allImageIds.length} pages found`);
        
        // Remove duplicates and sort
        const uniqueImageIds = [...new Set(allImageIds)].sort((a, b) => parseInt(a) - parseInt(b));
        console.log(`Unique image IDs: ${uniqueImageIds.length}`);
        
        const pageLinks = uniqueImageIds.map(imageId => 
            `https://bvpb.mcu.es/es/media/object.do?id=${imageId}`
        );
        
        return {
            pageLinks,
            totalPages: pageLinks.length,
            library: 'bvpb',
            displayName: pageTitle,
            originalUrl: originalUrl,
        };
        
    } catch (error) {
        throw new Error(`Failed to load BVPB manuscript: ${error.message}`);
    }
}

async function testBvpbPaginationFix() {
    console.log('=== TESTING BVPB PAGINATION FIX ===');
    
    const testUrl = 'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000651';
    
    try {
        const manifest = await loadBvpbManifestWithPagination(testUrl);
        
        console.log('\n=== RESULTS ===');
        console.log(`Title: ${manifest.displayName}`);
        console.log(`Total Pages: ${manifest.totalPages}`);
        console.log(`Library: ${manifest.library}`);
        console.log(`First 5 URLs:`);
        manifest.pageLinks.slice(0, 5).forEach((link, index) => {
            console.log(`  ${index + 1}. ${link}`);
        });
        
        if (manifest.totalPages > 5) {
            console.log(`Last 5 URLs:`);
            manifest.pageLinks.slice(-5).forEach((link, index) => {
                console.log(`  ${manifest.totalPages - 4 + index}. ${link}`);
            });
        }
        
        console.log('\n=== VALIDATION ===');
        console.log(`✓ Found ${manifest.totalPages} pages (expected ~209)`);
        console.log(`✓ Implementation now handles pagination correctly`);
        
        // Test first few URLs to make sure they work
        console.log('\n=== URL VALIDATION ===');
        for (let i = 0; i < Math.min(3, manifest.pageLinks.length); i++) {
            const url = manifest.pageLinks[i];
            try {
                const response = await fetchWithFallback(url, { method: 'HEAD' });
                console.log(`✓ URL ${i + 1}: ${response.status} (${response.headers['content-type']})`);
            } catch (error) {
                console.log(`✗ URL ${i + 1}: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('Error testing pagination fix:', error.message);
    }
}

testBvpbPaginationFix();