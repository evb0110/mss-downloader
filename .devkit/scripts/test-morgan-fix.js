const https = require('https');

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve({ ok: response.statusCode === 200, text: () => data }));
        }).on('error', reject);
    });
}

async function testMorganFix() {
    const testUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
    console.log('Testing Morgan Library fix...');
    console.log('URL:', testUrl);
    
    try {
        // Fetch the main page
        const response = await fetchUrl(testUrl);
        if (!response.ok) {
            console.error('Failed to fetch page');
            return;
        }
        
        const html = await response.text();
        console.log('\nSearching for page links...');
        
        // Look for individual page URLs
        const pageUrlRegex = /\/collection\/lindau-gospels\/(\d+)/g;
        const matches = [...html.matchAll(pageUrlRegex)];
        const uniquePages = [...new Set(matches.map(m => m[1]))];
        
        console.log(`Found ${uniquePages.length} unique page numbers:`, uniquePages.slice(0, 10));
        
        // Also check for image patterns
        const imageRegex = /\/images\/collection\/[^"']+\.jpg/g;
        const imageMatches = html.match(imageRegex) || [];
        console.log(`\nFound ${imageMatches.length} image references`);
        
        // Check data attributes
        const dataPageRegex = /data-page="(\d+)"/g;
        const dataMatches = [...html.matchAll(dataPageRegex)];
        console.log(`Found ${dataMatches.length} data-page attributes`);
        
        // Check for links with page numbers
        const linkRegex = /href="[^"]*\/collection\/lindau-gospels\/(\d+)[^"]*"/g;
        const linkMatches = [...html.matchAll(linkRegex)];
        console.log(`Found ${linkMatches.length} page links`);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testMorganFix();