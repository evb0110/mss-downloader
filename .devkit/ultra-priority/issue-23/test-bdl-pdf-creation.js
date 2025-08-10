#!/usr/bin/env node

/**
 * ULTRA-PRIORITY Test: BDL PDF Creation Memory Issue #23
 * This tests the actual PDF creation process where memory allocation fails
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');
const { EnhancedPdfMerger } = require('../../../src/main/services/EnhancedPdfMerger.ts');
const fs = require('fs').promises;
const path = require('path');

async function testBdlPdfCreation() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔬 ULTRA-TEST: BDL PDF Creation Memory Issue');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const testUrl = 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3506';
    const outputDir = '.devkit/ultra-priority/issue-23/test-output';
    
    try {
        // Create output directory
        await fs.mkdir(outputDir, { recursive: true });
        
        // Step 1: Load manifest
        console.log('\n📋 Step 1: Loading BDL manifest...');
        const loaders = new SharedManifestLoaders();
        const manifest = await loaders.getBDLManifest(testUrl);
        
        // Extract image URLs
        const imageUrls = manifest.images.map(img => img.url);
        console.log(`✅ Found ${imageUrls.length} images`);
        
        // Step 2: Download images in batches to simulate real scenario
        console.log('\n📥 Step 2: Downloading images in batches...');
        const imageBuffers = [];
        const batchSize = 50; // Simulate downloading 50 at a time
        
        for (let i = 0; i < Math.min(imageUrls.length, 100); i += batchSize) {
            const batch = imageUrls.slice(i, i + batchSize);
            console.log(`   Downloading batch ${Math.floor(i/batchSize) + 1} (${batch.length} images)...`);
            
            const batchPromises = batch.map(async (url, idx) => {
                try {
                    const response = await fetch(url);
                    if (!response.ok) return null;
                    
                    const arrayBuffer = await response.arrayBuffer();
                    return Buffer.from(arrayBuffer);
                } catch (error) {
                    console.log(`      Failed to download image ${i + idx + 1}: ${error.message}`);
                    return null;
                }
            });
            
            const batchBuffers = await Promise.all(batchPromises);
            imageBuffers.push(...batchBuffers.filter(Boolean));
            
            // Memory check after each batch
            const mem = process.memoryUsage();
            console.log(`      Heap used: ${Math.round(mem.heapUsed / 1024 / 1024)} MB`);
            console.log(`      RSS: ${Math.round(mem.rss / 1024 / 1024)} MB`);
            
            if (mem.heapUsed > 3 * 1024 * 1024 * 1024) { // 3GB threshold
                console.warn('   ⚠️ Memory usage exceeding 3GB!');
            }
        }
        
        console.log(`   Downloaded ${imageBuffers.length} images successfully`);
        
        // Step 3: Attempt PDF creation - THIS IS WHERE IT FAILS
        console.log('\n📄 Step 3: Creating PDF (memory-intensive operation)...');
        const pdfMerger = new EnhancedPdfMerger();
        
        try {
            // Test regular createPDF method
            console.log('   Testing regular createPDF method...');
            const startMem = process.memoryUsage();
            
            const pdfBytes = await pdfMerger.createPDF(imageBuffers, {
                title: 'BDL Test Manuscript',
                onProgress: (progress) => {
                    if (progress.pageNumber % 10 === 0) {
                        const currentMem = process.memoryUsage();
                        console.log(`      Page ${progress.pageNumber}/${progress.totalPages} - Heap: ${Math.round(currentMem.heapUsed / 1024 / 1024)} MB`);
                    }
                }
            });
            
            console.log(`   ✅ PDF created: ${Math.round(pdfBytes.length / 1024 / 1024)} MB`);
            
            // Save PDF
            const pdfPath = path.join(outputDir, 'test-regular.pdf');
            await fs.writeFile(pdfPath, pdfBytes);
            console.log(`   ✅ PDF saved to: ${pdfPath}`);
            
        } catch (pdfError) {
            console.error(`   ❌ Regular PDF creation failed: ${pdfError.message}`);
            
            if (pdfError.message.includes('Array buffer allocation failed')) {
                console.log('\n🚨 MEMORY ALLOCATION FAILURE CONFIRMED!');
                console.log('   This is the exact issue from Issue #23');
                
                // Try chunked method as solution
                console.log('\n🔧 Testing chunked PDF creation as solution...');
                try {
                    const pdfBytes = await pdfMerger.createPDFChunked(imageBuffers, {
                        title: 'BDL Test Manuscript',
                        chunkSize: 20,
                        library: 'bdl',
                        totalPages: imageBuffers.length,
                        onProgress: (progress) => {
                            if (progress.pageNumber % 10 === 0) {
                                const currentMem = process.memoryUsage();
                                console.log(`      Page ${progress.pageNumber}/${progress.totalPages} - Heap: ${Math.round(currentMem.heapUsed / 1024 / 1024)} MB`);
                            }
                        }
                    });
                    
                    console.log(`   ✅ Chunked PDF created: ${Math.round(pdfBytes.length / 1024 / 1024)} MB`);
                    
                    const pdfPath = path.join(outputDir, 'test-chunked.pdf');
                    await fs.writeFile(pdfPath, pdfBytes);
                    console.log(`   ✅ Chunked PDF saved to: ${pdfPath}`);
                    console.log('\n✅ SOLUTION: Chunked PDF creation works!');
                    
                } catch (chunkedError) {
                    console.error(`   ❌ Chunked PDF also failed: ${chunkedError.message}`);
                }
            }
        }
        
        // Final memory stats
        console.log('\n📊 Final Memory Statistics:');
        const finalMem = process.memoryUsage();
        console.log(`   Heap used: ${Math.round(finalMem.heapUsed / 1024 / 1024)} MB`);
        console.log(`   Heap total: ${Math.round(finalMem.heapTotal / 1024 / 1024)} MB`);
        console.log(`   RSS: ${Math.round(finalMem.rss / 1024 / 1024)} MB`);
        console.log(`   External: ${Math.round(finalMem.external / 1024 / 1024)} MB`);
        console.log(`   Array buffers: ${Math.round(finalMem.arrayBuffers / 1024 / 1024)} MB`);
        
        return true;
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run with increased heap size if needed
console.log('Node.js heap limit:', Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024), 'MB');
console.log('To increase heap size, run with: node --max-old-space-size=8192');

testBdlPdfCreation().then(success => {
    if (success) {
        console.log('\n🎉 Test completed successfully');
    } else {
        console.log('\n🚨 Test failed - memory issues need fixing');
    }
    process.exit(success ? 0 : 1);
});