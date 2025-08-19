#!/usr/bin/env bun

/**
 * CUDL Real Workflow Test - Download Sample Pages
 */

import { writeFile } from 'fs/promises';
import { execSync } from 'child_process';

async function testCUDLWorkflow() {
    console.log('🧪 Testing CUDL Real Workflow - Downloading Sample Pages');
    console.log('=' .repeat(60));
    
    try {
        // Test manuscript: MS-II-00006-00032
        const testUrl = 'https://cudl.lib.cam.ac.uk/view/MS-II-00006-00032';
        const manifestUrl = 'https://cudl.lib.cam.ac.uk/iiif/MS-II-00006-00032';
        
        console.log('📜 Loading CUDL manifest...');
        
        // Fetch manifest
        const manifestResponse = await fetch(manifestUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Referer': 'https://cudl.lib.cam.ac.uk/',
                'Accept': 'application/json, */*'
            }
        });
        
        if (!manifestResponse.ok) {
            throw new Error(`Manifest fetch failed: ${manifestResponse.status}`);
        }
        
        const manifest = await manifestResponse.json();
        const canvases = manifest.sequences[0].canvases;
        
        console.log(`✅ Manifest loaded: ${canvases.length} pages`);
        
        // Test downloading first 3 pages
        const testPages = [0, 1, 2]; // First 3 pages
        const downloadResults = [];
        
        for (const pageIndex of testPages) {
            const canvas = canvases[pageIndex];
            const resource = canvas.images[0]?.resource;
            const rawUrl = resource?.['@id'] || resource?.id;
            
            if (!rawUrl) {
                console.log(`⚠️ No image URL for page ${pageIndex + 1}`);
                continue;
            }
            
            // Convert to max resolution URL
            const imageUrl = rawUrl + '/full/max/0/default.jpg';
            
            console.log(`🖼️ Downloading page ${pageIndex + 1}...`);
            console.log(`   URL: ${imageUrl.substring(0, 80)}...`);
            
            const startTime = Date.now();
            
            try {
                const imageResponse = await fetch(imageUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                        'Referer': 'https://cudl.lib.cam.ac.uk/',
                        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
                    }
                });
                
                if (!imageResponse.ok) {
                    throw new Error(`HTTP ${imageResponse.status}`);
                }
                
                const imageBuffer = await imageResponse.arrayBuffer();
                const imageSizeKB = Math.round(imageBuffer.byteLength / 1024);
                const downloadTime = Date.now() - startTime;
                
                // Save sample image
                const filename = `cudl_sample_page_${pageIndex + 1}.jpg`;
                const filepath = `/Users/evb/WebstormProjects/mss-downloader/.devkit/validation/READY-FOR-USER/${filename}`;
                
                await writeFile(filepath, new Uint8Array(imageBuffer));
                
                downloadResults.push({
                    page: pageIndex + 1,
                    sizekb: imageSizeKB,
                    time: downloadTime,
                    url: imageUrl,
                    filepath
                });
                
                console.log(`   ✅ ${imageSizeKB}KB in ${downloadTime}ms (${filename})`);
                
            } catch (error: any) {
                console.log(`   ❌ Failed: ${error.message}`);
                downloadResults.push({
                    page: pageIndex + 1,
                    error: error.message,
                    url: imageUrl
                });
            }
        }
        
        // Create test results summary
        const summary = {
            testUrl,
            manifestUrl,
            manifestPages: canvases.length,
            testDate: new Date().toISOString(),
            downloadResults,
            statistics: {
                successfulDownloads: downloadResults.filter(r => !r.error).length,
                totalDownloads: downloadResults.length,
                totalSizeKB: downloadResults.reduce((sum, r) => sum + (r.sizekb || 0), 0),
                avgDownloadTime: Math.round(downloadResults.reduce((sum, r) => sum + (r.time || 0), 0) / downloadResults.filter(r => !r.error).length)
            }
        };
        
        await writeFile(
            '/Users/evb/WebstormProjects/mss-downloader/.devkit/validation/READY-FOR-USER/cudl-workflow-test-results.json',
            JSON.stringify(summary, null, 2)
        );
        
        console.log('\n📊 Test Results Summary:');
        console.log(`   Successful Downloads: ${summary.statistics.successfulDownloads}/${summary.statistics.totalDownloads}`);
        console.log(`   Total Size: ${summary.statistics.totalSizeKB}KB`);
        console.log(`   Average Download Time: ${summary.statistics.avgDownloadTime}ms`);
        
        console.log('\n📁 Evidence Files Created:');
        downloadResults.forEach(result => {
            if (result.filepath) {
                console.log(`   ✅ ${result.filepath.split('/').pop()}`);
            }
        });
        
        console.log('   ✅ cudl-workflow-test-results.json');
        
        if (summary.statistics.successfulDownloads === summary.statistics.totalDownloads) {
            console.log('\n🎉 CUDL WORKFLOW TEST: FULLY SUCCESSFUL');
        } else {
            console.log('\n⚠️ CUDL WORKFLOW TEST: PARTIAL SUCCESS');
        }
        
    } catch (error: any) {
        console.error('\n❌ CUDL WORKFLOW TEST FAILED:');
        console.error(`   Error: ${error.message}`);
        process.exit(1);
    }
}

testCUDLWorkflow().catch(console.error);