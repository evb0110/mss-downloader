const https = require('https');

async function fetchPageContent(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function testMorganLibrary() {
    console.log('Testing Morgan Library page extraction...\n');
    
    const testUrl = 'https://www.themorgan.org/collection/lindau-gospels';
    console.log(`Test URL: ${testUrl}\n`);
    
    try {
        // Fetch the main page
        const pageContent = await fetchPageContent(testUrl);
        console.log(`Page content length: ${pageContent.length} characters\n`);
        
        // Extract manuscript ID
        const manuscriptMatch = testUrl.match(/\/collection\/([^/]+)/);
        const manuscriptId = manuscriptMatch ? manuscriptMatch[1] : null;
        console.log(`Manuscript ID: ${manuscriptId}\n`);
        
        // Look for individual page URLs
        const pageUrlRegex = new RegExp(`\\/collection\\/${manuscriptId}\\/(\\d+)`, 'g');
        const pageMatches = [...pageContent.matchAll(pageUrlRegex)];
        const uniquePages = [...new Set(pageMatches.map(match => match[1]))];
        
        console.log(`Found ${uniquePages.length} unique page numbers\n`);
        console.log('Page numbers:', uniquePages.sort((a, b) => parseInt(a) - parseInt(b)).join(', '));
        console.log('\n');
        
        // Also try alternative patterns
        const patterns = [
            { name: 'href pattern', regex: new RegExp(`href="[^"]*\\/collection\\/${manuscriptId}\\/(\\d+)[^"]*"`, 'g') },
            { name: 'data-page pattern', regex: /data-page="(\d+)"/g },
            { name: 'page- pattern', regex: /page-(\d+)/g },
            { name: 'image collection pattern', regex: /\/images\/collection\/([^"'?]+)\.jpg/g },
            { name: 'facsimile pattern', regex: /\/sites\/default\/files\/facsimile\/[^"']+\/([^"']+\.jpg)/g }
        ];
        
        for (const pattern of patterns) {
            const matches = [...pageContent.matchAll(pattern.regex)];
            console.log(`${pattern.name}: found ${matches.length} matches`);
            if (matches.length > 0 && matches.length < 20) {
                console.log('  Sample matches:', matches.slice(0, 5).map(m => m[1]).join(', '));
            }
        }
        
        console.log('\n');
        
        // Check for ZIF images
        const zifImageRegex = /\/images\/collection\/([^"'?]+)\.jpg/g;
        const validImagePattern = /\d+v?_\d+/;
        const zifMatches = [...pageContent.matchAll(zifImageRegex)];
        const validZifImages = zifMatches.filter(match => validImagePattern.test(match[1]) && !match[1].includes('front-cover'));
        
        console.log(`Found ${validZifImages.length} valid ZIF image candidates`);
        if (validZifImages.length > 0) {
            console.log('Sample ZIF URLs:');
            validZifImages.slice(0, 5).forEach(match => {
                const zifUrl = `https://host.themorgan.org/facsimile/images/${manuscriptId}/${match[1]}.zif`;
                console.log(`  ${zifUrl}`);
            });
        }
        
        // Test fetching an individual page
        if (uniquePages.length > 0) {
            console.log('\nTesting individual page fetch...');
            const testPageNum = uniquePages[0];
            const pageUrl = `https://www.themorgan.org/collection/${manuscriptId}/${testPageNum}`;
            console.log(`Fetching: ${pageUrl}`);
            
            const individualPageContent = await fetchPageContent(pageUrl);
            console.log(`Individual page content length: ${individualPageContent.length} characters`);
            
            // Look for facsimile images on individual page
            const facsimileMatch = individualPageContent.match(/\/sites\/default\/files\/facsimile\/[^"']+\/([^"']+\.jpg)/);
            if (facsimileMatch) {
                console.log(`Found facsimile image: ${facsimileMatch[1]}`);
                console.log(`Full URL: https://www.themorgan.org${facsimileMatch[0]}`);
            } else {
                console.log('No facsimile image found on individual page');
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testMorganLibrary();