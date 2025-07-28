const { SharedManifestLoaders } = require('../../dist/shared/SharedManifestLoaders');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Simple fetch implementation for testing
async function fetchWithHTTPS(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': '*/*'
            },
            timeout: 60000 // 60 second timeout
        }, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString();
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: async () => body,
                    json: async () => JSON.parse(body)
                });
            });
        }).on('error', reject);
    });
}

async function testFlorenceManifest() {
    console.log('Testing Florence library manifest loading...\n');
    
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
    
    try {
        console.log(`Testing URL: ${testUrl}`);
        console.log('Loading manifest with SharedManifestLoaders...');
        
        const startTime = Date.now();
        const loader = new SharedManifestLoaders(fetchWithHTTPS);
        const manifest = await loader.loadFlorence(testUrl);
        const loadTime = Date.now() - startTime;
        
        console.log(`\n✅ Manifest loaded successfully in ${loadTime}ms!`);
        console.log(`Total images: ${manifest.images.length}`);
        console.log(`First image URL: ${manifest.images[0].url}`);
        console.log(`First image label: ${manifest.images[0].label}`);
        
        // Test downloading first image
        console.log('\nTesting image download...');
        const imageUrl = manifest.images[0].url;
        
        const downloadStart = Date.now();
        const response = await fetchWithHTTPS(imageUrl);
        const downloadTime = Date.now() - downloadStart;
        
        if (response.ok) {
            console.log(`✅ First image accessible in ${downloadTime}ms!`);
            console.log('   Florence library is working correctly with timeout fixes.');
        } else {
            console.log(`❌ Failed to access image: HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.error('\n❌ Test failed!');
        console.error('Error:', error.message);
        if (error.code === 'ETIMEDOUT') {
            console.error('\nThe timeout issue is still occurring. The server is not responding.');
        }
    }
}

// Run the test
testFlorenceManifest().catch(console.error);