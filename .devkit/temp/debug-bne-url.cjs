const { default: fetch } = require('node-fetch');
const https = require('https');

// Create agent that bypasses SSL verification
const agent = new https.Agent({
    rejectUnauthorized: false
});

async function testBneUrl() {
    const manuscriptId = '0000007619';
    console.log(`Testing BNE manuscript ID: ${manuscriptId}`);
    
    // Test the original viewer URL
    const originalUrl = `https://bdh-rd.bne.es/viewer.vm?id=${manuscriptId}&page=1`;
    console.log(`\nTesting original URL: ${originalUrl}`);
    
    try {
        const response = await fetch(originalUrl, { agent });
        console.log(`Original URL status: ${response.status}`);
        console.log(`Original URL content-type: ${response.headers.get('content-type')}`);
        
        if (response.ok) {
            const html = await response.text();
            console.log(`HTML content length: ${html.length}`);
            
            // Look for page information in the HTML
            const totalPagesMatch = html.match(/totalPages[^\d]*(\d+)/i);
            const pageCountMatch = html.match(/pageCount[^\d]*(\d+)/i);
            const pagesMatch = html.match(/pages[^\d]*(\d+)/i);
            
            if (totalPagesMatch) console.log(`Found totalPages: ${totalPagesMatch[1]}`);
            if (pageCountMatch) console.log(`Found pageCount: ${pageCountMatch[1]}`);
            if (pagesMatch) console.log(`Found pages: ${pagesMatch[1]}`);
            
            // Look for IIIF manifest or similar
            if (html.includes('iiif')) {
                console.log('Found IIIF references in HTML');
            }
            
            // Look for image URLs
            const imageUrlMatches = html.match(/https?:\/\/[^"']*\.(jpg|jpeg|png|tiff?)/gi);
            if (imageUrlMatches) {
                console.log(`Found ${imageUrlMatches.length} image URLs`);
                imageUrlMatches.slice(0, 3).forEach(url => console.log(`  - ${url}`));
            }
        }
        
    } catch (error) {
        console.error(`Error testing original URL: ${error.message}`);
    }
    
    // Test the current implementation approach
    console.log(`\n--- Testing Current Implementation Approach ---`);
    
    for (let page = 1; page <= 10; page++) {
        const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&jpeg=true`;
        console.log(`\nTesting page ${page}: ${testUrl}`);
        
        try {
            const response = await fetch(testUrl, { 
                method: 'HEAD', 
                agent,
                timeout: 10000
            });
            
            console.log(`  Status: ${response.status}`);
            console.log(`  Content-Type: ${response.headers.get('content-type')}`);
            console.log(`  Content-Length: ${response.headers.get('content-length')}`);
            
            if (response.ok && response.headers.get('content-type')?.includes('image')) {
                console.log(`  ✓ Page ${page} found - valid image`);
            } else {
                console.log(`  ✗ Page ${page} not found or invalid`);
            }
            
        } catch (error) {
            console.log(`  ✗ Page ${page} error: ${error.message}`);
        }
    }
    
    // Test alternative URL patterns
    console.log(`\n--- Testing Alternative URL Patterns ---`);
    
    const alternativePatterns = [
        `https://bdh-rd.bne.es/viewer.vm?id=${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/images/${manuscriptId}/page/1.jpg`,
        `https://bdh-rd.bne.es/images/${manuscriptId}/001.jpg`,
        `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1&jpeg=false`,
        `https://bdh-rd.bne.es/api/page/${manuscriptId}/1`,
        `https://bdh-rd.bne.es/iiif/${manuscriptId}/manifest.json`,
    ];
    
    for (const pattern of alternativePatterns) {
        console.log(`\nTesting pattern: ${pattern}`);
        
        try {
            const response = await fetch(pattern, { 
                method: 'HEAD',
                agent,
                timeout: 10000
            });
            
            console.log(`  Status: ${response.status}`);
            console.log(`  Content-Type: ${response.headers.get('content-type')}`);
            
            if (response.ok) {
                console.log(`  ✓ Pattern works`);
            }
            
        } catch (error) {
            console.log(`  ✗ Pattern error: ${error.message}`);
        }
    }
}

testBneUrl().catch(console.error);