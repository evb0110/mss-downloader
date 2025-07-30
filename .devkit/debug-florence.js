/**
 * Debug Florence Library - test ContentDM API
 */

const https = require('https');

async function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Response status: ${res.statusCode}`);
                console.log(`Content-Type: ${res.headers['content-type']}`);
                console.log(`Response length: ${data.length} bytes`);
                console.log(`First 200 chars: ${data.substring(0, 200)}`);
                
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(new Error(`JSON parse error: ${e.message}\nResponse: ${data.substring(0, 500)}`));
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    const itemId = '174871';
    console.log(`Testing Florence ContentDM API for item: ${itemId}\n`);
    
    // Test 1: Metadata API
    console.log('Test 1: Fetching metadata...');
    const metadataUrl = `https://cdm21059.contentdm.oclc.org/digital/api/collection/plutei/id/${itemId}`;
    console.log(`URL: ${metadataUrl}`);
    
    try {
        const metadata = await fetchJson(metadataUrl);
        console.log('\nMetadata response:');
        console.log(JSON.stringify(metadata, null, 2).substring(0, 500) + '...\n');
        
        if (metadata.pagefile) {
            console.log('✅ This is a compound object (has pagefile)\n');
            
            // Test 2: Compound API
            console.log('Test 2: Fetching compound structure...');
            const compoundUrl = `https://cdm21059.contentdm.oclc.org/digital/api/collections/plutei/items/${itemId}/compound`;
            console.log(`URL: ${compoundUrl}`);
            
            try {
                const compound = await fetchJson(compoundUrl);
                console.log('\nCompound response:');
                console.log(JSON.stringify(compound, null, 2).substring(0, 500) + '...\n');
                
                // Count pages
                let pageCount = 0;
                const countPages = (node) => {
                    if (node.id && !node.node) pageCount++;
                    if (node.node && Array.isArray(node.node)) {
                        node.node.forEach(child => countPages(child));
                    }
                };
                
                if (compound.node) {
                    compound.node.forEach(node => countPages(node));
                } else if (compound.id) {
                    countPages(compound);
                }
                
                console.log(`✅ Found ${pageCount} pages in compound structure`);
                
            } catch (error) {
                console.log(`❌ Compound API error: ${error.message}`);
            }
        } else {
            console.log('ℹ️ This is a single item (no pagefile)');
        }
        
        // Test 3: Direct IIIF URL
        console.log('\nTest 3: Testing direct IIIF URL...');
        const iiifUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${itemId}/full/full/0/default.jpg`;
        console.log(`URL: ${iiifUrl}`);
        
        // Just test if URL is accessible
        https.get(iiifUrl, (res) => {
            if (res.statusCode === 200) {
                console.log('✅ IIIF URL is accessible');
            } else {
                console.log(`❌ IIIF URL returned status: ${res.statusCode}`);
            }
        });
        
    } catch (error) {
        console.log(`❌ Metadata API error: ${error.message}`);
    }
}

main();