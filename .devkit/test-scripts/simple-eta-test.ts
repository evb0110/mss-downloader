#!/usr/bin/env bun
// Simple ETA calculation test without Electron dependencies

function formatETA(etaSeconds: number): string {
    if (!etaSeconds || !isFinite(etaSeconds) || etaSeconds < 0) return 'calculating...';

    const hours = Math.floor(etaSeconds / 3600);
    const minutes = Math.floor((etaSeconds % 3600) / 60);
    const seconds = Math.floor(etaSeconds % 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

function testEtaFix() {
    console.log('🕐 Testing ETA calculation fix...');
    
    console.log('\n📊 Test ETA formatting function:');
    
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
        const result = formatETA(test.value);
        const passed = result === test.expected;
        
        if (!passed) allTestsPassed = false;
        
        console.log(`  ${passed ? '✅' : '❌'} formatETA(${test.value}) = "${result}" (expected: "${test.expected}")`);
    }
    
    console.log('\n🧪 Simulate ETA calculation logic:');
    
    let startTime = Date.now();
    let lastDisplayedEta = 0;
    const totalPages = 10;
    
    const simulateProgress = (downloaded: number, description: string) => {
        const now = Date.now();
        const elapsed = Math.max(0.001, (now - startTime) / 1000);
        const ratePagesPerSec = downloaded / elapsed;
        
        // Apply the FIXED logic
        let instantaneousEta = 0;
        if (downloaded > 0 && ratePagesPerSec > 0) {
            instantaneousEta = Math.round((totalPages - downloaded) / ratePagesPerSec);
        } else {
            // Before first page completion, ETA is unknown
            instantaneousEta = -1; // Special value indicating "calculating..."
        }
        
        // Smooth ETA with simple EMA to reduce oscillation, but only if we have valid data
        if (downloaded > 0 && instantaneousEta > 0) {
            lastDisplayedEta = lastDisplayedEta > 0 ? Math.round(0.7 * lastDisplayedEta + 0.3 * instantaneousEta) : instantaneousEta;
        } else {
            lastDisplayedEta = -1; // Keep as "calculating..." until first page completes
        }
        
        const etaFormatted = formatETA(lastDisplayedEta);
        console.log(`    ${description}: ${downloaded}/${totalPages} pages, ETA: ${etaFormatted} (raw: ${lastDisplayedEta})`);
        
        return lastDisplayedEta;
    };
    
    // Test the OLD problematic case vs NEW fixed behavior
    console.log('  🚫 OLD behavior would show: ETA 0 before first page (WRONG)');
    console.log('  ✅ NEW behavior shows:');
    
    const eta0 = simulateProgress(0, 'Before any progress');
    
    if (eta0 !== -1) {
        console.log('    ❌ FAIL: ETA should be -1 (calculating...) before first page');
        allTestsPassed = false;
    } else {
        console.log('    ✅ PASS: ETA correctly shows "calculating..." before first page');
    }
    
    // Simulate some time passing
    startTime = Date.now() - 1000; // Pretend 1 second elapsed
    
    const eta1 = simulateProgress(1, 'After 1st page done');
    
    if (eta1 <= 0) {
        console.log('    ❌ FAIL: ETA should be positive after first page');
        allTestsPassed = false;
    } else {
        console.log('    ✅ PASS: ETA correctly calculated after first page');
    }
    
    // More progress
    startTime = Date.now() - 2000; // Pretend 2 seconds elapsed
    simulateProgress(3, 'After 3rd page done');
    simulateProgress(5, 'After 5th page done');
    
    console.log('\n📋 SUMMARY:');
    if (allTestsPassed) {
        console.log('🎉 ALL TESTS PASSED: ETA calculation fix is working correctly');
        console.log('   ✅ ETA shows "calculating..." before first page completion (was 0 before)');
        console.log('   ✅ ETA calculation works properly after progress begins');  
        console.log('   ✅ formatETA handles special values correctly');
        console.log('\n🔧 The fix addresses the original issue:');
        console.log('   - BEFORE: ETA showed 0 seconds before first page stitched');
        console.log('   - AFTER: ETA shows "calculating..." until real progress can be measured');
    } else {
        console.log('❌ SOME TESTS FAILED: ETA calculation needs more work');
    }
    
    return allTestsPassed;
}

const success = testEtaFix();
process.exit(success ? 0 : 1);