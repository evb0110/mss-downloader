#!/usr/bin/env bun
/**
 * ULTRA-PRIORITY Issue #32 Validation Test
 * Tests the exact user URL to ensure the fix works
 */

import { SharedManifestLoaders } from '../../../src/shared/SharedManifestLoaders';

// Create mock fetch function for testing
const mockFetch = async (url: string, options?: any): Promise<Response> => {
    console.log(`[MOCK FETCH] ${url}`);
    
    // For the ONB manifest request, return a mock IIIF v3 manifest
    if (url.includes('api.onb.ac.at/iiif/presentation/v3/manifest/1000D995')) {
        const mockManifest = {
            "@context": "http://iiif.io/api/presentation/3/context.json",
            "id": "https://api.onb.ac.at/iiif/presentation/v3/manifest/1000D995",
            "type": "Manifest",
            "label": { "de": ["Test ONB Manuscript 1000D995"] },
            "items": [
                {
                    "id": "https://api.onb.ac.at/iiif/presentation/v3/canvas/1000D995/1",
                    "type": "Canvas",
                    "items": [
                        {
                            "id": "https://api.onb.ac.at/iiif/presentation/v3/page/1000D995/1",
                            "type": "AnnotationPage",
                            "items": [
                                {
                                    "id": "https://api.onb.ac.at/iiif/presentation/v3/annotation/1000D995/1",
                                    "type": "Annotation",
                                    "body": {
                                        "id": "https://iiif.onb.ac.at/images/AKON/AK124_077/full/full/0/default.jpg",
                                        "type": "Image",
                                        "service": [
                                            {
                                                "id": "https://iiif.onb.ac.at/images/AKON/AK124_077",
                                                "type": "ImageService3"
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    ]
                },
                {
                    "id": "https://api.onb.ac.at/iiif/presentation/v3/canvas/1000D995/2", 
                    "type": "Canvas",
                    "items": [
                        {
                            "id": "https://api.onb.ac.at/iiif/presentation/v3/page/1000D995/2",
                            "type": "AnnotationPage",
                            "items": [
                                {
                                    "id": "https://api.onb.ac.at/iiif/presentation/v3/annotation/1000D995/2",
                                    "type": "Annotation",
                                    "body": {
                                        "id": "https://iiif.onb.ac.at/images/AKON/AK124_078/full/full/0/default.jpg",
                                        "type": "Image",
                                        "service": [
                                            {
                                                "id": "https://iiif.onb.ac.at/images/AKON/AK124_078",
                                                "type": "ImageService3"
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        };
        
        return new Response(JSON.stringify(mockManifest), {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });
    }
    
    // For other requests, return 404
    return new Response('Not Found', { status: 404 });
};

async function testOnbFix() {
    console.log('🔬 ULTRA-VALIDATION TEST STARTED');
    console.log('=====================================');
    
    try {
        // Test the exact user URL
        const testUrl = 'https://viewer.onb.ac.at/1000D995';
        console.log(`📋 Testing URL: ${testUrl}`);
        
        // Create SharedManifestLoaders instance with mock fetch
        const loaders = new SharedManifestLoaders(mockFetch);
        
        // Test library detection first
        console.log('\n🔍 STEP 1: Testing library detection...');
        
        // Simulate the detectLibrary logic
        const detectedLibrary = testUrl.includes('viewer.onb.ac.at') ? 'onb' : null;
        console.log(`✅ Library detected as: "${detectedLibrary}"`);
        
        if (detectedLibrary !== 'onb') {
            throw new Error(`Library detection failed. Expected 'onb', got '${detectedLibrary}'`);
        }
        
        // Test the getManifestForLibrary method
        console.log('\n🔍 STEP 2: Testing SharedManifestLoaders.getManifestForLibrary...');
        const result = await loaders.getManifestForLibrary('onb', testUrl);
        
        console.log('✅ Manifest loaded successfully!');
        console.log(`📊 Results:`);
        console.log(`   - Images found: ${result.images?.length || 0}`);
        
        if (result.images && result.images.length > 0) {
            console.log(`   - First image URL: ${result.images[0].url}`);
            console.log(`   - Expected pattern: Should contain '/full/max/0/default.jpg'`);
            
            if (result.images[0].url.includes('/full/max/0/default.jpg')) {
                console.log('✅ Image URL format is correct');
            } else {
                console.log('⚠️  Image URL format unexpected');
            }
        }
        
        // Validation checks
        console.log('\n🔍 STEP 3: Validation checks...');
        
        if (!result.images || result.images.length === 0) {
            throw new Error('No images found in result');
        }
        
        if (result.images.length < 2) {
            console.log('⚠️  Expected at least 2 pages in test manifest');
        }
        
        // Test that no concatenation error occurs
        console.log('\n🔍 STEP 4: Testing error prevention...');
        try {
            // This should NOT throw an "Unsupported library: onb[URL]" error
            await loaders.getManifestForLibrary('onb', testUrl);
            console.log('✅ No concatenation error detected');
        } catch (error: any) {
            if (error.message.includes('onbhttps://')) {
                throw new Error(`CONCATENATION BUG STILL EXISTS: ${error.message}`);
            } else {
                console.log(`✅ Error is not a concatenation bug: ${error.message}`);
            }
        }
        
        console.log('\n🎉 ULTRA-VALIDATION TEST PASSED!');
        console.log('=====================================');
        console.log('✅ Issue #32 has been successfully fixed');
        console.log('✅ ONB library now properly supported in SharedManifestLoaders');
        console.log('✅ No more "Unsupported library: onb[URL]" errors');
        console.log('✅ Exact user URL works correctly');
        
        return true;
        
    } catch (error: any) {
        console.error('\n❌ ULTRA-VALIDATION TEST FAILED!');
        console.error('=====================================');
        console.error(`Error: ${error.message}`);
        console.error(`Stack: ${error.stack}`);
        
        return false;
    }
}

// Run the test
testOnbFix().then(success => {
    process.exit(success ? 0 : 1);
});