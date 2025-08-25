#!/usr/bin/env bun
// Validate that the base ID fix is working correctly

import { SharedManifestLoaders } from '../../src/shared/SharedManifestLoaders';

async function validateBaseIdFix() {
    console.log('🔧 Validating base ID fix for Bordeaux tiles...');
    
    const loader = new SharedManifestLoaders();
    
    try {
        // Test the manifest loading
        const result = await loader.getBordeauxManifest('https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778');
        
        if (Array.isArray(result)) {
            console.log('❌ FAIL: Got array instead of manifest object');
            return false;
        }
        
        console.log('✓ Manifest loaded successfully');
        console.log(`  - Display Name: ${result.displayName}`);
        console.log(`  - Public ID: ${result.publicId}`);
        console.log(`  - Base ID: ${result.baseId}`);
        console.log(`  - Page Count: ${result.pageCount}`);
        console.log(`  - Requires Tile Processor: ${result.requiresTileProcessor}`);
        
        // Critical validation: Base ID should NOT contain _MS_
        if (result.baseId?.includes('_MS_')) {
            console.log('❌ CRITICAL FAILURE: Base ID still contains _MS_ underscore');
            console.log(`   Base ID: ${result.baseId}`);
            console.log('   This will cause all tile downloads to return 404 errors');
            return false;
        }
        
        // Base ID should contain MS without underscore
        if (!result.baseId?.includes('MS0')) {
            console.log('❌ FAILURE: Base ID does not contain MS0 format');
            console.log(`   Base ID: ${result.baseId}`);
            console.log('   Expected format like: 330636101_MS0778');
            return false;
        }
        
        console.log('✅ SUCCESS: Base ID format is correct for tile downloads');
        console.log(`   ✓ Base ID: ${result.baseId} (correct format)`);
        console.log(`   ✓ Public ID: ${result.publicId} (original format)`);
        
        // Validate individual images have correct URLs and flags
        const firstImage = result.images?.[0];
        if (firstImage) {
            console.log(`   ✓ First image URL: ${firstImage.url}`);
            console.log(`   ✓ Requires tile processor: ${firstImage.requiresTileProcessor}`);
            
            if (firstImage.url.includes('/thumb/')) {
                console.log('❌ FAILURE: Individual image still uses thumbnail URL');
                return false;
            }
            
            if (!firstImage.requiresTileProcessor) {
                console.log('❌ FAILURE: Individual image missing requiresTileProcessor flag');
                return false;
            }
        }
        
        console.log('\n🎉 ALL VALIDATIONS PASSED!');
        console.log('   The baseId fix should resolve the production "No valid tiles found" errors');
        
        return true;
        
    } catch (error) {
        console.log('❌ Test failed:', error);
        return false;
    }
}

validateBaseIdFix().then(success => {
    if (success) {
        console.log('\n✅ Base ID fix validated successfully');
        console.log('💡 The production system should now be able to find tiles at:');
        console.log('   https://selene.bordeaux.fr/in/dz/330636101_MS0778_0006.xml');
        console.log('   instead of the failing:');
        console.log('   https://selene.bordeaux.fr/in/dz/330636101_MS_0778_0006.xml');
    } else {
        console.log('\n❌ Base ID fix validation failed');
    }
    process.exit(success ? 0 : 1);
});