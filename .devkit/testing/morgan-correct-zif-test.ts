#!/usr/bin/env bun

// Test the correct Morgan ZIF URL pattern
async function testCorrectZifPattern() {
    // Pattern from user's curl: https://host.themorgan.org/facsimile/images/m651/143812v_0009.zif
    const correctZifUrls = [
        'https://host.themorgan.org/facsimile/images/m651/143812v_0001.zif',
        'https://host.themorgan.org/facsimile/images/m651/143812v_0002.zif',
        'https://host.themorgan.org/facsimile/images/m651/143812v_0009.zif'
    ];
    
    console.log('=== Testing Correct ZIF Pattern ===');
    for (const url of correctZifUrls) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            console.log(`${url}: ${response.status} ${response.statusText}`);
            if (response.ok) {
                const contentLength = response.headers.get('content-length');
                const sizeMB = contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) : 'unknown';
                console.log(`  Size: ${sizeMB}MB (ZIF HIGH-RESOLUTION)`);
            }
        } catch (error) {
            console.log(`${url}: ERROR - ${error}`);
        }
    }
    
    // Test byte range request (like in the curl)
    console.log('\n=== Testing ZIF Byte Range Request ===');
    try {
        const url = 'https://host.themorgan.org/facsimile/images/m651/143812v_0009.zif';
        const response = await fetch(url, {
            headers: {
                'Range': 'bytes=0-1023' // First 1KB
            }
        });
        console.log(`Range request: ${response.status} ${response.statusText}`);
        if (response.status === 206) { // Partial Content
            const contentRange = response.headers.get('content-range');
            console.log(`  Content-Range: ${contentRange}`);
            console.log(`  ZIF file supports range requests (tiled format)`);
        }
    } catch (error) {
        console.log(`Range request ERROR: ${error}`);
    }
}

testCorrectZifPattern();