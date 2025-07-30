/**
 * Debug Morgan Library - fetch and analyze HTML
 */

const https = require('https');
const fs = require('fs').promises;

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                console.log(`Following redirect: ${res.statusCode} -> ${res.headers.location}`);
                fetchUrl(res.headers.location).then(resolve).catch(reject);
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
    const url = 'https://www.themorgan.org/manuscript/76854';
    console.log(`Fetching: ${url}\n`);
    
    try {
        const response = await fetchUrl(url);
        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        console.log(`Content-Length: ${response.body.length} bytes\n`);
        
        // Save HTML for analysis
        await fs.writeFile('.devkit/morgan-page.html', response.body);
        console.log('Saved HTML to .devkit/morgan-page.html\n');
        
        // Extract title
        const titleMatch = response.body.match(/<title[^>]*>([^<]+)</);
        if (titleMatch) {
            console.log(`Page Title: ${titleMatch[1]}\n`);
        }
        
        // Look for image patterns
        console.log('Searching for image patterns:\n');
        
        const patterns = [
            /\/sites\/default\/files\/images\/collection\/[^"'?]+\.jpg/g,
            /\/sites\/default\/files\/facsimile\/[^"']+\.jpg/g,
            /\/images\/collection\/([^"'?]+)\.jpg/g,
            /data-zoom-image="([^"]+)"/g,
            /src=["']([^"']*\.(jpg|jpeg|png))/gi,
            /<img[^>]+src=["']([^"']+)/gi,
            /MS\s+M\.?\s*(\d+)/i
        ];
        
        patterns.forEach((pattern, idx) => {
            const matches = response.body.match(pattern);
            console.log(`Pattern ${idx + 1}: ${matches ? matches.length : 0} matches`);
            if (matches && matches.length > 0) {
                console.log(`  First match: ${matches[0]}`);
            }
        });
        
        // Look for specific Morgan patterns
        console.log('\nSearching for Morgan-specific patterns:');
        
        // Check for redirects or alternate URLs
        const collectionMatch = response.body.match(/\/collection\/([^/"']+)/);
        if (collectionMatch) {
            console.log(`Found collection reference: ${collectionMatch[0]}`);
        }
        
        // Check for thumbs URL
        const thumbsMatch = response.body.match(/href=["']([^"']*\/thumbs[^"']*)/);
        if (thumbsMatch) {
            console.log(`Found thumbs URL: ${thumbsMatch[1]}`);
        }
        
        // Check for viewer/iframe
        const viewerMatch = response.body.match(/<iframe[^>]+src=["']([^"']+)/);
        if (viewerMatch) {
            console.log(`Found viewer iframe: ${viewerMatch[1]}`);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

main();