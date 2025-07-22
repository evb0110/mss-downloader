const https = require('https');

async function testSpecificBDL() {
    // Test your specific working URL
    const workingUrl = 'https://www.bdl.servizirl.it/cantaloupe//iiif/2/1460861/full/max/0/default.jpg';
    const apiTestUrl = 'https://www.bdl.servizirl.it/cantaloupe//iiif/2/1460756/full/max/0/default.jpg';
    
    console.log('Testing your working URL...');
    console.log(workingUrl);
    
    try {
        const response = await fetch(workingUrl);
        console.log(`Status: ${response.status}`);
        
        if (response.ok) {
            const buffer = await response.arrayBuffer();
            console.log(`Size: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
            console.log('✅ Your URL works!');
        }
    } catch (error) {
        console.log(`❌ Error with your URL: ${error.message}`);
    }
    
    console.log('\nTesting API-generated URL...');
    console.log(apiTestUrl);
    
    try {
        const response = await fetch(apiTestUrl);
        console.log(`Status: ${response.status}`);
        
        if (response.ok) {
            const buffer = await response.arrayBuffer();
            console.log(`Size: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
            console.log('✅ API URL works!');
        } else {
            console.log('❌ API URL failed');
        }
    } catch (error) {
        console.log(`❌ Error with API URL: ${error.message}`);
    }
    
    // Test if the image IDs are different between manuscripts
    console.log('\n=== Image ID comparison ===');
    console.log('Your working ID: 1460861');
    console.log('API returned ID: 1460756');
    console.log('These are different image IDs - the API might be returning wrong manuscript pages');
}

testSpecificBDL();