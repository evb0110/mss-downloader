#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
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
                
                // Handle gzip/deflate compression
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
                    text: () => Promise.resolve(responseText),
                    json: () => Promise.resolve(JSON.parse(responseText))
                });
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function analyzeBvpbDetailed() {
    try {
        console.log('=== BVPB DETAILED ANALYSIS ===');
        const testUrl = 'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000651';
        
        const response = await fetchWithFallback(testUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        console.log('HTML Length:', html.length);
        console.log('Content-Type:', response.headers['content-type']);
        
        // Save decompressed HTML
        fs.writeFileSync('./bvpb-decompressed.html', html);
        console.log('Decompressed HTML saved');
        
        // Find all image references
        console.log('\n=== IMAGE PATTERN ANALYSIS ===');
        const imagePatterns = [
            /object-miniature\.do\?id=(\d+)/g,
            /object\.do\?id=(\d+)/g,
            /media\/object\.do\?id=(\d+)/g,
            /imagen\.do\?id=(\d+)/g,
            /visualizador\.do\?id=(\d+)/g,
            /thumbnail\.do\?id=(\d+)/g,
            /id=(\d+)/g
        ];
        
        const allImageIds = new Set();
        imagePatterns.forEach((pattern, index) => {
            const matches = [...html.matchAll(pattern)];
            console.log(`Pattern ${index + 1} (${pattern.source}): ${matches.length} matches`);
            matches.forEach(match => allImageIds.add(match[1]));
        });
        
        console.log(`Total unique image IDs found: ${allImageIds.size}`);
        const sortedIds = Array.from(allImageIds).sort((a, b) => parseInt(a) - parseInt(b));
        console.log('Image IDs:', sortedIds.slice(0, 20).join(', ') + (sortedIds.length > 20 ? '...' : ''));
        
        // Look for navigation/pagination
        console.log('\n=== NAVIGATION ANALYSIS ===');
        const navPatterns = [
            /href="[^"]*siguiente[^"]*"/gi,
            /href="[^"]*anterior[^"]*"/gi,
            /href="[^"]*next[^"]*"/gi,
            /href="[^"]*prev[^"]*"/gi,
            /href="[^"]*page[^"]*"/gi,
            /href="[^"]*pagina[^"]*"/gi,
            /href="[^"]*offset[^"]*"/gi,
            /href="[^"]*inicio[^"]*"/gi,
            /href="[^"]*final[^"]*"/gi
        ];
        
        navPatterns.forEach((pattern, index) => {
            const matches = html.match(pattern);
            if (matches) {
                console.log(`Navigation Pattern ${index + 1}:`, matches);
            }
        });
        
        // Look for pagination links with parameters
        console.log('\n=== PAGINATION PARAMETERS ===');
        const paginationRegex = /href="([^"]*grupo\.do[^"]*path=11000651[^"]*)"/g;
        const paginationMatches = [...html.matchAll(paginationRegex)];
        console.log(`Found ${paginationMatches.length} pagination links:`);
        paginationMatches.forEach((match, index) => {
            console.log(`  ${index + 1}. ${match[1]}`);
        });
        
        // Look for total count indicators
        console.log('\n=== TOTAL COUNT ANALYSIS ===');
        const countPatterns = [
            /(\d+)\s*de\s*(\d+)/g,
            /total[^:]*:\s*(\d+)/gi,
            /(\d+)\s*results?/gi,
            /(\d+)\s*elementos?/gi,
            /(\d+)\s*objetos?/gi,
            /página\s*(\d+)\s*de\s*(\d+)/gi,
            /mostrando\s*(\d+)\s*[-–]\s*(\d+)\s*de\s*(\d+)/gi
        ];
        
        countPatterns.forEach((pattern, index) => {
            const matches = [...html.matchAll(pattern)];
            if (matches.length > 0) {
                console.log(`Count Pattern ${index + 1}:`, matches.map(m => m[0]));
            }
        });
        
        // Look for JavaScript variables that might contain page info
        console.log('\n=== JAVASCRIPT VARIABLES ===');
        const jsVarPatterns = [
            /var\s+\w*[Pp]age\w*\s*=\s*[^;]+/g,
            /var\s+\w*[Tt]otal\w*\s*=\s*[^;]+/g,
            /var\s+\w*[Cc]ount\w*\s*=\s*[^;]+/g,
            /var\s+\w*[Ii]mages?\w*\s*=\s*[^;]+/g,
            /var\s+\w*[Dd]ata\w*\s*=\s*[^;]+/g
        ];
        
        jsVarPatterns.forEach((pattern, index) => {
            const matches = html.match(pattern);
            if (matches) {
                console.log(`JS Variable Pattern ${index + 1}:`, matches);
            }
        });
        
        // Look for forms that might control pagination
        console.log('\n=== FORM CONTROLS ===');
        const formPattern = /<form[^>]*>(.*?)<\/form>/gis;
        const formMatches = [...html.matchAll(formPattern)];
        console.log(`Found ${formMatches.length} forms`);
        formMatches.forEach((formMatch, index) => {
            console.log(`\nForm ${index + 1}:`);
            const form = formMatch[1];
            
            // Look for pagination-related inputs
            const inputPattern = /<input[^>]*>/gi;
            const inputs = form.match(inputPattern);
            if (inputs) {
                inputs.forEach((input, inputIndex) => {
                    if (input.includes('page') || input.includes('offset') || input.includes('limit') || input.includes('start') || input.includes('end')) {
                        console.log(`  Input ${inputIndex + 1}: ${input}`);
                    }
                });
            }
            
            // Look for select elements
            const selectPattern = /<select[^>]*>.*?<\/select>/gis;
            const selects = form.match(selectPattern);
            if (selects) {
                selects.forEach((select, selectIndex) => {
                    console.log(`  Select ${selectIndex + 1}: ${select.substring(0, 200)}...`);
                });
            }
        });
        
        // Test if there are more pages by looking for "next" pattern
        console.log('\n=== NEXT PAGE DETECTION ===');
        if (html.includes('siguiente') || html.includes('next') || html.includes('»')) {
            console.log('✓ Pagination indicators found - more pages likely exist');
        } else {
            console.log('✗ No obvious pagination indicators found');
        }
        
        // Check for AJAX endpoints
        console.log('\n=== AJAX ENDPOINT DETECTION ===');
        const ajaxPatterns = [
            /url\s*:\s*['"']([^'"]*)['"']/g,
            /fetch\s*\(\s*['"']([^'"]*)['"']/g,
            /XMLHttpRequest.*open\s*\(\s*['"']\w+['"']\s*,\s*['"']([^'"]*)['"']/g
        ];
        
        ajaxPatterns.forEach((pattern, index) => {
            const matches = [...html.matchAll(pattern)];
            if (matches.length > 0) {
                console.log(`AJAX Pattern ${index + 1}:`, matches.map(m => m[1]));
            }
        });
        
        console.log('\n=== SUMMARY ===');
        console.log(`- Found ${sortedIds.length} total image IDs`);
        console.log(`- Current implementation would capture: ${Math.min(sortedIds.length, 12)} images`);
        console.log(`- Potential missing images: ${Math.max(0, sortedIds.length - 12)}`);
        console.log('- Next steps: Implement pagination traversal or find complete image list endpoint');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

analyzeBvpbDetailed();