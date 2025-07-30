const https = require('https');
const fs = require('fs');

// Disable SSL verification for this test
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const baseUrl = 'https://nbm.regione.veneto.it';
const testPaths = [
    'documenti/mirador_json/manifest/15.json',
    'manifest.json',
    'iiif/manifest.json', 
    'api/iiif/manifest.json',
    'mirador/manifest/15.json',
    'manuscripts/15/manifest.json',
    'manuscripts/15/manifest',
    'iiif/15/manifest.json',
    'viewer/15/manifest.json',
    'digital/15/manifest.json'
];

async function testUrl(path) {
    return new Promise((resolve) => {
        const url = `${baseUrl}/${path}`;
        console.log(`Testing: ${url}`);
        
        https.get(url, (res) => {
            console.log(`  Status: ${res.statusCode}`);
            console.log(`  Content-Type: ${res.headers['content-type']}`);
            
            if (res.statusCode === 200 && res.headers['content-type']?.includes('json')) {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const manifest = JSON.parse(data);
                        console.log(`  SUCCESS: Found valid JSON manifest`);
                        console.log(`  Type: ${manifest['@type'] || manifest.type}`);
                        console.log(`  ID: ${manifest['@id'] || manifest.id}`);
                        resolve({ url, manifest, success: true });
                    } catch (e) {
                        console.log(`  ERROR: Invalid JSON`);
                        resolve({ url, success: false });
                    }
                });
            } else {
                resolve({ url, success: false });
            }
        }).on('error', (err) => {
            console.log(`  ERROR: ${err.message}`);
            resolve({ url, success: false });
        });
    });
}

async function main() {
    console.log('Testing Verona NBM IIIF manifest URLs...\n');
    
    for (const path of testPaths) {
        const result = await testUrl(path);
        if (result.success && result.manifest) {
            // Save successful manifest
            fs.writeFileSync('/Users/evb/WebstormProjects/mss-downloader/.devkit/verona-manifest-found.json', JSON.stringify(result.manifest, null, 2));
            console.log(`\nSUCCESS: Manifest saved to verona-manifest-found.json\n`);
            break;
        }
        console.log(''); // Empty line between tests
    }
}

main().catch(console.error);