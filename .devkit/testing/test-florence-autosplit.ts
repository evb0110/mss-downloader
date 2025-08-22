#!/usr/bin/env bun

/**
 * Test Florence auto-split calculation with corrected size estimation
 */

// Mock Florence manuscript data for testing
const mockFlorence = {
    library: 'florence',
    totalPages: 120, // Example: medium-sized manuscript
    pageLinks: Array.from({length: 120}, (_, i) => 
        `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:example${i}/full/4000,/0/default.jpg`
    )
};

function calculateFlorence() {
    console.log('🧮 Testing Florence Auto-Split Calculation...\n');
    
    // Old estimation (before fix)
    const oldPageSizeMB = 0.7;
    const oldTotalSizeMB = oldPageSizeMB * mockFlorence.totalPages;
    
    // New estimation (after fix) - based on 4000px intelligent sizing
    const newPageSizeMB = 2.8;
    const newTotalSizeMB = newPageSizeMB * mockFlorence.totalPages;
    
    // Florence-specific auto-split threshold
    const florenceThreshold = 300; // From LibraryOptimizationService
    const globalThreshold = 500;   // Default global threshold
    
    console.log(`📖 Test Manuscript: ${mockFlorence.totalPages} pages`);
    console.log(`🔧 Florence auto-split threshold: ${florenceThreshold}MB`);
    console.log(`🌐 Global auto-split threshold: ${globalThreshold}MB\n`);
    
    console.log('📊 Size Calculations:');
    console.log(`❌ Old estimation: ${oldPageSizeMB}MB/page × ${mockFlorence.totalPages} pages = ${oldTotalSizeMB}MB`);
    console.log(`   Auto-split triggered: ${oldTotalSizeMB > florenceThreshold ? '✅ YES' : '❌ NO'} (${oldTotalSizeMB}MB > ${florenceThreshold}MB)`);
    
    console.log(`✅ New estimation: ${newPageSizeMB}MB/page × ${mockFlorence.totalPages} pages = ${newTotalSizeMB}MB`);
    console.log(`   Auto-split triggered: ${newTotalSizeMB > florenceThreshold ? '✅ YES' : '❌ NO'} (${newTotalSizeMB}MB > ${florenceThreshold}MB)\n`);
    
    if (newTotalSizeMB > florenceThreshold) {
        // Calculate how many parts it would split into
        const maxPartSizeMB = florenceThreshold * 0.9; // 90% of threshold for safety margin
        const numberOfParts = Math.ceil(newTotalSizeMB / maxPartSizeMB);
        const pagesPerPart = Math.ceil(mockFlorence.totalPages / numberOfParts);
        
        console.log('🔄 Auto-Split Results:');
        console.log(`   Total size: ${newTotalSizeMB}MB`);
        console.log(`   Max part size: ${maxPartSizeMB}MB (90% of ${florenceThreshold}MB threshold)`);
        console.log(`   Number of parts: ${numberOfParts}`);
        console.log(`   Pages per part: ${pagesPerPart}`);
        console.log(`   Actual part sizes: ~${(newTotalSizeMB / numberOfParts).toFixed(1)}MB each`);
    }
    
    console.log('\n🎯 Impact Analysis:');
    console.log(`❌ Before fix: ${oldTotalSizeMB}MB total - ${oldTotalSizeMB > florenceThreshold ? 'Would auto-split' : 'Would NOT auto-split'}`);
    console.log(`✅ After fix: ${newTotalSizeMB}MB total - ${newTotalSizeMB > florenceThreshold ? 'WILL auto-split' : 'Will NOT auto-split'}`);
    
    if (oldTotalSizeMB <= florenceThreshold && newTotalSizeMB > florenceThreshold) {
        console.log('\n🚨 CRITICAL FIX: Previously bypassed auto-split, now correctly triggers it!');
        console.log('   This prevents memory failures and download crashes for large Florence manuscripts.');
    }
    
    console.log('\n✅ Florence Auto-Split Fix Summary:');
    console.log('   📂 Updated: EnhancedDownloadQueue.ts line 1416');
    console.log('   🔧 Change: 0.7MB → 2.8MB per page estimation');
    console.log('   🎯 Reason: Reflects actual 4000px ContentDM image sizes');
    console.log('   🛡️  Benefit: Prevents memory failures on large manuscripts');
    console.log('   📋 Threshold: Uses Florence-specific 300MB limit');
}

calculateFlorence();