#!/usr/bin/env bun

/**
 * ROME DEBUG - Current Issue Analysis
 * Focus on understanding why user reports "only 1 page" 
 */

import { LibraryOptimizationService } from '../../src/main/services/LibraryOptimizationService';

async function debugRomeTimeout() {
    console.log('🔧 ROME TIMEOUT ANALYSIS');
    console.log('=========================');
    
    // Test timeout calculation for Rome
    const baseTimeout = 30000; // Default 30 seconds
    const romeTimeout1 = LibraryOptimizationService.getTimeoutForLibrary(baseTimeout, 'rome', 1);
    const romeTimeout2 = LibraryOptimizationService.getTimeoutForLibrary(baseTimeout, 'rome', 2);
    
    console.log(`Base timeout: ${baseTimeout}ms (${baseTimeout/1000}s)`);
    console.log(`Rome timeout (attempt 1): ${romeTimeout1}ms (${romeTimeout1/1000}s)`);
    console.log(`Rome timeout (attempt 2): ${romeTimeout2}ms (${romeTimeout2/1000}s)`);
    
    // Check if timeout is reasonable
    if (romeTimeout1 <= 5000) {
        console.log('⚠️  Very short timeout - requests might fail before completing');
    } else if (romeTimeout1 <= 15000) {
        console.log('✅ Short timeout - should work for fast servers');
    } else if (romeTimeout1 <= 30000) {
        console.log('✅ Normal timeout - standard configuration'); 
    } else {
        console.log('⚠️  Long timeout - will make app feel slow');
    }
}

async function testSinglePageCheck() {
    console.log('\n\n🧪 SINGLE PAGE CHECK TEST');
    console.log('==========================');
    console.log('Testing if we can detect page 1 and page 2 correctly\n');
    
    const manuscriptId = 'BNCR_Ms_SESS_0062';
    const collectionType = 'manoscrittoantico';
    
    // Test page 1
    console.log('Testing page 1...');
    const page1Url = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/1/original`;
    
    try {
        const response1 = await fetch(page1Url, { method: 'HEAD' });
        const contentType1 = response1.headers.get('content-type');
        console.log(`Page 1: Status ${response1.status}, Type: ${contentType1}`);
        
        const page1Valid = response1.ok && contentType1 && contentType1.includes('image');
        console.log(`Page 1 valid: ${page1Valid ? '✅ YES' : '❌ NO'}`);
        
        if (!page1Valid) {
            console.log('❌ CRITICAL: Page 1 is not valid - this would cause 1-page bug!');
            if (contentType1 && contentType1.includes('text/html')) {
                console.log('   - Page 1 returns HTML instead of image');
            }
            if (!response1.ok) {
                console.log(`   - Page 1 returns status ${response1.status} instead of 200`);
            }
        }
        
    } catch (error) {
        console.log(`Page 1 ERROR: ${(error as Error).message}`);
        console.log('❌ CRITICAL: Page 1 request failed - this would cause 1-page bug!');
    }
    
    // Test page 2  
    console.log('\nTesting page 2...');
    const page2Url = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/2/original`;
    
    try {
        const response2 = await fetch(page2Url, { method: 'HEAD' });
        const contentType2 = response2.headers.get('content-type');
        console.log(`Page 2: Status ${response2.status}, Type: ${contentType2}`);
        
        const page2Valid = response2.ok && contentType2 && contentType2.includes('image');
        console.log(`Page 2 valid: ${page2Valid ? '✅ YES' : '❌ NO'}`);
        
        if (!page2Valid && contentType2 && contentType2.includes('text/html')) {
            console.log('   - Page 2 returns HTML (phantom page)');
        }
        
    } catch (error) {
        console.log(`Page 2 ERROR: ${(error as Error).message}`);
    }
}

async function diagnoseUpperBoundSearch() {
    console.log('\n\n🔍 UPPER BOUND SEARCH DIAGNOSIS');
    console.log('================================');
    console.log('Simulating the exponential search that finds upper bound\n');
    
    const manuscriptId = 'BNCR_Ms_SESS_0062';
    const collectionType = 'manoscrittoantico';
    
    // Test the exponential search pattern: 1, 2, 4, 8, 16, 32...
    const testBounds = [1, 2, 4, 8, 16];
    
    for (const bound of testBounds) {
        console.log(`Testing upperBound candidate: ${bound}`);
        const pageUrl = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/${bound}/original`;
        
        try {
            const response = await fetch(pageUrl, { method: 'HEAD' });
            const contentType = response.headers.get('content-type');
            const isValid = response.ok && contentType && contentType.includes('image');
            
            console.log(`   Page ${bound}: ${isValid ? '✅ EXISTS' : '❌ NOT FOUND'} (${response.status}, ${contentType})`);
            
            if (!isValid) {
                console.log(`🎯 Upper bound found at page ${bound} - would search between ${Math.floor(bound/2)} and ${bound}`);
                
                // This is where the binary search would start
                const searchLow = Math.floor(bound / 2);
                const searchHigh = bound;
                
                console.log(`\n📊 Binary search would run: low=${searchLow}, high=${searchHigh}`);
                
                // If low=1 and high=2, and we already know page 2 doesn't exist,
                // then the result would be 1 page!
                if (searchLow === 1 && searchHigh === 2) {
                    console.log('🚨 PROBLEM IDENTIFIED: Binary search between 1 and 2 would return 1 page!');
                }
                
                break;
            }
            
        } catch (error) {
            console.log(`   Page ${bound}: ❌ ERROR - ${(error as Error).message}`);
            console.log(`🎯 Network error at page ${bound} - would be treated as upper bound`);
            break;
        }
        
        // Add small delay
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

async function runDiagnostic() {
    console.log('ROME DIAGNOSTIC - Current Issue Analysis');
    console.log('=========================================');
    console.log('Investigating why user reports "only 1 page"\n');
    
    try {
        await debugRomeTimeout();
        await testSinglePageCheck();
        await diagnoseUpperBoundSearch();
        
        console.log('\n\n🎯 DIAGNOSTIC SUMMARY');
        console.log('======================');
        console.log('✅ Completed diagnostic analysis of Rome page discovery.');
        console.log('📊 Check results above to identify the root cause.');
        
    } catch (error) {
        console.log('\n\n❌ DIAGNOSTIC FAILED');
        console.log('=====================');
        console.log(`Error: ${(error as Error).message}`);
    }
}

runDiagnostic();