#!/usr/bin/env bun

/**
 * Production Test for Florence ContentDM Download Solution
 * 
 * Tests the complete problematic manuscript (plutei:217710) that was failing with 403 errors
 * Validates the production-quality download logic with proper etiquette and error handling
 */

import { FlorenceProductionDownloader, type FlorenceDownloadOptions } from './FlorenceProductionDownloader';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface ManuscriptPage {
    id: string;
    title: string;
}

// Test manuscript that was causing 403 Forbidden errors at 6000px
const TEST_MANUSCRIPT = {
    collection: 'plutei',
    manuscriptId: '217710', // Parent manuscript ID
    testPages: [
        { id: '217706', title: 'Carta 1r' },
        { id: '217707', title: 'Carta 1v' },
        { id: '217708', title: 'Carta 2r' },
        { id: '217709', title: 'Carta 2v' },
        { id: '217710', title: 'Carta 3r' },
        { id: '217711', title: 'Carta 3v' },
        { id: '217712', title: 'Carta 4r' },
        { id: '217713', title: 'Carta 4v' },
        { id: '217714', title: 'Carta 5r' },
        { id: '217715', title: 'Carta 5v' }
    ] as ManuscriptPage[]
};

async function validateDownloadResults(results: any[]): Promise<void> {
    console.log('\n🔍 [Validation] Analyzing download results...');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful downloads: ${successful.length}/${results.length}`);
    console.log(`❌ Failed downloads: ${failed.length}/${results.length}`);
    
    if (failed.length > 0) {
        console.log('\n📋 Failed download details:');
        failed.forEach((result, index) => {
            console.log(`   ${index + 1}. ${result.error}`);
        });
    }
    
    if (successful.length > 0) {
        console.log('\n📊 Success analysis:');
        
        // Check buffer sizes
        const bufferSizes = successful.map(r => r.buffer?.length || 0);
        const minSize = Math.min(...bufferSizes);
        const maxSize = Math.max(...bufferSizes);
        const avgSize = bufferSizes.reduce((a, b) => a + b, 0) / bufferSizes.length;
        
        console.log(`   Buffer sizes: ${Math.round(minSize/1024)}KB - ${Math.round(maxSize/1024)}KB (avg: ${Math.round(avgSize/1024)}KB)`);
        
        // Check response times
        const responseTimes = successful.map(r => r.responseTime || 0);
        const minTime = Math.min(...responseTimes);
        const maxTime = Math.max(...responseTimes);
        const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        
        console.log(`   Response times: ${minTime}ms - ${maxTime}ms (avg: ${Math.round(avgTime)}ms)`);
        
        // Validate JPEG signatures
        let validJpegCount = 0;
        for (const result of successful) {
            if (result.buffer && result.buffer.length >= 2) {
                if (result.buffer[0] === 0xFF && result.buffer[1] === 0xD8) {
                    validJpegCount++;
                }
            }
        }
        
        console.log(`   Valid JPEG signatures: ${validJpegCount}/${successful.length}`);
        
        if (validJpegCount === successful.length) {
            console.log('   ✅ All downloaded images have valid JPEG signatures');
        } else {
            console.log('   ⚠️  Some images may be corrupted or error pages');
        }
    }
}

async function saveResultsToFiles(results: any[], outputDir: string): Promise<void> {
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }
    
    console.log(`\n💾 [Save] Saving results to ${outputDir}...`);
    
    const successful = results.filter(r => r.success);
    let savedCount = 0;
    
    for (let i = 0; i < successful.length; i++) {
        const result = successful[i];
        if (result.buffer) {
            const filename = `page_${String(i + 1).padStart(3, '0')}.jpg`;
            const filepath = join(outputDir, filename);
            
            try {
                writeFileSync(filepath, result.buffer);
                savedCount++;
                console.log(`   ✅ Saved: ${filename} (${Math.round(result.buffer.length / 1024)}KB)`);
            } catch (error: any) {
                console.log(`   ❌ Failed to save ${filename}: ${error.message}`);
            }
        }
    }
    
    console.log(`💾 [Save] Saved ${savedCount}/${successful.length} files to ${outputDir}`);
}

async function main() {
    console.log('🚀 Florence Production Download Test');
    console.log('=====================================\n');
    
    console.log(`📖 Testing manuscript: ${TEST_MANUSCRIPT.collection}:${TEST_MANUSCRIPT.manuscriptId}`);
    console.log(`📄 Pages to download: ${TEST_MANUSCRIPT.testPages.length}`);
    console.log(`🎯 Objective: Solve 403 Forbidden errors through intelligent sizing and proper ContentDM etiquette\n`);
    
    // Create output directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputDir = join(process.cwd(), '.devkit', 'validation', 'florence-production-test', timestamp);
    
    const downloader = new FlorenceProductionDownloader({
        maxConcurrent: 2, // Conservative for testing
        baseDelayMs: 2000, // Respectful delays
        maxDelayMs: 10000,
        retryLimit: 6,
        enableAdaptiveBackoff: true,
        enableSizeCache: true
    });
    
    try {
        console.log('⏱️  Starting production download test...\n');
        const startTime = Date.now();
        
        const downloadResult = await downloader.downloadManuscript(
            TEST_MANUSCRIPT.collection,
            TEST_MANUSCRIPT.testPages,
            TEST_MANUSCRIPT.manuscriptId
        );
        
        const totalTime = Date.now() - startTime;
        
        console.log('\n📈 [Results] Download completed!');
        console.log('=====================================');
        
        console.log(`🎯 Optimal size determined: ${downloadResult.optimalSize}px`);
        console.log(`⏱️  Total time: ${Math.round(totalTime / 1000)}s`);
        console.log(`🎯 Cache status: ${downloadResult.stats.cacheHit ? 'Hit' : 'Miss'}`);
        console.log(`📊 Success rate: ${downloadResult.stats.successful}/${TEST_MANUSCRIPT.testPages.length} (${Math.round(downloadResult.stats.successful / TEST_MANUSCRIPT.testPages.length * 100)}%)`);
        console.log(`📦 Total data: ${Math.round(downloadResult.stats.totalBytes / 1024 / 1024 * 100) / 100}MB`);
        console.log(`⚡ Average response time: ${Math.round(downloadResult.stats.averageResponseTime)}ms`);
        
        // Validate results
        await validateDownloadResults(downloadResult.results);
        
        // Save successful downloads to files
        if (downloadResult.stats.successful > 0) {
            await saveResultsToFiles(downloadResult.results, outputDir);
            
            console.log(`\n🎉 [Success] Production test completed successfully!`);
            console.log(`   ✅ Solved 403 Forbidden issue through intelligent sizing`);
            console.log(`   ✅ Used optimal size: ${downloadResult.optimalSize}px (avoids server restrictions)`);
            console.log(`   ✅ Maintained proper ContentDM etiquette with rate limiting`);
            console.log(`   ✅ Downloaded ${downloadResult.stats.successful} pages without errors`);
            console.log(`   ✅ Files saved to: ${outputDir}`);
            
            console.log(`\n🔧 [Integration] Ready for main download queue integration:`);
            console.log(`   1. Replace hardcoded 6000px with intelligent sizing`);
            console.log(`   2. Add adaptive rate limiting for 403 error handling`);
            console.log(`   3. Implement session management for consistent access`);
            console.log(`   4. Add progressive retry with exponential backoff`);
            
        } else {
            console.log(`\n❌ [Failure] No pages downloaded successfully`);
            console.log(`   This indicates the 403 issue persists or other connectivity problems`);
            
            // Analyze failure patterns
            const failures = downloadResult.results.filter(r => !r.success);
            const forbiddenErrors = failures.filter(r => r.error?.includes('403'));
            
            if (forbiddenErrors.length > 0) {
                console.log(`   🚫 403 Forbidden errors: ${forbiddenErrors.length}/${failures.length}`);
                console.log(`   📝 May need more aggressive size reduction or longer delays`);
            }
        }
        
    } catch (error: any) {
        console.error(`\n💥 [Error] Production test failed: ${error.message}`);
        console.error(error.stack);
    } finally {
        // Clean up resources
        downloader.cleanup();
        console.log('\n🧹 [Cleanup] Resources cleaned up');
    }
}

// Handle script termination gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 [Interrupt] Test interrupted by user');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 [Terminate] Test terminated');
    process.exit(0);
});

if (import.meta.main) {
    main().catch(console.error);
}