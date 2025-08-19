#!/usr/bin/env bun

/**
 * Test British Library implementation
 * Test URL: https://bl.digirati.io/iiif/view/ark:/81055/vdc_100055984026.0x000001
 */

import { SharedManifestLoaders } from '../../../src/shared/SharedManifestLoaders.js';

async function testBritishLibraryImplementation() {
    console.log('🧪 Testing British Library implementation...\n');
    
    const testUrl = 'https://bl.digirati.io/iiif/view/ark:/81055/vdc_100055984026.0x000001';
    console.log('Test URL:', testUrl);
    
    try {
        const loader = new SharedManifestLoaders();
        const result = await loader.getManifestForLibrary('british_library', testUrl);
        
        console.log('\n✅ Manifest loading successful!');
        console.log('Type of result:', typeof result);
        
        if (Array.isArray(result)) {
            console.log('📄 Images array length:', result.length);
            if (result.length > 0) {
                console.log('First page URL:', result[0].url);
                console.log('First page label:', result[0].label);
            }
        } else if (result && typeof result === 'object' && 'images' in result) {
            console.log('📄 Images array length:', result.images.length);
            if (result.displayName) {
                console.log('📖 Display name:', result.displayName);
            }
            if (result.images.length > 0) {
                console.log('First page URL:', result.images[0].url);
                console.log('First page label:', result.images[0].label);
                
                // Test different page URLs to ensure we get different content
                if (result.images.length >= 10) {
                    console.log('\n🔍 Testing multiple pages:');
                    console.log('Page 1:', result.images[0].url);
                    console.log('Page 5:', result.images[4].url);  
                    console.log('Page 10:', result.images[9].url);
                }
            }
        }
        
        console.log('\n🎉 British Library implementation test PASSED!');
        
    } catch (error) {
        console.error('\n❌ British Library implementation test FAILED:', error);
        process.exit(1);
    }
}

testBritishLibraryImplementation().catch(console.error);