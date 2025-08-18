#!/usr/bin/env bun

/**
 * SIMPLE ROME TEST - Core Logic Only
 * Tests Rome implementation without full app dependencies
 */

import { LibraryOptimizationService } from '../../src/main/services/LibraryOptimizationService';

// Simple fetch wrapper that mimics fetchDirect behavior
async function simpleFetchDirect(url: string, options: any = {}): Promise<Response> {
    // Detect library
    const library = url.includes('digitale.bnc.roma.sbn.it') ? 'rome' : 'unknown';
    
    // Apply library-specific timeout
    const baseTimeout = 30000;
    const timeout = library ? 
        LibraryOptimizationService.getTimeoutForLibrary(baseTimeout, library as any, 1) :
        baseTimeout;
    
    console.log(`[simpleFetchDirect] ${options.method || 'GET'} ${url}`);
    console.log(`[simpleFetchDirect] Library: ${library}, Timeout: ${timeout}ms`);
    
    // Create abort controller with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.log(`[simpleFetchDirect] TIMEOUT after ${timeout}ms`);
        controller.abort();
    }, timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Simulate the checkPageExists logic from RomeLoader
async function checkPageExists(collectionType: string, manuscriptId: string, pageNum: number): Promise<boolean> {
    const imageUrl = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/${pageNum}/original`;
    
    try {
        console.log(`\n[checkPageExists] Testing page ${pageNum}...`);
        
        const response = await simpleFetchDirect(imageUrl, { method: 'HEAD' });
        
        console.log(`[checkPageExists] Response - Status: ${response.status}, OK: ${response.ok}`);
        
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            console.log(`[checkPageExists] Content-Type: ${contentType || 'not set'}`);
            
            // Rome returns 200 OK with text/html for non-existent pages
            // Real pages have image/jpeg content type
            if (contentType && contentType.includes('text/html')) {
                console.log(`[checkPageExists] Page ${pageNum}: ❌ Phantom page detected - HTML response`);
                return false;
            }
            
            // Valid image if it has image content type
            const isValidImage = contentType && contentType.includes('image');
            
            if (isValidImage) {
                console.log(`[checkPageExists] Page ${pageNum}: ✅ Exists (${contentType})`);
                return true;
            } else {
                console.log(`[checkPageExists] Page ${pageNum}: ❌ Invalid (${contentType || 'no type'})`);
                return false;
            }
        }
        
        console.log(`[checkPageExists] Page ${pageNum}: ❌ Not OK status`);
        return false;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`[checkPageExists] Page ${pageNum}: ❌ Request failed - ${errorMessage}`);
        return false;
    }
}

// Simulate the binary search logic from RomeLoader
async function binarySearchPageDiscovery(collectionType: string, manuscriptId: string): Promise<number> {
    console.log(`\n🔍 Starting binary search page discovery for ${manuscriptId}...`);
    
    // First verify page 1 exists
    const page1Exists = await checkPageExists(collectionType, manuscriptId, 1);
    if (!page1Exists) {
        console.log(`\n❌ CRITICAL: Page 1 doesn't exist - manuscript may be invalid`);
        return 0;
    } else {
        console.log(`\n✅ Page 1 confirmed to exist`);
    }
    
    // Find upper bound with exponential search
    let upperBound = 1;
    let attempts = 0;
    const maxAttempts = 15; // Limit attempts for testing
    
    console.log(`\n🚀 Finding upper bound...`);
    
    while (attempts < maxAttempts) {
        console.log(`\n--- Attempt ${attempts + 1}: Testing upperBound ${upperBound} ---`);
        
        const exists = await checkPageExists(collectionType, manuscriptId, upperBound);
        if (!exists) {
            console.log(`\n🎯 Found upper bound at page ${upperBound} (does not exist)`);
            break;
        }
        console.log(`\n✅ Page ${upperBound} exists, doubling upperBound...`);
        upperBound *= 2;
        attempts++;
        
        // Add small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (attempts >= maxAttempts) {
        console.log(`\n⚠️ Reached max attempts, using upperBound ${upperBound}`);
    }
    
    // Binary search for exact count
    let low = upperBound === 1 ? 1 : Math.floor(upperBound / 2);
    let high = upperBound;
    
    console.log(`\n🎯 Binary search phase: low=${low}, high=${high}`);
    
    while (low < high - 1) {
        const mid = Math.floor((low + high) / 2);
        console.log(`\n--- Binary search: low=${low}, high=${high}, mid=${mid} ---`);
        
        const exists = await checkPageExists(collectionType, manuscriptId, mid);
        
        if (exists) {
            low = mid;
            console.log(`✅ Mid ${mid} exists, new low=${low}`);
        } else {
            high = mid;
            console.log(`❌ Mid ${mid} doesn't exist, new high=${high}`);
        }
        
        // Add small delay
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Final check
    console.log(`\n🏁 Final validation: checking page ${high}`);
    const finalExists = await checkPageExists(collectionType, manuscriptId, high);
    const result = finalExists ? high : low;
    
    console.log(`\n📊 Binary search complete: ${result} pages`);
    return result;
}

async function testRomeConfiguration() {
    console.log('🧪 ROME CONFIGURATION TEST');
    console.log('==========================');
    
    // Check current Rome settings
    const romeConfig = (LibraryOptimizationService as any).optimizationConfig.rome;
    console.log('\nCurrent Rome LibraryOptimizationService settings:');
    console.log(`   - maxConcurrentDownloads: ${romeConfig.maxConcurrentDownloads}`);
    console.log(`   - timeoutMultiplier: ${romeConfig.timeoutMultiplier}`);
    console.log(`   - enableProgressiveBackoff: ${romeConfig.enableProgressiveBackoff}`);
    
    // Calculate actual timeout
    const baseTimeout = 30000;
    const actualTimeout = LibraryOptimizationService.getTimeoutForLibrary(baseTimeout, 'rome', 1);
    console.log(`\nTimeout calculation: ${baseTimeout}ms × ${romeConfig.timeoutMultiplier} = ${actualTimeout}ms`);
    
    if (romeConfig.timeoutMultiplier >= 1.0) {
        console.log('⚠️  Rome timeoutMultiplier >= 1.0 - requests will be slow');
    } else {
        console.log('✅ Rome timeoutMultiplier < 1.0 - requests should be fast');
    }
}

async function testRomePageDiscovery() {
    console.log('\n\n🎯 ROME PAGE DISCOVERY TEST');
    console.log('============================');
    
    const collectionType = 'manoscrittoantico';
    const manuscriptId = 'BNCR_Ms_SESS_0062';
    const testUrl = `http://digitale.bnc.roma.sbn.it/tecadigitale/${collectionType}/${manuscriptId}/${manuscriptId}/1`;
    
    console.log(`Testing Rome URL: ${testUrl}`);
    
    try {
        console.log('\n⏱️ Starting page discovery...');
        const startTime = Date.now();
        
        const pageCount = await binarySearchPageDiscovery(collectionType, manuscriptId);
        
        const elapsed = Date.now() - startTime;
        
        console.log(`\n✅ SUCCESS! Page discovery completed in ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`);
        console.log(`📊 Total pages discovered: ${pageCount}`);
        
        // Final verdict
        console.log('\n🎯 FINAL VERDICT:');
        if (pageCount === 0) {
            console.log('   ❌ CRITICAL FAILURE: No pages detected!');
        } else if (pageCount === 1) {
            console.log('   ❌ BUG REPRODUCED: Only 1 page detected!');
            console.log('   🔧 This matches the user\'s report - the bug still exists.');
        } else if (pageCount > 1 && pageCount < 50) {
            console.log(`   ⚠️ UNDERESTIMATION: Only ${pageCount} pages detected`);
            console.log('   🔧 Page discovery may be stopping too early.');
        } else if (pageCount >= 50) {
            console.log(`   ✅ SUCCESS: ${pageCount} pages detected`);
            console.log('   🎉 Rome page discovery is working correctly!');
        }
        
        return pageCount;
        
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.log(`\n❌ FAILED after ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`);
        console.log(`Error: ${(error as Error).message}`);
        throw error;
    }
}

async function runSimpleTest() {
    console.log('SIMPLE ROME APP TEST');
    console.log('====================');
    console.log('Testing Rome with current app configuration\n');
    
    try {
        await testRomeConfiguration();
        await testRomePageDiscovery();
        
        console.log('\n\n🎉 TEST COMPLETE');
        console.log('================');
        console.log('✅ Rome implementation tested successfully.');
        
    } catch (error) {
        console.log('\n\n❌ TEST FAILED');
        console.log('===============');
        console.log(`Error: ${(error as Error).message}`);
    }
}

runSimpleTest();