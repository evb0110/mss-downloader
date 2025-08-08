#!/usr/bin/env node

/**
 * Test Vatican Library Auto-Split Behavior
 * Issue #21: Custom page ranges failing with "library2" error
 */

const { SharedManifestLoaders } = require('../../../../src/shared/SharedManifestLoaders.js');

console.log('🔬 TESTING VATICAN AUTO-SPLIT BEHAVIOR');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

async function testAutoSplitScenario() {
    const url = 'https://digi.vatlib.it/view/MSS_Pal.lat.515';
    
    console.log('Configuration:');
    console.log(`  URL: ${url}`);
    console.log(`  Testing: Auto-split with custom range 162-322`);
    console.log('');
    
    const loaders = new SharedManifestLoaders();
    
    try {
        // First, load the full manifest
        console.log('Step 1: Loading full manifest...');
        const manifest = await loaders.getManifestForLibrary('vatican', url);
        console.log(`  ✅ Loaded ${manifest.images.length} pages`);
        
        // Simulate what would happen during auto-split
        console.log('\nStep 2: Simulating auto-split...');
        
        // Part 1: pages 1-161
        const part1Range = { start: 1, end: 161 };
        const part1Images = manifest.images.slice(part1Range.start - 1, part1Range.end);
        console.log(`  Part 1: pages ${part1Range.start}-${part1Range.end} (${part1Images.length} pages)`);
        
        // Part 2: pages 162-322 (user's desired range)
        const part2Range = { start: 162, end: 322 };
        const part2Images = manifest.images.slice(part2Range.start - 1, part2Range.end);
        console.log(`  Part 2: pages ${part2Range.start}-${part2Range.end} (${part2Images.length} pages)`);
        
        // Test parallel loading (might trigger the error)
        console.log('\nStep 3: Testing parallel manifest loading...');
        
        const promises = [];
        
        // Simulate parallel loading like the UI might do
        for (let i = 0; i < 3; i++) {
            promises.push(
                loaders.getManifestForLibrary('vatican', url)
                    .then(m => {
                        console.log(`  Load ${i + 1}: Success (${m.images.length} pages)`);
                        return m;
                    })
                    .catch(err => {
                        console.error(`  Load ${i + 1}: Failed - ${err.message}`);
                        throw err;
                    })
            );
        }
        
        const results = await Promise.all(promises);
        
        // Check for inconsistencies
        const firstLength = results[0].images.length;
        const allSame = results.every(r => r.images.length === firstLength);
        
        if (!allSame) {
            console.error('  ⚠️ INCONSISTENCY DETECTED!');
            results.forEach((r, i) => {
                console.error(`    Load ${i + 1}: ${r.images.length} pages`);
            });
        } else {
            console.log(`  ✅ All parallel loads consistent: ${firstLength} pages each`);
        }
        
        console.log('\n✅ TEST COMPLETED SUCCESSFULLY');
        console.log('No "library2" error occurred during auto-split simulation');
        
    } catch (error) {
        console.error('\n❌ ERROR DETECTED:');
        console.error(`  Type: ${error.name}`);
        console.error(`  Message: ${error.message}`);
        
        if (error.message.includes('library2')) {
            console.error('\n🎯 CRITICAL: "library2" error reproduced!');
            console.error('This confirms the issue occurs during auto-split');
        }
        
        console.error('\nStack trace:');
        console.error(error.stack);
        
        process.exit(1);
    }
}

testAutoSplitScenario().then(() => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('AUTO-SPLIT TEST COMPLETE');
}).catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});