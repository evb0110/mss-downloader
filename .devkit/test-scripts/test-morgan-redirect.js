#!/usr/bin/env node

/**
 * Test Morgan redirect issue with actual production code
 */

const https = require('https');

const testUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';

function followRedirects(url, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 5) {
            reject(new Error('Too many redirects'));
            return;
        }

        const urlObj = new URL(url);
        
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            }
        };

        const req = https.request(options, (res) => {
            console.log(`Status: ${res.statusCode} for ${url}`);
            console.log('Headers:', JSON.stringify(res.headers, null, 2));
            
            if (res.statusCode >= 300 && res.statusCode < 400) {
                if (res.headers.location) {
                    const redirectUrl = new URL(res.headers.location, url).href;
                    console.log(`Redirect to: ${redirectUrl}\n`);
                    followRedirects(redirectUrl, redirectCount + 1).then(resolve).catch(reject);
                } else {
                    reject(new Error('Redirect without location header'));
                }
            } else if (res.statusCode === 200) {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    resolve({ status: res.statusCode, body, finalUrl: url });
                });
            } else {
                reject(new Error(`HTTP ${res.statusCode}`));
            }
        });

        req.on('error', reject);
        req.end();
    });
}

console.log('Testing Morgan URL redirect chain...\n');
followRedirects(testUrl)
    .then(result => {
        console.log('\nFinal result:');
        console.log('Status:', result.status);
        console.log('Final URL:', result.finalUrl);
        console.log('Body length:', result.body.length);
        
        // Check if the body contains images
        const hasImages = result.body.includes('collection-grid-image') || 
                         result.body.includes('manuscript-image') ||
                         result.body.includes('/sites/default/files/images/');
        console.log('Contains images:', hasImages);
    })
    .catch(error => {
        console.error('Error:', error.message);
    });