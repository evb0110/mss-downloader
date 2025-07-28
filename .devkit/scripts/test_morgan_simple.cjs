// Simple test for Morgan Library
const fetch = require('node-fetch');

async function testMorganSimple() {
    const url = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
    
    try {
        console.log('Testing Morgan URL:', url);
        
        // Fetch the page
        const response = await fetch(url);
        const html = await response.text();
        
        console.log('Page fetched, length:', html.length);
        
        // Check if we can extract manuscript ID
        const collectionMatch = url.match(/\/collection\/([^/]+)/);
        if (collectionMatch) {
            console.log('Manuscript ID:', collectionMatch[1]);
        }
        
        // Check for images
        const imageCount = (html.match(/\/images\/collection\//g) || []).length;
        console.log('Found image references:', imageCount);
        
        // Check for page links
        const pageLinks = html.match(/\/collection\/lindau-gospels\/\d+/g) || [];
        console.log('Found page links:', pageLinks.length);
        
        if (pageLinks.length > 0) {
            console.log('First few page links:', pageLinks.slice(0, 5));
        }
        
        console.log('\nTest completed successfully!');
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testMorganSimple();