const https = require('https');

async function testFlorence() {
    const testUrls = [
        'https://cdm21059.contentdm.oclc.org/utils/getfile/collection/plutei/id/317515',
        'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:317515/full/6000,/0/default.jpg',
        'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:317515/info.json',
        'https://cdm21059.contentdm.oclc.org/digital/api/singleitem/collection/plutei/id/317515/cpdtype/document/format/json'
    ];
    
    for (const url of testUrls) {
        console.log(`\nTesting: ${url}`);
        
        try {
            const response = await fetch(url);
            console.log(`Status: ${response.status}`);
            console.log(`Content-Type: ${response.headers.get('content-type')}`);
            
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType?.includes('json')) {
                    const data = await response.json();
                    console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
                } else if (contentType?.includes('xml')) {
                    const text = await response.text();
                    console.log('Response:', text.substring(0, 500) + '...');
                } else {
                    console.log(`Response size: ${response.headers.get('content-length') || 'unknown'} bytes`);
                }
            } else {
                console.log('Response failed');
            }
        } catch (error) {
            console.log(`Error: ${error.message}`);
        }
    }
}

testFlorence().catch(console.error);