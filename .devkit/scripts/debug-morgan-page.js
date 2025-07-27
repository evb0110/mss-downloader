const https = require('https');
const fs = require('fs').promises;

const testUrl = 'https://www.themorgan.org/collection/gospel-book/159106';

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve({ 
                ok: response.statusCode === 200, 
                text: () => data, 
                status: response.statusCode,
                headers: response.headers 
            }));
        }).on('error', reject);
    });
}

async function debugMorganPage() {
    console.log('Debugging Morgan page:', testUrl);
    
    const response = await fetchUrl(testUrl);
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    
    if (response.ok) {
        const content = await response.text();
        console.log('Page size:', content.length, 'bytes');
        
        // Save for inspection
        await fs.writeFile('.devkit/temp/morgan-page.html', content);
        console.log('Saved page to .devkit/temp/morgan-page.html');
        
        // Look for navigation elements
        console.log('\nSearching for navigation elements:');
        
        // Check for prev/next links
        const prevMatch = content.match(/<a[^>]+class="[^"]*prev[^"]*"[^>]*href="([^"]+)"/);
        const nextMatch = content.match(/<a[^>]+class="[^"]*next[^"]*"[^>]*href="([^"]+)"/);
        
        if (prevMatch) console.log('Previous link found:', prevMatch[1]);
        if (nextMatch) console.log('Next link found:', nextMatch[1]);
        
        // Look for page numbers in navigation
        const pageNavPatterns = [
            /Page\s+(\d+)\s+of\s+(\d+)/i,
            /(\d+)\s*\/\s*(\d+)/,
            />(\d+)<\/[^>]+>\s*pages/i,
            /data-total-pages="(\d+)"/,
            /totalPages['":\s]+(\d+)/
        ];
        
        for (const pattern of pageNavPatterns) {
            const match = content.match(pattern);
            if (match) {
                console.log(`Found navigation pattern: "${match[0]}"`);
                if (match[2]) {
                    console.log(`  Current page: ${match[1]}, Total pages: ${match[2]}`);
                } else {
                    console.log(`  Total pages: ${match[1]}`);
                }
            }
        }
        
        // Look for manuscript collection links
        console.log('\nSearching for other manuscript pages:');
        const collectionLinks = content.match(/href="\/collection\/gospel-book\/\d+"/g);
        if (collectionLinks) {
            console.log(`Found ${collectionLinks.length} collection links`);
            const uniqueLinks = [...new Set(collectionLinks)];
            console.log('Unique links:', uniqueLinks.slice(0, 10).join(', '), uniqueLinks.length > 10 ? '...' : '');
        }
        
        // Look for image URLs
        console.log('\nSearching for images:');
        const imagePatterns = [
            { name: 'Facsimile', pattern: /\/sites\/default\/files\/facsimile\/[^"']+\.jpg/g },
            { name: 'Collection', pattern: /\/images\/collection\/[^"']+\.jpg/g },
            { name: 'Styled', pattern: /\/sites\/default\/files\/styles\/[^"']+\.jpg/g },
            { name: 'ZIF', pattern: /\.zif/g }
        ];
        
        for (const { name, pattern } of imagePatterns) {
            const matches = content.match(pattern);
            if (matches) {
                console.log(`${name} images: ${matches.length}`);
                if (matches.length > 0) {
                    console.log(`  Sample: ${matches[0]}`);
                }
            }
        }
        
        // Look for manuscript title
        const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/);
        if (titleMatch) {
            console.log('\nPage title:', titleMatch[1]);
        }
        
        // Check if there's a main manuscript page
        const manuscriptLinkMatch = content.match(/<a[^>]+href="(\/collection\/gospel-book)"[^>]*>/);
        if (manuscriptLinkMatch) {
            console.log('\nMain manuscript link found:', manuscriptLinkMatch[1]);
        }
    }
}

// Create temp directory
const fsSync = require('fs');
if (!fsSync.existsSync('.devkit/temp')) {
    fsSync.mkdirSync('.devkit/temp', { recursive: true });
}

debugMorganPage().catch(console.error);