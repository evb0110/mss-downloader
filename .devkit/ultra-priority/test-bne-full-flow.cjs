#!/usr/bin/env node

/**
 * ULTRA-DEEP TEST for Issue #11 - Full download flow simulation
 * This test simulates the complete download process to find where it hangs
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const https = require('https');
const fs = require('fs');
const path = require('path');

async function downloadWithTimeout(url, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Download timeout after ${timeout}ms for ${url}`));
        }, timeout);
        
        https.get(url, {
            rejectUnauthorized: false,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (response) => {
            clearTimeout(timer);
            
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode} for ${url}`));
                return;
            }
            
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve({
                    size: buffer.length,
                    contentType: response.headers['content-type']
                });
            });
            response.on('error', err => reject(err));
        }).on('error', err => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

async function testFullBNEFlow() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔬 ULTRA-DEEP BNE FULL FLOW TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Issue #11: висит на калькуляции (hanging on calculation)');
    console.log('URL: https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1\n');
    
    const loader = new SharedManifestLoaders();
    const url = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    
    try {
        // Step 1: Load manifest (already tested to work)
        console.log('📋 Step 1: Loading manifest...');
        const startTime = Date.now();
        const manifest = await loader.getBNEManifest(url);
        console.log(`✅ Manifest loaded in ${Date.now() - startTime}ms`);
        console.log(`   Found ${manifest.images.length} pages\n`);
        
        // Step 2: Test downloading actual PDFs
        console.log('📥 Step 2: Testing PDF downloads...');
        console.log('This is where the hanging might occur.\n');
        
        const pagesToTest = 5; // Test first 5 pages
        const downloadResults = [];
        
        for (let i = 0; i < Math.min(pagesToTest, manifest.images.length); i++) {
            const pageUrl = manifest.images[i].url;
            const pageStartTime = Date.now();
            
            console.log(`Page ${i + 1}: Downloading ${pageUrl}`);
            
            try {
                // Monitor the download with progress indicators
                let progressInterval = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - pageStartTime) / 1000);
                    if (elapsed > 0 && elapsed % 5 === 0) {
                        console.log(`   ⏱️  Still downloading page ${i + 1}... ${elapsed}s elapsed`);
                    }
                }, 5000);
                
                const result = await downloadWithTimeout(pageUrl, 30000);
                clearInterval(progressInterval);
                
                const downloadTime = Date.now() - pageStartTime;
                downloadResults.push({
                    page: i + 1,
                    time: downloadTime,
                    size: result.size,
                    type: result.contentType
                });
                
                console.log(`   ✅ Downloaded in ${downloadTime}ms - Size: ${Math.round(result.size / 1024)}KB`);
                
                // If download is taking too long, warn about potential hanging
                if (downloadTime > 10000) {
                    console.log(`   ⚠️  WARNING: Page ${i + 1} took ${downloadTime}ms - potential performance issue`);
                }
                
            } catch (error) {
                console.error(`   ❌ Failed to download page ${i + 1}: ${error.message}`);
                
                if (error.message.includes('timeout')) {
                    console.error('   🔴 CRITICAL: Download timeout detected - this is likely where the hanging occurs!');
                    console.error('   The issue is with downloading PDF files, not manifest loading.');
                }
                
                downloadResults.push({
                    page: i + 1,
                    error: error.message
                });
            }
        }
        
        // Step 3: Analyze results
        console.log('\n📊 Analysis Results:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const successfulDownloads = downloadResults.filter(r => !r.error);
        const failedDownloads = downloadResults.filter(r => r.error);
        
        if (successfulDownloads.length > 0) {
            const avgTime = successfulDownloads.reduce((sum, r) => sum + r.time, 0) / successfulDownloads.length;
            const avgSize = successfulDownloads.reduce((sum, r) => sum + r.size, 0) / successfulDownloads.length;
            
            console.log(`✅ Successful downloads: ${successfulDownloads.length}/${pagesToTest}`);
            console.log(`   Average download time: ${Math.round(avgTime)}ms`);
            console.log(`   Average file size: ${Math.round(avgSize / 1024)}KB`);
        }
        
        if (failedDownloads.length > 0) {
            console.log(`\n❌ Failed downloads: ${failedDownloads.length}/${pagesToTest}`);
            failedDownloads.forEach(f => {
                console.log(`   Page ${f.page}: ${f.error}`);
            });
        }
        
        // Step 4: Test concurrent downloads (might reveal different issues)
        console.log('\n📥 Step 3: Testing concurrent downloads...');
        const concurrentPages = 3;
        const concurrentUrls = manifest.images.slice(5, 5 + concurrentPages).map(img => img.url);
        
        const concurrentStartTime = Date.now();
        console.log(`Downloading ${concurrentPages} pages concurrently...`);
        
        try {
            const concurrentResults = await Promise.all(
                concurrentUrls.map(url => downloadWithTimeout(url, 30000))
            );
            
            const concurrentTime = Date.now() - concurrentStartTime;
            console.log(`✅ Concurrent downloads completed in ${concurrentTime}ms`);
            
            concurrentResults.forEach((result, index) => {
                console.log(`   Page ${6 + index}: ${Math.round(result.size / 1024)}KB`);
            });
            
        } catch (error) {
            console.error(`❌ Concurrent download failed: ${error.message}`);
            if (error.message.includes('timeout')) {
                console.error('🔴 CRITICAL: Concurrent downloads hanging - server may be rate limiting!');
            }
        }
        
        console.log('\n✅ Test completed successfully');
        
    } catch (error) {
        console.error('\n❌ Test failed with error:');
        console.error(error);
        process.exit(1);
    }
}

// Run the test
testFullBNEFlow().catch(error => {
    console.error('Uncaught error:', error);
    process.exit(1);
});