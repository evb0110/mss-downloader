const https = require('https');

const testUrl = 'https://www.loc.gov/item/48040441/';

function fetchWithTimeout(url, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log(`Fetching: ${url}`);
        console.log(`Timeout set to: ${timeoutMs}ms`);
        
        const timeout = setTimeout(() => {
            reject(new Error(`Request timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json,*/*'
            }
        }, (res) => {
            clearTimeout(timeout);
            const elapsed = Date.now() - startTime;
            console.log(`Response received in ${elapsed}ms, Status: ${res.statusCode}`);
            
            let data = '';
            res.on('data', chunk => {
                data += chunk;
                if (data.length % 10000 === 0) {
                    console.log(`Received ${data.length} bytes so far...`);
                }
            });
            
            res.on('end', () => {
                const totalElapsed = Date.now() - startTime;
                console.log(`Complete! Total time: ${totalElapsed}ms, Total size: ${data.length} bytes`);
                resolve({ status: res.statusCode, data, elapsed: totalElapsed });
            });
            
            res.on('error', reject);
        }).on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

async function testManifestLoading() {
    try {
        console.log('Testing Library of Congress manifest loading...');
        console.log(`URL: ${testUrl}\n`);
        
        // Extract item ID
        const itemMatch = testUrl.match(/\/item\/([^/?]+)/);
        if (!itemMatch) {
            throw new Error('Invalid LOC URL');
        }
        
        const manifestUrl = `https://www.loc.gov/item/${itemMatch[1]}/manifest.json`;
        console.log(`Manifest URL: ${manifestUrl}\n`);
        
        // Test manifest loading with different timeouts
        const timeouts = [10000, 30000, 60000, 120000]; // 10s, 30s, 60s, 120s
        
        for (const timeout of timeouts) {
            console.log(`\n=== Testing with ${timeout/1000}s timeout ===`);
            try {
                const result = await fetchWithTimeout(manifestUrl, timeout);
                
                if (result.status === 200) {
                    const manifest = JSON.parse(result.data);
                    console.log('\nManifest loaded successfully!');
                    console.log(`Title: ${manifest.label || 'Unknown'}`);
                    console.log(`Sequences: ${manifest.sequences?.length || 0}`);
                    console.log(`Canvases: ${manifest.sequences?.[0]?.canvases?.length || 0}`);
                    
                    // Test first image URL
                    if (manifest.sequences?.[0]?.canvases?.[0]) {
                        const firstCanvas = manifest.sequences[0].canvases[0];
                        const imageService = firstCanvas.images?.[0]?.resource?.service?.['@id'];
                        if (imageService) {
                            console.log(`\nFirst image service: ${imageService}`);
                            const imageUrl = `${imageService}/full/full/0/default.jpg`;
                            console.log(`First image URL: ${imageUrl}`);
                            
                            // Test image loading
                            console.log('\nTesting first image download...');
                            const imgResult = await fetchWithTimeout(imageUrl, 30000);
                            console.log(`Image status: ${imgResult.status}, Size: ${imgResult.data.length} bytes`);
                        }
                    }
                    
                    break; // Success, no need to try longer timeouts
                } else {
                    console.log(`Failed with status: ${result.status}`);
                }
            } catch (error) {
                console.error(`Failed: ${error.message}`);
                if (timeout === timeouts[timeouts.length - 1]) {
                    throw error; // Re-throw on last attempt
                }
            }
        }
        
    } catch (error) {
        console.error('\nTest failed:', error.message);
    }
}

testManifestLoading();