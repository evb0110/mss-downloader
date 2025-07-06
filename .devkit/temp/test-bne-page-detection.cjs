const https = require('https');
const http = require('http');

// Test BNE page detection current implementation
async function testBnePageDetection() {
    console.log('Testing BNE page detection for URL: https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1');
    
    // Extract manuscript ID
    const originalUrl = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    const idMatch = originalUrl.match(/[?&]id=(\d+)/);
    if (!idMatch) {
        console.error('Could not extract manuscript ID from BNE URL');
        return;
    }
    
    const manuscriptId = idMatch[1];
    console.log(`Manuscript ID: ${manuscriptId}`);
    
    // Test the current implementation approach
    const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1&jpeg=true`;
    console.log(`Testing URL: ${testUrl}`);
    
    try {
        const response = await fetch(testUrl, { method: 'HEAD' });
        console.log('HEAD Response Status:', response.status);
        console.log('HEAD Response Headers:', Object.fromEntries(response.headers.entries()));
        
        if (response.ok && response.headers.get('content-type')?.includes('image')) {
            console.log('✓ Page 1 found with HEAD request');
        } else {
            console.log('✗ Page 1 not found with HEAD request');
        }
        
        // Try GET request
        const getResponse = await fetch(testUrl);
        console.log('GET Response Status:', getResponse.status);
        console.log('GET Response Headers:', Object.fromEntries(getResponse.headers.entries()));
        
        if (getResponse.ok) {
            const contentType = getResponse.headers.get('content-type');
            console.log('Content-Type:', contentType);
            
            if (contentType?.includes('image')) {
                console.log('✓ Page 1 found with GET request - valid image');
            } else {
                console.log('✗ Page 1 not found with GET request - not an image');
                
                // If not an image, let's see the actual response
                if (contentType?.includes('text/html')) {
                    const text = await getResponse.text();
                    console.log('HTML Response (first 500 chars):', text.substring(0, 500));
                }
            }
        }
        
    } catch (error) {
        console.error('Error testing BNE page detection:', error.message);
    }
    
    // Test alternative endpoint patterns
    const alternativeUrls = [
        `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/imagen.do?id=${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/image.do?id=${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/viewer/image?id=${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/images/${manuscriptId}/page1.jpg`,
        `https://bdh-rd.bne.es/images/${manuscriptId}_001.jpg`
    ];
    
    console.log('\nTesting alternative endpoint patterns:');
    for (const url of alternativeUrls) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            console.log(`${url}: Status ${response.status}, Content-Type: ${response.headers.get('content-type')}`);
        } catch (error) {
            console.log(`${url}: Error - ${error.message}`);
        }
    }
}

testBnePageDetection().catch(console.error);