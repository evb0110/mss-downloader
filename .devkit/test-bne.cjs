const https = require('https');

async function testBNE() {
    const url = 'https://bdh-rd.bne.es/pdf.raw?query=id:0000007619&page=1&pdf=true';
    
    return new Promise((resolve, reject) => {
        const options = {
            rejectUnauthorized: false,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        };
        
        https.get(url, options, (res) => {
            console.log('Status:', res.statusCode);
            console.log('Headers:', res.headers);
            
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                console.log('Response size:', buffer.length, 'bytes');
                console.log('Content type:', res.headers['content-type']);
                resolve();
            });
        }).on('error', (err) => {
            console.error('Error:', err.message);
            reject(err);
        });
    });
}

testBNE().catch(console.error);