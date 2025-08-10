#!/usr/bin/env node

/**
 * ULTRA-PRIORITY Test Script for Issue #23 - BDL Memory Allocation Failure
 * This script tests the exact URL that's failing with memory issues
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');
const https = require('https');
const path = require('path');
const fs = require('fs').promises;

async function testBdlMemoryIssue() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔬 ULTRA-PRIORITY TEST: BDL Memory Issue #23');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const testUrl = 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3506';
    console.log(`Testing URL: ${testUrl}`);
    
    try {
        // Step 1: Load manifest
        console.log('\n📋 Step 1: Loading manifest...');
        const loaders = new SharedManifestLoaders();
        const manifest = await loaders.getBDLManifest(testUrl);
        
        if (!manifest) {
            throw new Error('Failed to load manifest');
        }
        
        console.log(`✅ Manifest loaded successfully`);
        console.log(`   Manifest properties:`, Object.keys(manifest));
        
        // Extract images from manifest structure
        let imageUrls = [];
        if (manifest.images) {
            // Check if images are objects with URL property or direct URLs
            if (manifest.images.length > 0 && typeof manifest.images[0] === 'object') {
                console.log('   Image object structure:', Object.keys(manifest.images[0]));
                // Try different possible properties
                imageUrls = manifest.images.map(img => img.url || img.imageUrl || img['@id'] || img.id || img).filter(Boolean);
            } else {
                imageUrls = manifest.images;
            }
        } else if (manifest.canvases) {
            imageUrls = manifest.canvases.map(canvas => canvas.imageUrl).filter(Boolean);
        } else if (manifest.imageUrls) {
            imageUrls = manifest.imageUrls;
        } else if (Array.isArray(manifest)) {
            imageUrls = manifest;
        }
        
        console.log(`   Total pages: ${imageUrls.length}`);
        
        // Step 2: Analyze memory requirements
        console.log('\n💾 Step 2: Analyzing memory requirements...');
        const memUsage = process.memoryUsage();
        console.log(`   Current heap used: ${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`);
        console.log(`   Current heap total: ${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`);
        console.log(`   RSS: ${Math.round(memUsage.rss / 1024 / 1024)} MB`);
        
        // Step 3: Test image download with memory monitoring
        console.log('\n🖼️ Step 3: Testing image downloads...');
        
        if (imageUrls.length === 0) {
            throw new Error('No image URLs found in manifest');
        }
        
        console.log(`   Found ${imageUrls.length} images to download`);
        
        // Test downloading first 5 images to check memory usage
        const testImages = imageUrls.slice(0, Math.min(5, imageUrls.length));
        const imageBuffers = [];
        
        for (let i = 0; i < testImages.length; i++) {
            const url = testImages[i];
            console.log(`   Downloading image ${i + 1}/${testImages.length}...`);
            
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    console.log(`   ⚠️ Failed to download: HTTP ${response.status}`);
                    continue;
                }
                
                // This is where the memory allocation might fail
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                
                console.log(`   ✅ Downloaded: ${Math.round(buffer.length / 1024)} KB`);
                imageBuffers.push(buffer);
                
                // Check memory after each download
                const mem = process.memoryUsage();
                console.log(`      Heap used: ${Math.round(mem.heapUsed / 1024 / 1024)} MB`);
                
            } catch (error) {
                console.error(`   ❌ Error downloading image ${i + 1}: ${error.message}`);
                if (error.message.includes('Array buffer allocation failed')) {
                    console.error('   🚨 MEMORY ALLOCATION FAILURE DETECTED!');
                    console.error('   This is the exact issue reported by the user.');
                    return false;
                }
            }
        }
        
        // Step 4: Estimate total memory requirement
        console.log('\n📊 Step 4: Memory estimation for full download...');
        if (imageBuffers.length > 0) {
            const avgSize = imageBuffers.reduce((sum, buf) => sum + buf.length, 0) / imageBuffers.length;
            const estimatedTotal = (avgSize * imageUrls.length) / 1024 / 1024;
            console.log(`   Average image size: ${Math.round(avgSize / 1024)} KB`);
            console.log(`   Estimated total for ${imageUrls.length} images: ${Math.round(estimatedTotal)} MB`);
            
            // Check if this would exceed Node.js heap limit
            const maxHeap = require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024;
            console.log(`   Node.js max heap size: ${Math.round(maxHeap)} MB`);
            
            if (estimatedTotal > maxHeap * 0.8) {
                console.log(`   ⚠️ WARNING: Estimated memory usage exceeds safe heap limit!`);
                console.log(`   This will likely cause "Array buffer allocation failed" error`);
                return false;
            }
        }
        
        console.log('\n✅ Test completed successfully');
        return true;
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run the test
testBdlMemoryIssue().then(success => {
    if (success) {
        console.log('\n🎉 No memory issues detected in test');
    } else {
        console.log('\n🚨 Memory allocation issues confirmed!');
        console.log('Solution needed: Implement streaming/chunked processing for large BDL manuscripts');
    }
    process.exit(success ? 0 : 1);
});