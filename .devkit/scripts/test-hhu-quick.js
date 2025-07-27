#!/usr/bin/env node

const https = require('https');

async function testHHU() {
    console.log('Quick test of HHU manifest loading...\n');
    
    const manifestUrl = 'https://digital.ulb.hhu.de/i3f/v20/7674176/manifest';
    
    return new Promise((resolve, reject) => {
        https.get(manifestUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const manifest = JSON.parse(data);
                    console.log('✅ Manifest loaded successfully!');
                    console.log(`- Label: ${manifest.label || 'No label'}`);
                    console.log(`- Canvases: ${manifest.sequences?.[0]?.canvases?.length || 0}`);
                    resolve();
                } catch (err) {
                    console.error('❌ Failed to parse manifest:', err.message);
                    reject(err);
                }
            });
        }).on('error', reject);
    });
}

testHHU().catch(console.error);