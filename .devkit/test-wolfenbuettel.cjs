const https = require('https');
const fs = require('fs');
const path = require('path');

// Test Wolfenbüttel manuscript library structure
const baseUrl = 'http://diglib.hab.de/mss/1008-helmst';
const imageBaseUrl = 'http://diglib.hab.de/mss/1008-helmst';

async function testWolfenbuettelLibrary() {
    console.log('Testing Wolfenbüttel Digital Library...');
    console.log('Base URL:', baseUrl);
    
    // Test different resolution parameters
    const resolutionPatterns = [
        '/max/00001.jpg',  // Maximum resolution
        '/large/00001.jpg', // Large resolution
        '/medium/00001.jpg', // Medium resolution
        '/small/00001.jpg',  // Small resolution
        '/full/00001.jpg'    // Full resolution
    ];
    
    console.log('\nTesting resolution patterns:');
    
    for (const pattern of resolutionPatterns) {
        const testUrl = imageBaseUrl + pattern;
        try {
            const response = await fetchWithTimeout(testUrl, 10000);
            const contentLength = response.headers['content-length'];
            const contentType = response.headers['content-type'];
            
            console.log(`✓ ${pattern}: ${response.status} - ${contentType} - ${contentLength} bytes`);
            
            // Save first successful image for inspection
            if (response.status === 200 && pattern === '/max/00001.jpg') {
                const buffer = Buffer.from(await response.arrayBuffer());
                const filename = path.join(__dirname, 'temp', 'wolfenbuettel-test.jpg');
                await fs.promises.mkdir(path.dirname(filename), { recursive: true });
                await fs.promises.writeFile(filename, buffer);
                console.log(`  → Saved test image: ${filename}`);
            }
        } catch (error) {
            console.log(`✗ ${pattern}: ${error.message}`);
        }
    }
    
    // Test pagination - try multiple page numbers
    console.log('\nTesting pagination:');
    const pageNumbers = ['00001', '00002', '00003', '00004', '00005', '00010', '00015', '00020'];
    
    for (const pageNum of pageNumbers) {
        const testUrl = `${imageBaseUrl}/max/${pageNum}.jpg`;
        try {
            const response = await fetchWithTimeout(testUrl, 5000);
            const contentLength = response.headers['content-length'];
            
            if (response.status === 200) {
                console.log(`✓ Page ${pageNum}: ${response.status} - ${contentLength} bytes`);
            } else {
                console.log(`✗ Page ${pageNum}: ${response.status}`);
            }
        } catch (error) {
            console.log(`✗ Page ${pageNum}: ${error.message}`);
        }
    }
    
    // Test alternative URL patterns
    console.log('\nTesting alternative patterns:');
    const alternativePatterns = [
        '/images/max/00001.jpg',
        '/viewer/max/00001.jpg', 
        '/digital/max/00001.jpg',
        '/scans/max/00001.jpg'
    ];
    
    for (const pattern of alternativePatterns) {
        const testUrl = imageBaseUrl + pattern;
        try {
            const response = await fetchWithTimeout(testUrl, 5000);
            if (response.status === 200) {
                console.log(`✓ Alternative pattern ${pattern}: ${response.status}`);
            }
        } catch (error) {
            // Silent fail for alternatives
        }
    }
    
    console.log('\nWolfenbüttel library analysis complete.');
}

async function fetchWithTimeout(url, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Run the test
testWolfenbuettelLibrary().catch(console.error);