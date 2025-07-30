#!/usr/bin/env node

/**
 * Test Verona NBM directly
 */

const https = require('https');

async function testUrl(url) {
    return new Promise((resolve, reject) => {
        console.log(`Testing: ${url}`);
        
        const urlObj = new URL(url);
        
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            timeout: 10000,
            rejectUnauthorized: false // SSL bypass for problematic certs
        };

        const req = https.request(options, (res) => {
            console.log(`Status: ${res.statusCode}`);
            
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: body.slice(0, 500) // First 500 chars
                });
            });
        });

        req.on('error', error => {
            console.error(`Error: ${error.message}`);
            resolve({ error: error.message });
        });

        req.on('timeout', () => {
            console.error('Request timeout');
            req.destroy();
            resolve({ error: 'TIMEOUT' });
        });

        req.end();
    });
}

async function main() {
    console.log('Testing Verona NBM URLs...\n');
    
    // Test all known Verona URLs
    const urls = [
        'https://www.nuovabibliotecamanoscritta.it',
        'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
        'https://nbm.regione.veneto.it',
        'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json',
        'https://www.nuovabibliotecamanoscritta.it/documenti/mirador_json/manifest/LXXXIX841.json'
    ];
    
    for (const url of urls) {
        console.log('\n' + '='.repeat(60));
        const result = await testUrl(url);
        console.log(result);
    }
}

main();