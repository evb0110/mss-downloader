console.log('Testing Linz library...');

const https = require('https');

function testManifest(id) {
    return new Promise((resolve) => {
        const url = `https://digi.landesbibliothek.at/viewer/api/v1/records/${id}/manifest/`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const manifest = JSON.parse(data);
                    const pages = manifest.sequences?.[0]?.canvases?.length || 0;
                    console.log(`ID ${id}: ${res.statusCode} - ${pages} pages`);
                    resolve(res.statusCode === 200);
                } catch (e) {
                    console.log(`ID ${id}: ${res.statusCode} - Parse error`);
                    resolve(false);
                }
            });
        }).on('error', (err) => {
            console.log(`ID ${id}: Network error - ${err.message}`);
            resolve(false);
        });
    });
}

async function main() {
    const ids = [116, 254, 279, 1194];
    for (const id of ids) {
        await testManifest(id);
    }
}

main();