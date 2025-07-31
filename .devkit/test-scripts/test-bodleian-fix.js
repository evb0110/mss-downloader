#!/usr/bin/env node

/**
 * Test Bodleian implementation
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

const BODLEIAN_URL = 'https://digital.bodleian.ox.ac.uk/objects/ce827512-d440-4833-bdba-f4f4f079d2cd/';

async function testBodleian() {
    console.log('=== Bodleian Test ===\n');
    
    try {
        console.log('Testing Bodleian manifest loading...');
        console.log('URL:', BODLEIAN_URL);
        
        const manifestLoaders = new SharedManifestLoaders();
        const manifest = await manifestLoaders.getBodleianManifest(BODLEIAN_URL);
        
        console.log('\n✅ Manifest loaded successfully');
        console.log('Images found:', manifest.images ? manifest.images.length : 0);
        console.log('Display name:', manifest.displayName);
        
        if (manifest.images && manifest.images.length > 0) {
            console.log('\nFirst 5 images:');
            for (let i = 0; i < Math.min(5, manifest.images.length); i++) {
                console.log(`  ${i + 1}. ${manifest.images[i].label}: ${manifest.images[i].url}`);
            }
            
            // Test if first image is accessible
            console.log('\nTesting first image accessibility...');
            const firstImageUrl = manifest.images[0].url;
            const https = require('https');
            
            const testResult = await new Promise((resolve) => {
                https.get(firstImageUrl, (response) => {
                    console.log(`   Status: ${response.statusCode}`);
                    console.log(`   Content-Type: ${response.headers['content-type']}`);
                    resolve({ 
                        success: response.statusCode === 200,
                        contentType: response.headers['content-type']
                    });
                }).on('error', (error) => {
                    console.log(`   Error: ${error.message}`);
                    resolve({ success: false, error: error.message });
                });
            });
            
            if (testResult.success) {
                console.log('✅ First image is accessible');
                return { 
                    success: true, 
                    message: `Bodleian working - found ${manifest.images.length} images`,
                    imageCount: manifest.images.length
                };
            } else {
                console.log('❌ First image not accessible');
                return { 
                    success: false, 
                    error: `Images not accessible: ${testResult.error}`,
                    imageCount: manifest.images.length
                };
            }
        } else {
            console.log('❌ No images found in manifest');
            return { success: false, error: 'No images found', imageCount: 0 };
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        return { success: false, error: error.message };
    }
}

// Run test
testBodleian().then(result => {
    console.log('\n=== Final Result ===');
    console.log(result.success ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Message:', result.message || result.error);
    if (result.imageCount !== undefined) {
        console.log('Images found:', result.imageCount);
    }
    
    process.exit(result.success ? 0 : 1);
});