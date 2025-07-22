const https = require('https');

async function testBDL() {
    // Test the API endpoint first
    const apiUrl = 'https://www.bdl.servizirl.it/bdl/public/rest/json/item/3903/bookreader/pages';
    console.log('Testing BDL API...');
    
    try {
        const response = await fetch(apiUrl);
        console.log(`API Status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`Found ${data.length} pages`);
            
            if (data.length > 0) {
                const firstPage = data[0];
                console.log('First page:', JSON.stringify(firstPage, null, 2));
                
                if (firstPage.idMediaServer) {
                    // Test the IIIF image URL
                    const imageUrl = `https://www.bdl.servizirl.it/cantaloupe/iiif/2/${firstPage.idMediaServer}/full/full/0/default.jpg`;
                    console.log(`\nTesting image URL: ${imageUrl}`);
                    
                    const imageResponse = await fetch(imageUrl);
                    console.log(`Image Status: ${imageResponse.status}`);
                    
                    if (imageResponse.ok) {
                        const buffer = await imageResponse.arrayBuffer();
                        console.log(`Image Size: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
                        console.log('✅ BDL images working!');
                    } else {
                        console.log('❌ Image download failed');
                    }
                }
            }
        } else {
            console.log('❌ API failed');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testBDL();