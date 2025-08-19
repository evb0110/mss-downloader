#!/usr/bin/env bun

/**
 * Test British Library image URLs work correctly
 */

import { SharedManifestLoaders } from '../../../src/shared/SharedManifestLoaders.js';

async function testBLImageUrls() {
    console.log('🖼️  Testing British Library image URLs...\n');
    
    const testUrl = 'https://bl.digirati.io/iiif/view/ark:/81055/vdc_100055984026.0x000001';
    
    try {
        const loader = new SharedManifestLoaders();
        const result = await loader.getManifestForLibrary('british_library', testUrl);
        
        if (!result || typeof result !== 'object' || !('images' in result)) {
            throw new Error('Invalid manifest result');
        }
        
        const images = result.images;
        console.log(`📄 Testing images from ${images.length} total pages`);
        
        // Test first 5 image URLs
        const testUrls = images.slice(0, 5);
        
        for (let i = 0; i < testUrls.length; i++) {
            const imageUrl = testUrls[i].url;
            const label = testUrls[i].label;
            
            console.log(`\n🧪 Testing page ${i + 1} (${label}):`);
            console.log(`URL: ${imageUrl}`);
            
            try {
                // Use HEAD request to check if image is accessible
                const response = await fetch(imageUrl, { 
                    method: 'HEAD',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    }
                });
                
                console.log(`Status: ${response.status} ${response.statusText}`);
                console.log(`Content-Type: ${response.headers.get('content-type')}`);
                console.log(`Content-Length: ${response.headers.get('content-length')} bytes`);
                
                if (response.ok) {
                    console.log('✅ Image accessible');
                } else {
                    console.log('❌ Image not accessible');
                }
                
            } catch (error) {
                console.log('❌ Error accessing image:', error);
            }
        }
        
        // Test different resolution options
        const firstImageService = images[0].url.replace('/full/max/0/default.jpg', '');
        console.log('\n🔍 Testing different resolutions:');
        
        const resolutions = ['full/max/0/default.jpg', 'full/2000,/0/default.jpg', 'full/1000,/0/default.jpg'];
        
        for (const resolution of resolutions) {
            const testUrl = `${firstImageService}/${resolution}`;
            console.log(`\n🧪 Testing resolution: ${resolution}`);
            
            try {
                const response = await fetch(testUrl, { method: 'HEAD' });
                const contentLength = response.headers.get('content-length');
                console.log(`Status: ${response.status}, Size: ${contentLength} bytes`);
                
                if (response.ok) {
                    console.log('✅ Resolution supported');
                } else {
                    console.log('❌ Resolution not supported');
                }
            } catch (error) {
                console.log('❌ Error:', error);
            }
        }
        
        console.log('\n🎉 British Library image URL testing complete!');
        
    } catch (error) {
        console.error('\n❌ British Library image testing failed:', error);
        process.exit(1);
    }
}

testBLImageUrls().catch(console.error);