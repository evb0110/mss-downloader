// ULTRA-PRIORITY VALIDATION TEST for Issue #33 - Digital Scriptorium Catalog URLs
// AUTONOMOUS EXECUTION - Testing exact user scenario

import path from 'path';
import { execSync } from 'child_process';

/**
 * COMPREHENSIVE VALIDATION TEST
 * 
 * Testing User's Exact URL: https://search.digital-scriptorium.org/catalog/DS1649
 * Expected Result: Should extract https://colenda.library.upenn.edu/items/ark:/81431/p38g8fj78/manifest
 * Previous Error: "Digital Scriptorium catalog URLs not yet supported"
 * Expected New Behavior: Successfully load manifest and return page list
 */

class UltraValidationTest {
    
    async testDigitalScriptoriumCatalogURL() {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔬 ULTRA-VALIDATION: Digital Scriptorium Issue #33');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log();
        console.log('📋 Test Parameters:');
        console.log('   User URL: https://search.digital-scriptorium.org/catalog/DS1649');
        console.log('   Expected: Catalog URL parsing should work');
        console.log('   Previous: "catalog URLs not yet supported" error');
        console.log('   Fix: Implemented catalog HTML parsing');
        console.log();
        
        try {
            // Import the SharedManifestLoaders to test the fix
            const { SharedManifestLoaders } = await import('../../../src/shared/SharedManifestLoaders.js');
            const loaders = new SharedManifestLoaders();
            
            const testUrl = 'https://search.digital-scriptorium.org/catalog/DS1649';
            
            console.log('🔍 Testing Digital Scriptorium catalog URL parsing...');
            
            // This should NOT throw an "Unsupported library" error anymore
            const result = await loaders.getDigitalScriptoriumManifest(testUrl);
            
            console.log('✅ SUCCESS: Digital Scriptorium catalog URL processed');
            console.log(`📄 Found ${result.images ? result.images.length : 'unknown'} pages`);
            
            if (result.images && Array.isArray(result.images) && result.images.length > 0) {
                console.log('📸 Sample image URLs:');
                for (let i = 0; i < Math.min(3, result.images.length); i++) {
                    console.log(`   ${i + 1}. ${result.images[i].url}`);
                }
                
                console.log();
                console.log('🎯 VALIDATION RESULT: PASSED');
                console.log('   ✅ Catalog URL parsing works');
                console.log('   ✅ Manifest extraction successful'); 
                console.log('   ✅ Page URLs generated');
                console.log(`   ✅ Found ${result.images.length} pages`);
                
                return {
                    success: true,
                    pages: result.images.length,
                    sampleUrls: result.images.slice(0, 3).map(img => img.url)
                };
                
            } else {
                throw new Error('No images found in result');
            }
            
        } catch (error) {
            console.error('❌ VALIDATION FAILED:', error);
            
            if (error instanceof Error && error.message.includes('catalog URLs not yet supported')) {
                console.error('🚨 CRITICAL: The fix was not applied correctly!');
                console.error('   The old error message suggests the code change failed');
            }
            
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    
    async runComprehensiveValidation() {
        console.log('🚀 Starting ULTRA-VALIDATION Protocol...');
        console.log();
        
        // Test 1: User's exact scenario
        const mainTest = await this.testDigitalScriptoriumCatalogURL();
        
        // Test 2: Check library detection
        console.log();
        console.log('🔍 Testing library detection...');
        
        try {
            const { EnhancedManuscriptDownloaderService } = await import('../../../src/main/services/EnhancedManuscriptDownloaderService.js');
            const downloader = new EnhancedManuscriptDownloaderService();
            
            const detectedLibrary = downloader.detectLibrary('https://search.digital-scriptorium.org/catalog/DS1649');
            console.log(`📚 Detected library: ${detectedLibrary}`);
            
            if (detectedLibrary === 'digital_scriptorium') {
                console.log('✅ Library detection: PASSED');
            } else {
                console.log('❌ Library detection: FAILED');
                return { success: false, error: 'Library detection failed' };
            }
            
        } catch (error) {
            console.error('❌ Library detection test failed:', error);
            return { success: false, error: `Library detection failed: ${error}` };
        }
        
        console.log();
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 ULTRA-VALIDATION SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        if (mainTest.success) {
            console.log('🎉 VALIDATION STATUS: PASSED');
            console.log('   ✅ Issue #33 has been COMPLETELY RESOLVED');
            console.log('   ✅ Digital Scriptorium catalog URLs work');
            console.log('   ✅ User can now download manuscripts');
            console.log(`   ✅ ${mainTest.pages} pages available for download`);
            console.log();
            console.log('🚀 Ready for AUTONOMOUS VERSION BUMP');
        } else {
            console.log('❌ VALIDATION STATUS: FAILED');
            console.log('   🚨 Fix implementation needs revision');
            console.log(`   Error: ${mainTest.error}`);
        }
        
        return mainTest;
    }
}

// Run validation immediately
const validator = new UltraValidationTest();
validator.runComprehensiveValidation()
    .then(result => {
        process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
        console.error('💥 VALIDATION CRASHED:', error);
        process.exit(1);
    });