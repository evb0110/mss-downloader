#!/usr/bin/env node

const https = require('https');
const fs = require('fs').promises;

async function debugManifest() {
    const url = 'https://dam.iccu.sbn.it/mol_46/containers/avQYk0e/manifest';
    
    console.log('🔍 Debugging Internet Culturale Manifest Structure');
    console.log('=' .repeat(60));
    
    try {
        const manifest = await new Promise((resolve, reject) => {
            const request = https.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/json, application/ld+json, */*'
                }
            }, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            request.on('error', reject);
            request.setTimeout(10000, () => request.abort());
        });
        
        console.log('📄 Raw manifest structure:');
        console.log(JSON.stringify(manifest, null, 2));
        
        // Save for inspection
        await fs.writeFile('./debug-manifest.json', JSON.stringify(manifest, null, 2));
        console.log('\n📁 Saved to debug-manifest.json');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugManifest();