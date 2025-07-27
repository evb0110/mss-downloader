#!/usr/bin/env node

const https = require('https');

// Test the exact URL pattern from the manifest
async function testNBMUrl() {
    const manifestUrl = 'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json';
    
    console.log('Fetching NBM manifest to check URL patterns...\n');
    
    https.get(manifestUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const manifest = JSON.parse(data);
            const canvas = manifest.sequences[0].canvases[0];
            const serviceUrl = canvas.images[0].resource.service['@id'];
            
            console.log('First page service URL:', serviceUrl);
            console.log('\nURL patterns being generated:');
            console.log('1. Full/max:', serviceUrl + '/full/max/0/default.jpg');
            console.log('2. Full/2000:', serviceUrl + '/full/2000,/0/default.jpg');
            console.log('3. Full/full:', serviceUrl + '/full/full/0/default.jpg');
            
            // The issue might be the double slash
            console.log('\nNotice the double slash before /full - this might be the issue!');
            
            // Test if removing double slash works
            const fixedUrl = serviceUrl.replace(/\/$/, '') + '/full/2000,/0/default.jpg';
            console.log('\nFixed URL (no double slash):', fixedUrl);
            
            // Try to download with the fixed URL
            console.log('\nTesting download with fixed URL...');
            https.get(fixedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, (imgRes) => {
                console.log('Response status:', imgRes.statusCode);
                console.log('Response headers:', imgRes.headers);
                
                if (imgRes.statusCode === 302 || imgRes.statusCode === 301) {
                    console.log('Redirect to:', imgRes.headers.location);
                }
            });
        });
    });
}

testNBMUrl();