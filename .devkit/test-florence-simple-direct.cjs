const https = require('https');

async function testFlorenceSimple() {
    console.log('=== Florence Simple Test ===\n');
    
    const url = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
    
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            let html = '';
            res.on('data', chunk => html += chunk);
            res.on('end', () => {
                try {
                    // Look for IIIF image pattern directly in the HTML
                    console.log('Looking for IIIF image URLs...');
                    
                    // Look for the IIIF URL in the og:image meta tag
                    const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
                    if (ogImageMatch) {
                        console.log('Found OG image:', ogImageMatch[1]);
                        
                        // Convert to full resolution
                        const fullResUrl = ogImageMatch[1].replace(/\/\d+,?\//, '/full/');
                        console.log('Full resolution URL:', fullResUrl);
                    }
                    
                    // Look for item ID and create IIIF URLs manually
                    const itemMatch = url.match(/id\/(\d+)/);
                    if (itemMatch) {
                        const itemId = itemMatch[1];
                        console.log('Item ID:', itemId);
                        
                        // Try to construct IIIF URL
                        const iiifUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${itemId}/full/full/0/default.jpg`;
                        console.log('Constructed IIIF URL:', iiifUrl);
                        
                        // Test if this URL works
                        console.log('\nTesting IIIF URL...');
                        https.get(iiifUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0'
                            }
                        }, (testRes) => {
                            console.log('✅ IIIF URL test result:', testRes.statusCode);
                            if (testRes.statusCode === 200) {
                                console.log('✅ Florence is working - can access images directly');
                                console.log('The issue may be with compound object parsing, not basic functionality');
                            }
                            resolve();
                        }).on('error', (err) => {
                            console.log('❌ IIIF URL test failed:', err.message);
                            resolve();
                        });
                    } else {
                        console.log('❌ Could not extract item ID from URL');
                        resolve();
                    }
                    
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

testFlorenceSimple().catch(console.error);