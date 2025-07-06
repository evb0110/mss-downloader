const https = require('https');
const http = require('http');

const manuscriptId = '0000007619';
const testUrl = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';

console.log('Testing BNE manuscript:', manuscriptId);
console.log('Original URL:', testUrl);

async function testBnePages() {
    console.log('\n=== Testing current BNE implementation ===');
    
    // Test the current approach
    const pageLinks = [];
    let consecutiveFailures = 0;
    
    for (let page = 1; page <= 10; page++) {
        const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&jpeg=true`;
        
        try {
            const response = await fetch(testUrl, { method: 'HEAD' });
            
            console.log(`Page ${page}: Status ${response.status}, Content-Type: ${response.headers.get('content-type')}`);
            
            if (response.ok && response.headers.get('content-type')?.includes('image')) {
                pageLinks.push(testUrl);
                consecutiveFailures = 0;
                console.log(`✓ Found BNE page ${page}`);
            } else {
                consecutiveFailures++;
                console.log(`✗ Page ${page} failed`);
                if (consecutiveFailures >= 5) {
                    console.log(`Stopping after ${consecutiveFailures} consecutive failures`);
                    break;
                }
            }
        } catch (error) {
            consecutiveFailures++;
            console.log(`✗ Page ${page} error:`, error.message);
            if (consecutiveFailures >= 5) {
                console.log(`Stopping after ${consecutiveFailures} consecutive failures`);
                break;
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\nResult: ${pageLinks.length} pages found`);
    
    // Now let's test alternative URL patterns
    console.log('\n=== Testing alternative URL patterns ===');
    
    // Test the original viewer URL structure
    const viewerUrl = `https://bdh-rd.bne.es/viewer.vm?id=${manuscriptId}&page=1`;
    console.log('Testing viewer URL:', viewerUrl);
    
    try {
        const response = await fetch(viewerUrl);
        console.log('Viewer response status:', response.status);
        const html = await response.text();
        console.log('HTML snippet:', html.substring(0, 500));
        
        // Look for image URLs in the HTML
        const imageMatches = html.match(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|gif)/gi);
        if (imageMatches) {
            console.log('Found image URLs in HTML:', imageMatches.slice(0, 5));
        }
        
        // Look for manifest or IIIF URLs
        const manifestMatches = html.match(/https?:\/\/[^"'\s]+manifest[^"'\s]*/gi);
        if (manifestMatches) {
            console.log('Found manifest URLs:', manifestMatches);
        }
        
    } catch (error) {
        console.log('Error fetching viewer:', error.message);
    }
    
    // Test different API endpoints
    console.log('\n=== Testing different API endpoints ===');
    
    const alternativeUrls = [
        `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/api/item/${manuscriptId}`,
        `https://bdh-rd.bne.es/api/item/${manuscriptId}/manifest`,
        `https://bdh-rd.bne.es/items/${manuscriptId}`,
        `https://bdh-rd.bne.es/items/${manuscriptId}/manifest`,
        `https://bdh-rd.bne.es/iiif/${manuscriptId}/manifest`,
        `https://bdh-rd.bne.es/iiif/${manuscriptId}/manifest.json`,
    ];
    
    for (const url of alternativeUrls) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            console.log(`${url}: Status ${response.status}, Content-Type: ${response.headers.get('content-type')}`);
        } catch (error) {
            console.log(`${url}: Error - ${error.message}`);
        }
    }
}

testBnePages().catch(console.error);