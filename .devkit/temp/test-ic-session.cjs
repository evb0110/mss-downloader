const https = require('https');
const fs = require('fs');

// Test with session cookies like the browser did
const testUrl = 'https://www.internetculturale.it/jmms/cacheman/web/Laurenziana_-_FI/Biblioteca_Medicea_Laurenziana_-_Firenze_-_IT-FI0100/oai.teca.bmlonline.it.21.XXXX.Plutei.IT_3AFI0100_Plutei_21.29/100.jpg';

const options = {
    headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8,ru;q=0.7',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Cookie': 'JSESSIONID=20F70DFA6466F3EFD7471C49594743DF',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
    }
};

console.log('Testing with session cookie...');

https.get(testUrl, options, (response) => {
    console.log(`Status: ${response.statusCode}`);
    console.log(`Content-Type: ${response.headers['content-type']}`);
    console.log(`Content-Length: ${response.headers['content-length']}`);
    
    let data = Buffer.alloc(0);
    response.on('data', (chunk) => {
        data = Buffer.concat([data, chunk]);
    });
    
    response.on('end', () => {
        console.log(`Final size: ${data.length} bytes`);
        
        // Check if it's HTML
        const preview = data.toString('utf8', 0, Math.min(500, data.length));
        const isHTML = preview.includes('<html') || preview.includes('<!DOCTYPE');
        
        console.log(`Is HTML: ${isHTML}`);
        if (isHTML) {
            console.log(`HTML preview: ${preview}`);
        } else {
            console.log('✅ Valid image data received');
        }
        
        // Also test without session
        console.log('\n--- Testing without session cookie ---');
        https.get(testUrl, (response2) => {
            console.log(`Status: ${response2.statusCode}`);
            console.log(`Content-Type: ${response2.headers['content-type']}`);
            
            let data2 = Buffer.alloc(0);
            response2.on('data', (chunk) => {
                data2 = Buffer.concat([data2, chunk]);
            });
            
            response2.on('end', () => {
                console.log(`Final size: ${data2.length} bytes`);
                const preview2 = data2.toString('utf8', 0, Math.min(500, data2.length));
                const isHTML2 = preview2.includes('<html') || preview2.includes('<!DOCTYPE');
                
                console.log(`Is HTML: ${isHTML2}`);
                if (isHTML2) {
                    console.log(`HTML preview: ${preview2}`);
                } else {
                    console.log('✅ Valid image data received without session');
                }
            });
        });
    });
}).on('error', (err) => {
    console.error('Error:', err);
});