const https = require('https');

// Test the resolution logic
const testUrl = 'https://www.bdl.servizirl.it/cantaloupe//iiif/2/1460756/full/max/0/default.jpg';

function applyResolution(url, resolution) {
    console.log(`Original URL: ${url}`);
    console.log(`Applying resolution: ${resolution}`);
    
    // BDL cantaloupe has double slash but uses standard IIIF patterns
    if (url.includes('cantaloupe//iiif/2/')) {
        console.log('BDL detected');
        // For BDL, replace the entire size/rotation/quality part
        const basePattern = /\/full\/[^/]+\/\d+\/[^/]+\.jpg$/;
        if (basePattern.test(url)) {
            const result = url.replace(basePattern, `/${resolution}`);
            console.log(`Result: ${result}`);
            return result;
        }
        console.log(`No match found, returning original: ${url}`);
        return url;
    }
    
    // ... other logic
    return url;
}

async function testResolutions() {
    console.log('=== Testing BDL Resolution Logic ===\n');
    
    const resolutions = [
        'full/full/0/default.jpg',
        'full/max/0/default.jpg',
        'full/4000,/0/default.jpg',
        'full/3000,/0/default.jpg'
    ];
    
    for (const resolution of resolutions) {
        console.log(`Testing ${resolution}:`);
        const modifiedUrl = applyResolution(testUrl, resolution);
        
        // Test the URL
        try {
            const response = await fetch(modifiedUrl);
            console.log(`Status: ${response.status}`);
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                console.log(`Size: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
            }
        } catch (error) {
            console.log(`Error: ${error.message}`);
        }
        console.log('');
    }
}

testResolutions();