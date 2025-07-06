#!/usr/bin/env node

const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

/**
 * Analyze Rouen viewer page to find page count patterns
 */

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.rotomagus.fr/',
                ...options.headers
            },
            timeout: 30000
        }, (res) => {
            const chunks = [];
            
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                let buffer = Buffer.concat(chunks);
                
                // Handle compression
                const encoding = res.headers['content-encoding'];
                if (encoding === 'gzip') {
                    buffer = zlib.gunzipSync(buffer);
                } else if (encoding === 'deflate') {
                    buffer = zlib.inflateSync(buffer);
                } else if (encoding === 'br') {
                    buffer = zlib.brotliDecompressSync(buffer);
                }
                
                const data = buffer.toString('utf8');
                
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data,
                    url: url
                });
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => reject(new Error('Request timeout')));
        req.end();
    });
}

async function analyzeRouenViewer() {
    const viewerUrl = 'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.item.zoom';
    
    console.log('🔍 Analyzing Rouen viewer page for page count patterns...');
    console.log(`📋 Fetching: ${viewerUrl}`);
    
    try {
        const response = await makeRequest(viewerUrl);
        
        console.log(`✅ Status: ${response.statusCode}`);
        console.log(`📄 Content-Type: ${response.headers['content-type']}`);
        console.log(`📏 Content-Length: ${response.data.length} chars`);
        
        const html = response.data;
        
        // Save the HTML for inspection
        const htmlPath = path.join(__dirname, '../reports/rouen-viewer-sample.html');
        fs.writeFileSync(htmlPath, html);
        console.log(`💾 HTML saved to: ${htmlPath}`);
        
        // Look for various patterns that might indicate page count
        console.log('\n🔍 Searching for page count patterns...');
        
        const patterns = [
            { name: 'totalNumberPage', regex: /"totalNumberPage"\s*:\s*(\d+)/ },
            { name: 'totalVues', regex: /"totalVues"\s*:\s*(\d+)/ },
            { name: 'nbTotalVues', regex: /"nbTotalVues"\s*:\s*(\d+)/ },
            { name: 'totalNumberPage (no quotes)', regex: /totalNumberPage["']?\s*:\s*(\d+)/ },
            { name: 'nbVues', regex: /"nbVues"\s*:\s*(\d+)/ },
            { name: 'pageCount', regex: /"pageCount"\s*:\s*(\d+)/ },
            { name: 'totalPages', regex: /"totalPages"\s*:\s*(\d+)/ },
            { name: 'numPages', regex: /"numPages"\s*:\s*(\d+)/ },
            { name: 'pageTotal', regex: /"pageTotal"\s*:\s*(\d+)/ },
            { name: 'dernierePage', regex: /"dernierePage"\s*:\s*(\d+)/ },
            { name: 'lastPage', regex: /"lastPage"\s*:\s*(\d+)/ },
            { name: 'page_count', regex: /"page_count"\s*:\s*(\d+)/ },
            { name: 'total_pages', regex: /"total_pages"\s*:\s*(\d+)/ },
            { name: 'nombre_pages', regex: /"nombre_pages"\s*:\s*(\d+)/ },
            { name: 'OpenSeadragon total', regex: /OpenSeadragon.*?(\d+)/ }
        ];
        
        let foundAny = false;
        
        for (const pattern of patterns) {
            const match = html.match(pattern.regex);
            if (match && match[1]) {
                console.log(`   ✓ ${pattern.name}: ${match[1]}`);
                foundAny = true;
            }
        }
        
        if (!foundAny) {
            console.log('   ❌ No standard patterns found');
        }
        
        // Look for any JavaScript variables that might contain page information
        console.log('\n🔍 Searching for JavaScript variable patterns...');
        
        const jsPatterns = [
            /var\s+(\w*[Pp]age\w*)\s*=\s*(\d+)/g,
            /let\s+(\w*[Pp]age\w*)\s*=\s*(\d+)/g,
            /const\s+(\w*[Pp]age\w*)\s*=\s*(\d+)/g,
            /(\w*[Tt]otal\w*)\s*:\s*(\d+)/g,
            /(\w*[Cc]ount\w*)\s*:\s*(\d+)/g,
            /(\w*[Nn]ombre\w*)\s*:\s*(\d+)/g
        ];
        
        let jsFoundAny = false;
        for (const pattern of jsPatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const varName = match[1];
                const value = parseInt(match[2]);
                if (value > 1 && value < 10000) { // Reasonable page count range
                    console.log(`   ✓ JS Variable: ${varName} = ${value}`);
                    jsFoundAny = true;
                }
            }
        }
        
        if (!jsFoundAny) {
            console.log('   ❌ No JavaScript variable patterns found');
        }
        
        // Look for OpenSeadragon configuration
        console.log('\n🔍 Searching for OpenSeadragon configuration...');
        
        const osPatterns = [
            /OpenSeadragon\.Viewer\({[^}]*?(\w+)\s*:\s*(\d+)[^}]*?}\)/g,
            /openSeadragon[^{]*?{[^}]*?(\w+)\s*:\s*(\d+)[^}]*?}/gi,
            /"viewer"[^{]*?{[^}]*?(\w+)\s*:\s*(\d+)[^}]*?}/g
        ];
        
        let osFoundAny = false;
        for (const pattern of osPatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const prop = match[1];
                const value = parseInt(match[2]);
                if (value > 1 && value < 10000) {
                    console.log(`   ✓ OpenSeadragon: ${prop} = ${value}`);
                    osFoundAny = true;
                }
            }
        }
        
        if (!osFoundAny) {
            console.log('   ❌ No OpenSeadragon patterns found');
        }
        
        // Extract all JSON-like objects and analyze them
        console.log('\n🔍 Extracting JSON objects...');
        
        const jsonPattern = /{[^{}]*(?:{[^{}]*}[^{}]*)*}/g;
        let jsonMatch;
        const jsonObjects = [];
        
        while ((jsonMatch = jsonPattern.exec(html)) !== null) {
            try {
                const jsonStr = jsonMatch[0];
                if (jsonStr.includes('"') && (jsonStr.includes('page') || jsonStr.includes('total') || jsonStr.includes('count'))) {
                    const parsed = JSON.parse(jsonStr);
                    jsonObjects.push(parsed);
                }
            } catch (e) {
                // Skip invalid JSON
            }
        }
        
        console.log(`   Found ${jsonObjects.length} potential JSON objects with page/total/count keywords`);
        
        for (let i = 0; i < Math.min(5, jsonObjects.length); i++) {
            const obj = jsonObjects[i];
            console.log(`   JSON ${i + 1}:`, JSON.stringify(obj, null, 2).substring(0, 200) + '...');
        }
        
        // Look for specific strings that might indicate page numbers
        console.log('\n🔍 Searching for specific page indicators...');
        
        const pageIndicators = [
            'Page 1 sur',
            'page 1 of',
            'de 1 à',
            'from 1 to',
            'total de',
            'total of',
            'sur un total de',
            'out of'
        ];
        
        let indicatorFound = false;
        for (const indicator of pageIndicators) {
            const regex = new RegExp(indicator + '\\s*(\\d+)', 'i');
            const match = html.match(regex);
            if (match) {
                console.log(`   ✓ Found "${indicator}": ${match[1]}`);
                indicatorFound = true;
            }
        }
        
        if (!indicatorFound) {
            console.log('   ❌ No page indicators found');
        }
        
        // Look for URLs that might contain page information
        console.log('\n🔍 Searching for URLs with page information...');
        
        const urlPattern = /https?:\/\/[^\s"']+/g;
        let urlMatch;
        const imageUrls = [];
        
        while ((urlMatch = urlPattern.exec(html)) !== null) {
            const url = urlMatch[0];
            if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.tif')) {
                imageUrls.push(url);
            }
        }
        
        console.log(`   Found ${imageUrls.length} image URLs`);
        
        // Extract page numbers from image URLs
        const pageNumbers = new Set();
        imageUrls.forEach(url => {
            const pageMatch = url.match(/f(\d+)\./);
            if (pageMatch) {
                pageNumbers.add(parseInt(pageMatch[1]));
            }
        });
        
        if (pageNumbers.size > 0) {
            const maxPage = Math.max(...pageNumbers);
            console.log(`   ✓ Highest page number found in URLs: ${maxPage}`);
            console.log(`   ✓ Total unique page numbers: ${pageNumbers.size}`);
        } else {
            console.log('   ❌ No page numbers found in URLs');
        }
        
    } catch (error) {
        console.log(`❌ Request failed: ${error.message}`);
    }
}

analyzeRouenViewer().catch(console.error);