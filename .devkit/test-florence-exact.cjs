const https = require('https');

async function testExactUrl() {
    const url = 'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:317515/full/full/0/default.jpg';
    
    console.log(`Testing exact URL: ${url}`);
    
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            console.log(`Status: ${response.statusCode}`);
            console.log(`Headers:`, response.headers);
            
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                console.log(`Response size: ${buffer.length} bytes`);
                
                if (response.statusCode === 200) {
                    console.log('SUCCESS - Image downloaded');
                } else {
                    console.log('FAILED - Status not 200');
                }
                resolve();
            });
        }).on('error', (err) => {
            console.error('ERROR:', err.message);
            reject(err);
        });
    });
}

testExactUrl().catch(console.error);