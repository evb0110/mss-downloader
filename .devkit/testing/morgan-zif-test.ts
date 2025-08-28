#!/usr/bin/env bun

// Test Morgan ZIF file accessibility
async function testZifAccess() {
    const testZifUrls = [
        'https://host.themorgan.org/facsimile/143812/143812v_0001.zif',
        'https://host.themorgan.org/facsimile/143812/143812v_0002.zif'
    ];
    
    const testJpegUrls = [
        'https://www.themorgan.org/sites/default/files/facsimile/143812/143812v_0001.jpg',
        'https://www.themorgan.org/sites/default/files/facsimile/143812/143812v_0002.jpg'
    ];
    
    console.log('=== Testing ZIF File Access ===');
    for (const url of testZifUrls) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            console.log(`${url}: ${response.status} ${response.statusText}`);
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                const contentLength = response.headers.get('content-length');
                console.log(`  Content-Type: ${contentType}`);
                console.log(`  Content-Length: ${contentLength} bytes`);
            }
        } catch (error) {
            console.log(`${url}: ERROR - ${error}`);
        }
    }
    
    console.log('\n=== Testing High-Res JPEG Access ===');
    for (const url of testJpegUrls) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            console.log(`${url}: ${response.status} ${response.statusText}`);
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                const contentLength = response.headers.get('content-length');
                console.log(`  Content-Type: ${contentType}`);
                console.log(`  Content-Length: ${contentLength} bytes`);
            }
        } catch (error) {
            console.log(`${url}: ERROR - ${error}`);
        }
    }
    
    console.log('\n=== Testing Styled Thumbnail URLs ===');
    const styledUrls = [
        'https://www.themorgan.org/sites/default/files/styles/largest_800_x_800_/public/facsimile/143812/143812v_0001.jpg',
        'https://www.themorgan.org/sites/default/files/styles/largest_800_x_800_/public/facsimile/143812/143812v_0002.jpg'
    ];
    
    for (const url of styledUrls) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            console.log(`${url}: ${response.status} ${response.statusText}`);
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                const contentLength = response.headers.get('content-length');
                console.log(`  Content-Type: ${contentType}`);
                console.log(`  Content-Length: ${contentLength} bytes (THUMBNAIL)`);
            }
        } catch (error) {
            console.log(`${url}: ERROR - ${error}`);
        }
    }
}

testZifAccess();