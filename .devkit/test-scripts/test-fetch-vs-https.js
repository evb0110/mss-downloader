#!/usr/bin/env node

console.log('Node version:', process.version);
console.log('Has native fetch:', typeof fetch !== 'undefined');

async function testWithFetch(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        return { method: 'fetch', status: response.status };
    } catch (error) {
        return { method: 'fetch', error: error.message };
    }
}

async function testWithHttps(url) {
    const https = require('https');
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0'
            },
            rejectUnauthorized: false
        };

        const req = https.request(options, (res) => {
            resolve({ method: 'https', status: res.statusCode });
        });

        req.on('error', error => {
            resolve({ method: 'https', error: error.message });
        });

        req.end();
    });
}

async function main() {
    const url = 'https://www.nuovabibliotecamanoscritta.it';
    
    console.log('\nTesting:', url);
    
    if (typeof fetch !== 'undefined') {
        const fetchResult = await testWithFetch(url);
        console.log('Fetch result:', fetchResult);
    }
    
    const httpsResult = await testWithHttps(url);
    console.log('HTTPS result:', httpsResult);
}

main();