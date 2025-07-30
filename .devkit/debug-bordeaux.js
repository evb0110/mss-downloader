/**
 * Debug Bordeaux Library - fetch and analyze HTML structure
 */

const https = require('https');
const fs = require('fs').promises;

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        https.get({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                console.log(`Following redirect: ${res.statusCode} -> ${res.headers.location}`);
                const redirectUrl = res.headers.location.startsWith('http') ? 
                    res.headers.location : 
                    `${urlObj.protocol}//${urlObj.hostname}${res.headers.location}`;
                fetchUrl(redirectUrl).then(resolve).catch(reject);
                return;
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ 
                status: res.statusCode, 
                headers: res.headers,
                body: data 
            }));
        }).on('error', reject);
    });
}

async function main() {
    const url = 'https://1886.bordeaux.fr/items/viewer?REPRODUCTION_ID=11556';
    console.log(`Fetching: ${url}\n`);
    
    try {
        const response = await fetchUrl(url);
        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        console.log(`Content-Length: ${response.body.length} bytes\n`);
        
        // Save HTML for analysis
        await fs.writeFile('.devkit/bordeaux-page.html', response.body);
        console.log('Saved HTML to .devkit/bordeaux-page.html\n');
        
        // Extract title
        const titleMatch = response.body.match(/<title[^>]*>([^<]+)</);
        if (titleMatch) {
            console.log(`Page Title: ${titleMatch[1]}\n`);
        }
        
        // Look for Bordeaux-specific patterns
        console.log('Searching for Bordeaux patterns:\n');
        
        // Look for selene.bordeaux.fr references
        const seleneMatches = response.body.match(/selene\.bordeaux\.fr[^"'\s]*/g);
        if (seleneMatches) {
            console.log(`Found ${seleneMatches.length} selene.bordeaux.fr references:`);
            [...new Set(seleneMatches)].forEach(match => console.log(`  - ${match}`));
        }
        
        // Look for iframe
        const iframeMatch = response.body.match(/<iframe[^>]+src=['"]([^'"]*selene\.bordeaux\.fr[^'"]*)/i);
        if (iframeMatch) {
            console.log(`\nFound iframe URL: ${iframeMatch[1]}`);
            
            // Fetch iframe content
            console.log('\nFetching iframe content...');
            const iframeUrl = iframeMatch[1].startsWith('http') ? iframeMatch[1] : `https://selene.bordeaux.fr${iframeMatch[1]}`;
            const iframeResponse = await fetchUrl(iframeUrl);
            
            if (iframeResponse.status === 200) {
                await fs.writeFile('.devkit/bordeaux-iframe.html', iframeResponse.body);
                console.log('Saved iframe HTML to .devkit/bordeaux-iframe.html');
                
                // Look for DZI references
                const dziMatches = iframeResponse.body.match(/\/in\/dz\/[^"'\s]+\.dzi/g);
                if (dziMatches) {
                    console.log(`\nFound ${dziMatches.length} DZI references in iframe:`);
                    [...new Set(dziMatches)].forEach(match => console.log(`  - ${match}`));
                }
                
                // Look for OpenSeadragon config
                const tileSourceMatch = iframeResponse.body.match(/tileSources['":\s]+([^,}]+)/);
                if (tileSourceMatch) {
                    console.log(`\nFound tile source config: ${tileSourceMatch[1]}`);
                }
            }
        }
        
        // Look for manuscript ID patterns
        const patterns = [
            /manuscrits\.bordeaux\.fr[^"'\s]*/g,
            /REPRODUCTION_ID=(\d+)/,
            /ark:\/\d+\/([^/\s"']+)/,
            /MS\s*(\d+)/i
        ];
        
        patterns.forEach((pattern, idx) => {
            const matches = response.body.match(pattern);
            if (matches) {
                console.log(`\nPattern ${idx + 1} matches:`);
                if (Array.isArray(matches)) {
                    [...new Set(matches)].forEach(match => console.log(`  - ${match}`));
                } else {
                    console.log(`  - ${matches}`);
                }
            }
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

main();