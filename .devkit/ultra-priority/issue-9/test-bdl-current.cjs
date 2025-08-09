#!/usr/bin/env node
/**
 * Test script for Issue #9: BDL (Biblioteca Digitale Lombarda) URL handling
 * Tests both the correct URL and the malformed version reported in the issue
 * 
 * FINDINGS SUMMARY:
 * - SharedManifestLoaders.getBDLManifest() works perfectly (loads 302 pages)
 * - URL sanitization correctly fixes malformed URLs  
 * - Both correct and malformed URLs produce identical results
 * - The issue likely lies in the main service's loadBDLManifest() method
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

async function testBDLUrls() {
    console.log('🔍 Testing BDL URLs from Issue #9\n');
    
    const urls = [
        {
            label: 'Correct URL',
            url: 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903'
        },
        {
            label: 'Malformed URL (from issue report)',
            url: 'www.bdl.servizirl.ithttps://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903'
        }
    ];
    
    const loaders = new SharedManifestLoaders();
    
    for (const testCase of urls) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing: ${testCase.label}`);
        console.log(`URL: ${testCase.url}`);
        console.log(`${'='.repeat(60)}`);
        
        try {
            // Test direct BDL manifest loading (assuming it's a BDL URL)
            console.log('\n1. Direct BDL Manifest Loading:');
            try {
                const manifest = await loaders.getBDLManifest(testCase.url);
                console.log(`   ✅ BDL manifest loaded successfully`);
                console.log(`   Images found: ${manifest.images?.length || 0}`);
                
                if (manifest.images && manifest.images.length > 0) {
                    console.log(`   First image URL: ${manifest.images[0].url}`);
                    console.log(`   First image page: ${manifest.images[0].page}`);
                    console.log(`   Sample of first 3 image URLs:`);
                    manifest.images.slice(0, 3).forEach((img, idx) => {
                        console.log(`     ${idx + 1}: Page ${img.page} - ${img.url.slice(0, 80)}...`);
                    });
                }
                
            } catch (bdlError) {
                console.log(`   ❌ Direct BDL manifest loading failed: ${bdlError.message}`);
                console.log(`   Stack trace: ${bdlError.stack?.split('\n').slice(0, 3).join('\n')}`);
            }
            
            // Test via library dispatcher
            console.log('\n2. Library Dispatcher (getManifestForLibrary):');
            try {
                const manifest = await loaders.getManifestForLibrary('bdl', testCase.url);
                console.log(`   ✅ Manifest loaded via library dispatcher`);
                console.log(`   Images found: ${manifest.images?.length || 0}`);
                
                if (manifest.images && manifest.images.length > 0) {
                    console.log(`   First image URL: ${manifest.images[0].url}`);
                    console.log(`   Sample URLs (first 3):`);
                    manifest.images.slice(0, 3).forEach((img, idx) => {
                        console.log(`     ${idx + 1}: ${img.url}`);
                    });
                }
                
            } catch (dispatchError) {
                console.log(`   ❌ Library dispatcher failed: ${dispatchError.message}`);
                console.log(`   Stack trace: ${dispatchError.stack?.split('\n').slice(0, 3).join('\n')}`);
            }
            
            // Test URL sanitization
            console.log('\n3. URL Sanitization:');
            try {
                const sanitized = loaders.sanitizeUrl(testCase.url);
                console.log(`   Original URL: ${testCase.url}`);
                console.log(`   Sanitized URL: ${sanitized}`);
                console.log(`   Changed: ${sanitized !== testCase.url ? 'YES' : 'NO'}`);
            } catch (sanitizeError) {
                console.log(`   ❌ URL sanitization failed: ${sanitizeError.message}`);
            }
            
        } catch (error) {
            console.log(`\n❌ CRITICAL ERROR during test:`);
            console.log(`   Error: ${error.message}`);
            console.log(`   Type: ${error.constructor.name}`);
            console.log(`   Stack: ${error.stack?.split('\n').slice(0, 5).join('\n')}`);
        }
    }
    
    // Additional URL analysis
    console.log(`\n${'='.repeat(60)}`);
    console.log('URL ANALYSIS');
    console.log(`${'='.repeat(60)}`);
    
    urls.forEach((testCase, index) => {
        console.log(`\n${index + 1}. ${testCase.label}:`);
        console.log(`   Length: ${testCase.url.length}`);
        console.log(`   Starts with protocol: ${testCase.url.startsWith('http')}`);
        console.log(`   Contains 'bdl.servizirl.it': ${testCase.url.includes('bdl.servizirl.it')}`);
        console.log(`   Contains 'BDL-OGGETTO': ${testCase.url.includes('BDL-OGGETTO')}`);
        
        // Check for URL malformation patterns
        const duplicateProtocols = (testCase.url.match(/https?:\/\//g) || []).length;
        console.log(`   Protocol occurrences: ${duplicateProtocols}`);
        
        if (duplicateProtocols > 1) {
            console.log(`   ⚠️  MALFORMED: Multiple protocols detected`);
            console.log(`   Suggested fix: Remove duplicate protocol`);
            const fixed = testCase.url.replace(/^[^h]*https?:\/\//, 'https://');
            console.log(`   Fixed URL would be: ${fixed}`);
        }
    });
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('TEST COMPLETED');
    console.log(`${'='.repeat(60)}`);
}

// Execute the test
if (require.main === module) {
    testBDLUrls().catch(error => {
        console.error('Fatal test error:', error);
        process.exit(1);
    });
}

module.exports = { testBDLUrls };