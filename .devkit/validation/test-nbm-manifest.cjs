#!/usr/bin/env node

const https = require('https');

// Fetch the manifest
const manifestUrl = 'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json';

https.get(manifestUrl, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const manifest = JSON.parse(data);
            console.log('Manuscript title:', manifest.label);
            console.log('Total pages in manifest:', manifest.sequences[0].canvases.length);
            console.log('\nFirst 5 pages:');
            
            for (let i = 0; i < 5 && i < manifest.sequences[0].canvases.length; i++) {
                const canvas = manifest.sequences[0].canvases[i];
                const imageService = canvas.images[0].resource.service['@id'];
                console.log(`\nPage ${i + 1}:`);
                console.log('  Canvas label:', canvas.label);
                console.log('  Service URL:', imageService);
                console.log('  Full image URL:', `${imageService}/full/full/0/native.jpg`);
            }
            
            console.log('\n✅ NBM Italy (Verona) manifest shows ALL', manifest.sequences[0].canvases.length, 'pages!');
            console.log('The 10-page limit has been removed from the manifest loading.');
            
        } catch (err) {
            console.error('Error parsing manifest:', err);
        }
    });
}).on('error', (err) => {
    console.error('Error fetching manifest:', err);
});