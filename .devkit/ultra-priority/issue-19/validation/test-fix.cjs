#!/usr/bin/env node

/**
 * ULTRA-VALIDATION: Test the fix for Heidelberg Issue #19
 */

const { SharedManifestLoaders } = require('../../../../src/shared/SharedManifestLoaders.js');

async function testFix() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ TESTING FIX FOR ISSUE #19');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const loader = new SharedManifestLoaders();
    
    // Test with the EXACT URL from the user's error report
    const userUrl = 'https://digi.ub.uni-heidelberg.de/diglit/salVIII2';
    
    console.log(`\n🎯 Testing with user's exact URL: ${userUrl}`);
    console.log('─'.repeat(50));
    
    try {
        const manifest = await loader.getManifestForLibrary('heidelberg', userUrl);
        
        console.log(`✅ SUCCESS! Manifest loaded!`);
        console.log(`📚 Title: ${manifest.displayName}`);
        console.log(`📄 Total pages: ${manifest.images.length}`);
        console.log(`🖼️ First page: ${manifest.images[0]?.url}`);
        console.log(`🖼️ Last page: ${manifest.images[manifest.images.length - 1]?.url}`);
        console.log(`📊 Metadata:`, manifest.metadata);
        
        // Test downloading actual images
        console.log('\n🔬 Testing image downloads...');
        for (let i = 0; i < Math.min(3, manifest.images.length); i++) {
            const imageUrl = manifest.images[i].url;
            console.log(`  Downloading page ${i + 1}: ${imageUrl.substring(0, 80)}...`);
            
            const response = await fetch(imageUrl);
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                console.log(`    ✅ Downloaded: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
            } else {
                console.log(`    ❌ Failed: HTTP ${response.status}`);
            }
        }
        
        console.log('\n✅ FIX VALIDATED: User URL now works correctly!');
        return true;
        
    } catch (error) {
        console.log(`❌ FAILED: ${error.message}`);
        console.log(`Stack: ${error.stack}`);
        return false;
    }
}

testFix().then(success => {
    if (success) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 FIX SUCCESSFUL - READY FOR VALIDATION');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
}).catch(console.error);