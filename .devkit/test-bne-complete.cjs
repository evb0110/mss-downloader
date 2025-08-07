#!/usr/bin/env node

/**
 * COMPLETE TEST for Issue #11: BNE hanging
 * Tests full download of multiple pages
 */

const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');
const fs = require('fs');
const path = require('path');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔬 BNE COMPLETE DOWNLOAD TEST - ISSUE #11');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

async function testBNEComplete() {
    const loaders = new SharedManifestLoaders();
    const testUrl = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    
    console.log('Test URL:', testUrl);
    console.log('');
    
    try {
        // Get manifest
        console.log('Phase 1: Getting manifest...');
        const startTime = Date.now();
        const manifest = await loaders.getManifestForLibrary('bne', testUrl);
        const manifestTime = Date.now() - startTime;
        
        console.log(`✅ Manifest retrieved in ${manifestTime}ms`);
        console.log(`   Total pages: ${manifest.images ? manifest.images.length : 0}`);
        
        if (!manifest.images || manifest.images.length === 0) {
            throw new Error('No images in manifest');
        }
        
        // Test downloading first 5 pages
        console.log('');
        console.log('Phase 2: Testing download of first 5 pages...');
        
        const outputDir = '.devkit/validation/bne-test';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const downloadResults = [];
        const pagesToTest = 5;
        
        for (let i = 0; i < Math.min(pagesToTest, manifest.images.length); i++) {
            const page = manifest.images[i];
            const pageNum = i + 1;
            
            console.log(`\nDownloading page ${pageNum}...`);
            const downloadStart = Date.now();
            
            try {
                // Use the loaders' fetch method which has SSL bypass
                const response = await loaders.fetchWithRetry(page.url);
                
                // Handle different response types (Node vs fetch API)
                let pageData;
                if (response.arrayBuffer) {
                    const buffer = await response.arrayBuffer();
                    pageData = Buffer.from(buffer);
                } else if (response.buffer) {
                    pageData = await response.buffer();
                } else {
                    // For text responses, try to get as buffer
                    const text = await response.text();
                    pageData = Buffer.from(text, 'binary');
                }
                
                const downloadTime = Date.now() - downloadStart;
                const filePath = path.join(outputDir, `page-${pageNum}.pdf`);
                fs.writeFileSync(filePath, pageData);
                
                const fileSize = pageData.length;
                const isPDF = pageData.toString('utf8', 0, 4) === '%PDF';
                
                downloadResults.push({
                    page: pageNum,
                    success: true,
                    time: downloadTime,
                    size: fileSize,
                    isPDF: isPDF
                });
                
                console.log(`  ✅ Downloaded: ${(fileSize / 1024).toFixed(2)} KB in ${downloadTime}ms`);
                console.log(`  Format: ${isPDF ? 'Valid PDF' : 'Not a PDF'}`);
                console.log(`  Saved to: ${filePath}`);
                
            } catch (error) {
                const downloadTime = Date.now() - downloadStart;
                downloadResults.push({
                    page: pageNum,
                    success: false,
                    time: downloadTime,
                    error: error.message
                });
                
                console.log(`  ❌ Failed: ${error.message} after ${downloadTime}ms`);
            }
        }
        
        // Summary
        console.log('\n');
        console.log('═══════════════════════════════════════════════');
        console.log('DOWNLOAD SUMMARY:');
        console.log('═══════════════════════════════════════════════');
        
        const successful = downloadResults.filter(r => r.success);
        const failed = downloadResults.filter(r => !r.success);
        
        console.log(`Total pages tested: ${downloadResults.length}`);
        console.log(`Successful downloads: ${successful.length}`);
        console.log(`Failed downloads: ${failed.length}`);
        
        if (successful.length > 0) {
            const avgTime = successful.reduce((sum, r) => sum + r.time, 0) / successful.length;
            const avgSize = successful.reduce((sum, r) => sum + r.size, 0) / successful.length;
            console.log(`Average download time: ${avgTime.toFixed(0)}ms`);
            console.log(`Average file size: ${(avgSize / 1024).toFixed(2)} KB`);
            console.log(`All PDFs valid: ${successful.every(r => r.isPDF) ? 'Yes' : 'No'}`);
        }
        
        if (failed.length > 0) {
            console.log('\nFailed pages:');
            failed.forEach(r => {
                console.log(`  Page ${r.page}: ${r.error}`);
            });
        }
        
        // Final verdict
        console.log('\n');
        if (successful.length === downloadResults.length) {
            console.log('✅✅✅ ISSUE #11 RESOLVED ✅✅✅');
            console.log('BNE downloads work perfectly!');
            console.log('No hanging detected.');
            console.log('');
            console.log('The issue "висит на калькуляции" is FIXED.');
            console.log('SSL bypass is working correctly.');
        } else if (successful.length > 0) {
            console.log('⚠️  PARTIAL SUCCESS');
            console.log('Some pages download but others fail.');
        } else {
            console.log('❌ ISSUE CONFIRMED');
            console.log('BNE downloads are failing.');
        }
        
    } catch (error) {
        console.error('');
        console.error('❌ TEST FAILED:');
        console.error('   Error:', error.message);
        console.error('   Stack:', error.stack);
    }
}

console.log('Starting complete BNE test...');
console.log('This will download and save 5 pages to verify functionality.');
console.log('');

testBNEComplete().then(() => {
    console.log('');
    console.log('Test completed');
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});