const https = require('https');

function fetchPage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function testPattern() {
    const html = await fetchPage('https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=29315');
    
    console.log('Testing miniature pattern...');
    const miniaturePattern = /object-miniature\.do\?id=(\d+)/g;
    const matches = [];
    let match;
    
    while ((match = miniaturePattern.exec(html)) !== null) {
        matches.push(match[1]);
    }
    
    console.log(`Found ${matches.length} matches`);
    console.log('First 10 IDs:', matches.slice(0, 10));
}

testPattern().catch(console.error);