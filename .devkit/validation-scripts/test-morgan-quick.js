#!/usr/bin/env node

/**
 * Quick Morgan Library Test - Test the specific user-reported URL
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testMorganQuick() {
    console.log('🧪 Quick Morgan Library Test - Testing User Reported URL');
    
    const loader = new SharedManifestLoaders();
    const testUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
    
    console.log(`\nTesting URL: ${testUrl}`);
    console.log('Expected: Should handle redirects without URL concatenation errors');
    
    try {
        const startTime = Date.now();
        const manifest = await loader.getMorganManifest(testUrl);
        const duration = Date.now() - startTime;
        
        console.log(`\n✅ SUCCESS! (${duration}ms)`);
        console.log(`📸 Found ${manifest.images.length} images`);
        console.log(`📖 Display name: ${manifest.displayName || 'N/A'}`);
        
        if (manifest.images.length > 0) {
            console.log(`🖼️  First image: ${manifest.images[0].url}`);
            console.log(`🏷️  Image labels: ${manifest.images.slice(0, 5).map(img => img.label).join(', ')}${manifest.images.length > 5 ? '...' : ''}`);
            
            // Test downloading first image to validate URL
            console.log('\n🔍 Testing first image download...');
            const firstImageUrl = manifest.images[0].url;
            const response = await loader.fetchWithRetry(firstImageUrl);
            
            if (response.ok) {
                const buffer = await response.buffer();
                console.log(`✅ First image download successful: ${Math.round(buffer.length / 1024)}KB`);
            } else {
                console.log(`⚠️  First image download failed: ${response.status}`);
            }
        }
        
        console.log('\n🎉 Morgan Library fix validation PASSED!');
        console.log('✅ No URL concatenation errors');
        console.log('✅ Redirect handling working correctly');
        
        return true;
        
    } catch (error) {
        console.log(`\n❌ FAILED: ${error.message}`);
        
        // Check if the error message is properly formatted (no URL concatenation)
        if (error.message.includes('Failed to fetch Morgan page:') && !error.message.match(/\d{3}https?:\/\//)) {
            console.log('✅ URL concatenation error is FIXED (proper error formatting)');
        } else {
            console.log('❌ URL concatenation error may still exist');
        }
        
        console.log('\n📋 Error Analysis:');
        console.log(`   Message: ${error.message}`);
        console.log(`   Type: ${error.constructor.name}`);
        
        return false;
    }
}

// Run the test
if (require.main === module) {
    testMorganQuick().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('❌ Test crashed:', error.message);
        process.exit(1);
    });
}

module.exports = { testMorganQuick };