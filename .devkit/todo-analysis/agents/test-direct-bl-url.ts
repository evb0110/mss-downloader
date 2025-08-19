#!/usr/bin/env bun

/**
 * Test if the bl.digirati.io URL is itself a manifest
 */

async function testDirectBLUrl() {
    console.log('🔍 Testing direct BL URL as manifest...\n');
    
    // Based on BritishLibraryLoader.ts insight: bl.digirati.io URLs might BE the manifest
    const directUrl = 'https://bl.digirati.io/iiif/ark:/81055/vdc_100055984026.0x000001';
    
    console.log('Testing direct URL (no /manifest.json):', directUrl);
    
    try {
        const response = await fetch(directUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });
        
        console.log('Response status:', response.status);
        console.log('Content-Type:', response.headers.get('content-type'));
        
        if (response.ok) {
            const text = await response.text();
            console.log('✅ SUCCESS! Response received');
            console.log('Content length:', text.length);
            console.log('First 500 chars:', text.substring(0, 500));
            
            try {
                const manifest = JSON.parse(text);
                console.log('✅ Valid JSON manifest');
                
                if (manifest['@type'] || manifest.type) {
                    console.log('IIIF Type:', manifest['@type'] || manifest.type);
                }
                
                if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                    console.log(`📄 IIIF v2: Found ${manifest.sequences[0].canvases.length} canvases`);
                    
                    // Test first canvas
                    const firstCanvas = manifest.sequences[0].canvases[0];
                    if (firstCanvas && firstCanvas.images && firstCanvas.images[0]) {
                        const resource = firstCanvas.images[0].resource;
                        const service = resource?.service;
                        if (service && service['@id']) {
                            const imageUrl = `${service['@id']}/full/max/0/default.jpg`;
                            console.log('Sample image URL:', imageUrl);
                            
                            // Test if the image URL works
                            try {
                                const imgResponse = await fetch(imageUrl, { method: 'HEAD' });
                                console.log('Image URL test:', imgResponse.status === 200 ? '✅ Works' : `❌ Status ${imgResponse.status}`);
                            } catch (e) {
                                console.log('Image URL test: ❌ Failed');
                            }
                        }
                    }
                }
                
                if (manifest.items && Array.isArray(manifest.items)) {
                    console.log(`📄 IIIF v3: Found ${manifest.items.length} items`);
                }
                
                console.log('🏆 FOUND THE CORRECT PATTERN!');
                console.log('The bl.digirati.io URL without /manifest.json IS the manifest URL!');
                
            } catch (e) {
                console.log('❌ Response is not valid JSON');
                console.log('Parse error:', e);
            }
        } else {
            console.log('❌ Failed with status:', response.status, response.statusText);
            const text = await response.text();
            console.log('Error response:', text.substring(0, 200));
        }
        
    } catch (error) {
        console.log('❌ Error:', error);
    }
}

testDirectBLUrl().catch(console.error);