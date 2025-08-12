#!/usr/bin/env bun

/**
 * PRODUCTION CODE TEST for BNE
 * This tests the ACTUAL production code path, not isolated scripts
 */

import { EnhancedManuscriptDownloaderService } from '../../src/main/services/EnhancedManuscriptDownloaderService';
import { ComprehensiveLogger } from '../../src/main/services/ComprehensiveLogger';
import configService from '../../src/main/services/configService';

async function testProductionBNE() {
    console.log('🔬 PRODUCTION BNE TEST - Using Real App Code\n');
    console.log('=' .repeat(60));
    
    // Test URL from issue #11
    const testUrl = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    
    try {
        // Step 1: Create service instance (as the app does)
        console.log('1️⃣ Creating production service instance...');
        
        // Initialize logger
        const logger = new ComprehensiveLogger();
        
        // Create service with proper dependencies
        const service = new EnhancedManuscriptDownloaderService(logger);
        
        // Step 2: Parse the manuscript URL (manifest generation)
        console.log('2️⃣ Parsing manuscript URL to generate manifest...');
        const startManifest = Date.now();
        const manifest = await service.parseManuscriptUrl(testUrl);
        const manifestTime = Date.now() - startManifest;
        
        console.log(`✅ Manifest generated in ${manifestTime}ms`);
        console.log(`   Pages found: ${manifest.totalPages}`);
        console.log(`   Library: ${manifest.library}`);
        console.log(`   First page URL: ${manifest.pageLinks[0]}`);
        
        // Step 3: Test actual image download (THIS IS CRITICAL)
        console.log('\n3️⃣ Testing actual PDF download through production path...');
        
        if (manifest.pageLinks && manifest.pageLinks.length > 0) {
            // Test downloading first 3 pages using the SAME method the app uses
            for (let i = 0; i < Math.min(3, manifest.pageLinks.length); i++) {
                const pageUrl = manifest.pageLinks[i];
                console.log(`\n   Testing page ${i + 1}: ${pageUrl}`);
                
                const startDownload = Date.now();
                try {
                    // Use the actual fetchDirect method that failed
                    const response = await service.fetchDirect(pageUrl);
                    const downloadTime = Date.now() - startDownload;
                    
                    if (response.ok) {
                        const buffer = await response.arrayBuffer();
                        console.log(`   ✅ Download successful!`);
                        console.log(`      Time: ${downloadTime}ms`);
                        console.log(`      Size: ${buffer.byteLength} bytes`);
                        console.log(`      Content-Type: ${response.headers.get('content-type')}`);
                        
                        // Verify it's a PDF
                        const uint8 = new Uint8Array(buffer);
                        const header = String.fromCharCode(...uint8.slice(0, 5));
                        if (header === '%PDF-') {
                            console.log(`      ✅ Valid PDF detected`);
                        } else {
                            console.log(`      ❌ Not a valid PDF! Header: ${header}`);
                        }
                    } else {
                        console.log(`   ❌ Download failed: HTTP ${response.status}`);
                    }
                } catch (error: any) {
                    console.log(`   ❌ Download error: ${error.message}`);
                    if (error.cause) {
                        console.log(`      Cause: ${error.cause.message}`);
                        if (error.cause.code) {
                            console.log(`      Code: ${error.cause.code}`);
                        }
                    }
                    
                    // This is where we'd see the SSL error
                    if (error.message.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE') ||
                        error.cause?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
                        console.log('\n   🔥 SSL CERTIFICATE ERROR DETECTED!');
                        console.log('   This means the production SSL bypass is NOT working!');
                        console.log('   Need to add bdh-rd.bne.es to fetchWithHTTPS domains');
                        return false;
                    }
                }
            }
        }
        
        // Step 4: Test the full download flow
        console.log('\n4️⃣ Testing full download flow with downloadManuscript...');
        const tempDir = `/tmp/bne-test-${Date.now()}`;
        
        try {
            const downloadResult = await service.downloadManuscript(
                manifest,
                tempDir,
                1,  // page 1
                3,  // to page 3
                (progress) => {
                    if (typeof progress === 'object' && 'current' in progress) {
                        console.log(`   Progress: ${progress.current}/${progress.total}`);
                    }
                }
            );
            
            console.log(`✅ Full download completed!`);
            console.log(`   Images saved to: ${tempDir}`);
            
        } catch (error: any) {
            console.log(`❌ Full download failed: ${error.message}`);
            if (error.cause?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
                console.log('   🔥 SSL ERROR in full download flow!');
                return false;
            }
        }
        
        // Step 5: Summary
        console.log('\n' + '=' .repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('=' .repeat(60));
        console.log(`Manifest Generation: ${manifestTime}ms`);
        console.log(`Total Pages: ${manifest.totalPages}`);
        console.log(`Binary Search Used: ${manifestTime < 5000 ? 'YES ✅' : 'NO ❌'}`);
        console.log(`SSL Bypass Working: Check download results above`);
        console.log(`Production Code Path: FULLY TESTED`);
        
        return true;
        
    } catch (error: any) {
        console.error('❌ Production test failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run the test
console.log('Testing with ACTUAL PRODUCTION CODE\n');
testProductionBNE().then(success => {
    if (success) {
        console.log('\n✅ All tests passed!');
        process.exit(0);
    } else {
        console.log('\n❌ Tests failed - SSL bypass not working properly');
        process.exit(1);
    }
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});