const fs = require('fs').promises;
const path = require('path');

// Test the Fulda URL parsing fix
async function testFuldaFix() {
    console.log('Testing Fulda PPN extraction fix...\n');
    
    // Test URLs
    const testUrls = [
        'https://fuldig.hs-fulda.de/viewer/image/PPN314753702/',
        'https://fuldig.hs-fulda.de/viewer/image/PPN314753702/1/',
        'https://fuldig.hs-fulda.de/viewer/api/v1/records/PPN314753702/manifest/',
        'https://fuldig.hs-fulda.de/viewer/image/PPN314755322/2/'
    ];
    
    // Original regex (broken)
    const originalRegex = /\/image\/([^/]+)/;
    
    // Fixed regex that handles both viewer and manifest URLs
    const fixedRegex = /(?:\/image\/|\/records\/)([^/]+)/;
    
    console.log('Testing with original regex:');
    for (const url of testUrls) {
        const match = url.match(originalRegex);
        console.log(`URL: ${url}`);
        console.log(`Match: ${match ? match[1] : 'NO MATCH'}`);
        console.log('---');
    }
    
    console.log('\nTesting with fixed regex:');
    for (const url of testUrls) {
        const match = url.match(fixedRegex);
        console.log(`URL: ${url}`);
        console.log(`Match: ${match ? match[1] : 'NO MATCH'}`);
        console.log('---');
    }
    
    // Show the fix code
    console.log('\nFix to apply in loadFuldaManifest:');
    console.log(`
    // Original line 8885:
    // const urlMatch = fuldaUrl.match(/\\/image\\/([^/]+)/);
    
    // Fixed line 8885:
    const urlMatch = fuldaUrl.match(/(?:\\/image\\/|\\/records\\/)([^/]+)/);
    `);
}

testFuldaFix();