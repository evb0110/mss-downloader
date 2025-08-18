#!/usr/bin/env bun

/**
 * COMPREHENSIVE ROME TEST - Real App Components
 * Tests the actual Rome implementation using real app components
 * to verify if the 1-page bug still exists in the latest code
 */

import { EnhancedManuscriptDownloaderService } from '../../src/main/services/EnhancedManuscriptDownloaderService';
import { LibraryOptimizationService } from '../../src/main/services/LibraryOptimizationService';
import { ManifestCache } from '../../src/main/services/ManifestCache';
import { RomeLoader } from '../../src/main/services/library-loaders/RomeLoader';
import { InMemoryLogger } from '../../src/main/services/InMemoryLogger';

async function testRomeWithRealComponents() {
    console.log('🧪 COMPREHENSIVE ROME TEST - Real App Components');
    console.log('=================================================');
    
    // Initialize real app components
    const logger = new InMemoryLogger();
    const manifestCache = new ManifestCache();
    const downloader = new EnhancedManuscriptDownloaderService(logger, manifestCache);
    
    const deps = {
        fetchDirect: (url: string, options: any) => downloader.fetchDirect(url, options),
        manifestCache: manifestCache
    };
    
    const romeLoader = new RomeLoader(deps);
    
    console.log('\n📋 Testing Configuration:');
    
    // Check current Rome optimization settings
    const romeConfig = (LibraryOptimizationService as any).optimizationConfig.rome;
    console.log('Current Rome LibraryOptimizationService settings:');
    console.log(`   - maxConcurrentDownloads: ${romeConfig.maxConcurrentDownloads}`);
    console.log(`   - timeoutMultiplier: ${romeConfig.timeoutMultiplier}`);
    console.log(`   - enableProgressiveBackoff: ${romeConfig.enableProgressiveBackoff}`);
    console.log(`   - description: ${romeConfig.optimizationDescription}`);
    
    // Calculate actual timeout 
    const baseTimeout = 30000; // Default base timeout
    const actualTimeout = LibraryOptimizationService.getTimeoutForLibrary(baseTimeout, 'rome', 1);
    console.log(`\nCalculated timeout: ${baseTimeout}ms × ${romeConfig.timeoutMultiplier} = ${actualTimeout}ms`);
    
    // Test URL - using the same one from our successful simulation
    const testUrl = 'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1';
    
    console.log(`\n🎯 Testing Rome URL: ${testUrl}`);
    
    try {
        console.log('\n⏱️ Starting manifest loading (this should complete in ~30-60 seconds)...');
        const startTime = Date.now();
        
        const manifest = await romeLoader.loadManifest(testUrl);
        
        const elapsed = Date.now() - startTime;
        
        console.log(`\n✅ SUCCESS! Manifest loaded in ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`);
        console.log('\n📊 Results:');
        console.log(`   - Library: ${manifest.library}`);
        console.log(`   - Display Name: ${manifest.displayName}`);
        console.log(`   - Total Pages: ${manifest.totalPages}`);
        console.log(`   - Page Links Count: ${manifest.pageLinks.length}`);
        console.log(`   - Original URL: ${manifest.originalUrl}`);
        
        // Verify a few page URLs
        console.log('\n🔍 Sample page URLs:');
        console.log(`   - Page 1: ${manifest.pageLinks[0]}`);
        if (manifest.pageLinks[1]) {
            console.log(`   - Page 2: ${manifest.pageLinks[1]}`);
        }
        if (manifest.pageLinks[4]) {
            console.log(`   - Page 5: ${manifest.pageLinks[4]}`);
        }
        
        // Quick validation of a few pages
        console.log('\n🧪 Validating sample pages...');
        const testPages = [1, 5, Math.min(10, manifest.totalPages)];
        
        for (const pageNum of testPages) {
            if (pageNum <= manifest.totalPages) {
                const pageUrl = manifest.pageLinks[pageNum - 1];
                try {
                    const response = await deps.fetchDirect(pageUrl, { method: 'HEAD' });
                    const contentType = response.headers.get('content-type');
                    const status = response.status;
                    
                    if (response.ok && contentType && contentType.includes('image')) {
                        console.log(`   ✅ Page ${pageNum}: Valid (${status}, ${contentType})`);
                    } else {
                        console.log(`   ❌ Page ${pageNum}: Invalid (${status}, ${contentType || 'no type'})`);
                    }
                } catch (error) {
                    console.log(`   ❌ Page ${pageNum}: Error - ${(error as Error).message}`);
                }
            }
        }
        
        // Diagnostic information
        console.log('\n📈 Performance Analysis:');
        if (elapsed < 10000) {
            console.log(`   🚀 EXCELLENT: Loaded in ${(elapsed / 1000).toFixed(1)}s (under 10s)`);
        } else if (elapsed < 30000) {
            console.log(`   ✅ GOOD: Loaded in ${(elapsed / 1000).toFixed(1)}s (under 30s)`);
        } else if (elapsed < 60000) {
            console.log(`   ⚠️ ACCEPTABLE: Loaded in ${(elapsed / 1000).toFixed(1)}s (under 60s)`);
        } else {
            console.log(`   ❌ SLOW: Loaded in ${(elapsed / 1000).toFixed(1)}s (over 60s)`);
        }
        
        // Final verdict
        console.log('\n🎯 FINAL VERDICT:');
        if (manifest.totalPages === 1) {
            console.log('   ❌ BUG REPRODUCED: Only 1 page detected!');
            console.log('   🔧 The 1-page bug is still present in the current code.');
        } else if (manifest.totalPages > 1 && manifest.totalPages < 50) {
            console.log(`   ⚠️ UNDERESTIMATION: Only ${manifest.totalPages} pages detected`);
            console.log('   🔧 Page discovery may be stopping too early.');
        } else if (manifest.totalPages >= 50) {
            console.log(`   ✅ SUCCESS: ${manifest.totalPages} pages detected`);
            console.log('   🎉 Rome page discovery is working correctly!');
        }
        
        return manifest;
        
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.log(`\n❌ FAILED after ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`);
        console.log(`Error: ${(error as Error).message}`);
        
        // Check if it's a timeout error
        if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('aborted'))) {
            console.log('\n🔧 TIMEOUT ANALYSIS:');
            console.log(`   - Configured timeout: ${actualTimeout}ms`);
            console.log(`   - Actual time elapsed: ${elapsed}ms`);
            if (elapsed >= actualTimeout * 0.9) {
                console.log('   ❌ Request timed out due to timeout configuration');
                console.log(`   💡 Try increasing Rome timeoutMultiplier above ${romeConfig.timeoutMultiplier}`);
            } else {
                console.log('   ❌ Request failed before timeout (network/server issue)');
            }
        }
        
        throw error;
    }
}

// Also test cache behavior
async function testCacheInteraction() {
    console.log('\n\n🗄️ CACHE INTERACTION TEST');
    console.log('=========================');
    
    const manifestCache = new ManifestCache();
    const testUrl = 'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1';
    
    // Check if there's cached data for this URL
    console.log('Checking for cached Rome data...');
    
    try {
        const cachedData = await manifestCache.get(testUrl);
        
        if (cachedData) {
            console.log(`✅ Found cached data: ${cachedData.totalPages} pages`);
            console.log('📝 This could explain why user sees outdated results');
            
            // Clear the cache for this URL
            console.log('🧹 Clearing cache for this URL...');
            await manifestCache.remove(testUrl);
            console.log('✅ Cache cleared');
            
        } else {
            console.log('❌ No cached data found');
        }
    } catch (error) {
        console.log(`❌ Cache check failed: ${(error as Error).message}`);
    }
}

async function runComprehensiveTest() {
    try {
        await testCacheInteraction();
        await testRomeWithRealComponents();
        
        console.log('\n\n🎉 COMPREHENSIVE TEST COMPLETE');
        console.log('=====================================');
        console.log('✅ Rome implementation has been thoroughly tested with real app components.');
        console.log('📊 Results above show current status of Rome page discovery.');
        
    } catch (error) {
        console.log('\n\n❌ COMPREHENSIVE TEST FAILED');
        console.log('============================');
        console.log(`Error: ${(error as Error).message}`);
        console.log('🔧 Investigation needed to resolve Rome issues.');
    }
}

runComprehensiveTest();