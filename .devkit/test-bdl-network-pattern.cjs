const https = require('https');

async function testBDL() {
    // Test the exact URLs from your network traffic
    const testUrls = [
        'https://www.bdl.servizirl.it/cantaloupe//iiif/2/1460756/full/,958/0/default.jpg',  // From network traffic
        'https://www.bdl.servizirl.it/cantaloupe/iiif/2/1460756/full/full/0/default.jpg',   // Standard IIIF
        'https://www.bdl.servizirl.it/cantaloupe//iiif/2/1460756/full/max/0/default.jpg',   // Double slash + max
        'https://www.bdl.servizirl.it/cantaloupe//iiif/2/1460756/full/full/0/default.jpg',  // Double slash + full
    ];
    
    for (const url of testUrls) {
        console.log(`\nTesting: ${url}`);
        
        try {
            const response = await fetch(url);
            console.log(`Status: ${response.status}`);
            
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                console.log(`Size: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
                console.log('✅ SUCCESS');
                break;
            } else {
                console.log('❌ Failed');
            }
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }
}

testBDL();