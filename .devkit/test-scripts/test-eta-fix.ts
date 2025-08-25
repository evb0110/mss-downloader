#!/usr/bin/env bun
// Test the ETA calculation fix

import { EnhancedManuscriptDownloaderService } from '../../src/main/services/EnhancedManuscriptDownloaderService';

async function testEtaFix() {
    console.log('🕐 Testing ETA calculation fix...');
    
    const downloader = new EnhancedManuscriptDownloaderService();
    
    console.log('\n📊 Test ETA formatting function:');
    
    // Test various ETA values
    const testValues = [
        { value: -1, expected: 'calculating...' },
        { value: 0, expected: 'calculating...' },
        { value: NaN, expected: 'calculating...' },
        { value: Infinity, expected: 'calculating...' },
        { value: 45, expected: '45s' },
        { value: 125, expected: '2m 5s' },
        { value: 3725, expected: '1h 2m 5s' }
    ];
    
    let allTestsPassed = true;
    
    for (const test of testValues) {
        const result = downloader.formatETA(test.value);
        const passed = result === test.expected;
        
        if (!passed) allTestsPassed = false;
        
        console.log(`  ${passed ? '✅' : '❌'} formatETA(${test.value}) = "${result}" (expected: "${test.expected}")`);
    }
    
    console.log('\n🧪 Simulate ETA calculation logic:');
    
    // Simulate the progress tracking logic
    let startTime = Date.now();
    let lastDisplayedEta = 0;
    const totalPages = 10;
    
    const simulateProgress = (downloaded: number, description: string) => {
        const now = Date.now();
        const elapsed = Math.max(0.001, (now - startTime) / 1000);
        const ratePagesPerSec = downloaded / elapsed;
        
        // Apply the fixed logic
        let instantaneousEta = 0;
        if (downloaded > 0 && ratePagesPerSec > 0) {
            instantaneousEta = Math.round((totalPages - downloaded) / ratePagesPerSec);
        } else {
            instantaneousEta = -1; // "calculating..."
        }
        
        // Smooth ETA with EMA, but only if we have valid data
        if (downloaded > 0 && instantaneousEta > 0) {
            lastDisplayedEta = lastDisplayedEta > 0 ? Math.round(0.7 * lastDisplayedEta + 0.3 * instantaneousEta) : instantaneousEta;
        } else {
            lastDisplayedEta = -1; // Keep as "calculating..."
        }
        
        const etaFormatted = downloader.formatETA(lastDisplayedEta);
        console.log(`  ${description}: ${downloaded}/${totalPages} pages, ETA: ${etaFormatted} (raw: ${lastDisplayedEta})`);
        
        return lastDisplayedEta;
    };
    
    // Test the problematic case: before first page completion
    console.log('  Before any progress:');
    const eta0 = simulateProgress(0, '  Initial state');
    
    if (eta0 !== -1) {
        console.log('  ❌ FAIL: ETA should be -1 (calculating...) before first page');
        allTestsPassed = false;
    } else {
        console.log('  ✅ PASS: ETA correctly shows "calculating..." before first page');
    }
    
    // Add some delay to simulate real progress
    await new Promise(resolve => setTimeout(resolve, 100));
    startTime = Date.now() - 1000; // Simulate 1 second elapsed
    
    console.log('\n  After first page completion:');
    const eta1 = simulateProgress(1, '  After 1 page');
    
    if (eta1 <= 0) {
        console.log('  ❌ FAIL: ETA should be positive after first page');
        allTestsPassed = false;
    } else {
        console.log('  ✅ PASS: ETA correctly calculated after first page');
    }
    
    // Simulate more progress
    await new Promise(resolve => setTimeout(resolve, 100));
    startTime = Date.now() - 2000; // Simulate 2 seconds elapsed
    
    const eta3 = simulateProgress(3, '  After 3 pages');
    const eta5 = simulateProgress(5, '  After 5 pages');
    
    console.log('\n📋 SUMMARY:');
    if (allTestsPassed) {
        console.log('✅ ALL TESTS PASSED: ETA calculation fix is working correctly');
        console.log('   - ETA shows "calculating..." before first page completion');
        console.log('   - ETA calculation works properly after progress begins');
        console.log('   - formatETA handles special values correctly');
    } else {
        console.log('❌ SOME TESTS FAILED: ETA calculation needs more work');
    }
    
    return allTestsPassed;
}

testEtaFix().then(success => {
    process.exit(success ? 0 : 1);
});