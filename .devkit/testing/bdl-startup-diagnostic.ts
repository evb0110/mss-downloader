#!/usr/bin/env bun

/**
 * BDL Startup Diagnostic - Check Queue Configuration
 */

console.log('🔍 BDL Startup Diagnostic\n');

// Check if the problem is in queue configuration
const mockQueueState = {
    isProcessing: false,
    isPaused: false,
    activeItemIds: [],
    globalSettings: {
        autoStart: false,
        concurrentDownloads: 3,
        pauseBetweenItems: 0,
        simultaneousMode: 'sequential' as any,
        maxSimultaneousDownloads: 3,  // This should be 3 by default
        autoSplitThresholdMB: 300
    }
};

console.log('📊 Default Queue Configuration:');
console.log('  maxSimultaneousDownloads:', mockQueueState.globalSettings.maxSimultaneousDownloads);
console.log('  isProcessing:', mockQueueState.isProcessing);
console.log('  isPaused:', mockQueueState.isPaused);
console.log('  autoStart:', mockQueueState.globalSettings.autoStart);

// Test the blocking conditions
const mockActiveDownloaders = new Map(); // Empty = 0 active
const activeCount = mockActiveDownloaders.size;
const maxAllowed = mockQueueState.globalSettings.maxSimultaneousDownloads;

console.log('\n🚦 Download Start Conditions:');
console.log('  activeCount:', activeCount);
console.log('  maxAllowed:', maxAllowed);
console.log('  Can start downloads?', activeCount < maxAllowed ? '✅ YES' : '❌ NO');

// Test BDL item status
const mockBdlItems = [
    { id: 'bdl-1', status: 'pending', library: 'bdl', displayName: 'BDL_3903_Part_1' },
    { id: 'bdl-2', status: 'pending', library: 'bdl', displayName: 'BDL_3903_Part_2' },
    { id: 'bdl-3', status: 'pending', library: 'bdl', displayName: 'BDL_3903_Part_3' }
];

const eligibleItems = mockBdlItems.filter(item => 
    item.status === 'pending' || item.status === 'loading'
);

console.log('\n📋 Mock BDL Items:');
mockBdlItems.forEach(item => {
    console.log(`  ${item.displayName}: ${item.status}`);
});
console.log('  Eligible for download:', eligibleItems.length, 'items');

// Test the exact condition from startItem method
console.log('\n🎯 StartItem Condition Test:');
mockBdlItems.forEach(item => {
    const statusOk = (item.status !== 'pending' && item.status !== 'loading' && item.status !== 'paused');
    const canStart = !statusOk; // Inverted because the condition checks for NOT allowed
    console.log(`  ${item.displayName}: status="${item.status}" → can start? ${canStart ? '✅' : '❌'}`);
});

console.log('\n🔍 Potential Issues to Check:');
console.log('1. Are BDL items actually in "pending" status when user clicks START?');
console.log('2. Is maxSimultaneousDownloads somehow getting set to 0?');
console.log('3. Is the activeDownloaders.size check blocking due to phantom active downloads?');
console.log('4. Is there a race condition in the startup sequence?');

console.log('\n💡 Next Steps:');
console.log('1. Add console.log to startItem method to see actual values');
console.log('2. Check if BDL items are properly initialized as "pending"');
console.log('3. Verify maxSimultaneousDownloads in actual app state');