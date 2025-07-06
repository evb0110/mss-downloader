#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

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
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: () => Promise.resolve(data),
                    json: () => Promise.resolve(JSON.parse(data))
                });
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function analyzeBvpbPagination() {
    try {
        const testUrl = 'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000651';
        console.log('Testing BVPB pagination for:', testUrl);
        
        const response = await fetchWithFallback(testUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        console.log('HTML Length:', html.length);
        
        // Save HTML for detailed analysis
        fs.writeFileSync('./bvpb-page-analysis.html', html);
        console.log('HTML saved to bvpb-page-analysis.html');
        
        // Current implementation pattern
        const imageIdPattern = /object-miniature\.do\?id=(\d+)/g;
        const imageIds = [];
        let match;
        while ((match = imageIdPattern.exec(html)) !== null) {
            const imageId = match[1];
            if (!imageIds.includes(imageId)) {
                imageIds.push(imageId);
            }
        }
        
        console.log(`\nCurrent implementation found ${imageIds.length} images:`);
        imageIds.forEach((id, index) => {
            console.log(`  ${index + 1}. ID: ${id}`);
        });
        
        // Look for pagination controls
        console.log('\n=== PAGINATION ANALYSIS ===');
        
        // Look for pagination patterns
        const paginationPatterns = [
            /href="[^"]*siguiente[^"]*"/gi,
            /href="[^"]*next[^"]*"/gi,
            /href="[^"]*pagina[^"]*"/gi,
            /href="[^"]*page[^"]*"/gi,
            /href="[^"]*offset[^"]*"/gi,
            /href="[^"]*limit[^"]*"/gi,
            /href="[^"]*start[^"]*"/gi,
            /class="[^"]*pag[^"]*"/gi,
            /class="[^"]*next[^"]*"/gi
        ];
        
        paginationPatterns.forEach((pattern, index) => {
            const matches = html.match(pattern);
            if (matches) {
                console.log(`Pattern ${index + 1} matches:`, matches);
            }
        });
        
        // Look for JavaScript pagination
        console.log('\n=== JAVASCRIPT PAGINATION ANALYSIS ===');
        const jsPatterns = [
            /function[^{]*pag[^{]*\{[^}]*\}/gi,
            /onclick="[^"]*pag[^"]*"/gi,
            /onclick="[^"]*next[^"]*"/gi,
            /onclick="[^"]*siguiente[^"]*"/gi,
            /\.load\([^)]*\)/gi,
            /\.submit\([^)]*\)/gi
        ];
        
        jsPatterns.forEach((pattern, index) => {
            const matches = html.match(pattern);
            if (matches) {
                console.log(`JS Pattern ${index + 1} matches:`, matches);
            }
        });
        
        // Look for form submissions
        console.log('\n=== FORM ANALYSIS ===');
        const formPattern = /<form[^>]*>(.*?)<\/form>/gis;
        const formMatches = html.match(formPattern);
        if (formMatches) {
            console.log(`Found ${formMatches.length} forms`);
            formMatches.forEach((form, index) => {
                console.log(`Form ${index + 1}:`, form.substring(0, 200) + '...');
            });
        }
        
        // Look for total page indicators
        console.log('\n=== TOTAL PAGES ANALYSIS ===');
        const totalPatterns = [
            /\d+\s*de\s*\d+/gi,
            /total[^:]*:\s*\d+/gi,
            /\d+\s*results?/gi,
            /\d+\s*elementos?/gi,
            /\d+\s*objetos?/gi,
            /página\s*\d+\s*de\s*\d+/gi
        ];
        
        totalPatterns.forEach((pattern, index) => {
            const matches = html.match(pattern);
            if (matches) {
                console.log(`Total Pattern ${index + 1} matches:`, matches);
            }
        });
        
        // Look for hidden fields or parameters
        console.log('\n=== HIDDEN PARAMETERS ANALYSIS ===');
        const hiddenPattern = /<input[^>]*type="hidden"[^>]*>/gi;
        const hiddenMatches = html.match(hiddenPattern);
        if (hiddenMatches) {
            console.log(`Found ${hiddenMatches.length} hidden inputs:`);
            hiddenMatches.forEach((input, index) => {
                console.log(`  ${index + 1}. ${input}`);
            });
        }
        
        // Look for AJAX/XMLHttpRequest calls
        console.log('\n=== AJAX ANALYSIS ===');
        const ajaxPatterns = [
            /XMLHttpRequest/gi,
            /\.ajax\(/gi,
            /fetch\(/gi,
            /\.post\(/gi,
            /\.get\(/gi
        ];
        
        ajaxPatterns.forEach((pattern, index) => {
            const matches = html.match(pattern);
            if (matches) {
                console.log(`AJAX Pattern ${index + 1} matches:`, matches);
            }
        });
        
        console.log('\n=== ANALYSIS COMPLETE ===');
        console.log('Current implementation limitation: Only finds first page images');
        console.log('Need to implement pagination traversal to get all pages');
        
    } catch (error) {
        console.error('Error analyzing BVPB pagination:', error.message);
    }
}

analyzeBvpbPagination();