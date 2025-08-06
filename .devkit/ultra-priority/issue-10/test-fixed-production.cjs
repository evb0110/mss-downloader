#!/usr/bin/env node

/**
 * ULTRA-PRIORITY TEST: Verify Issue #10 fix
 * Tests the UPDATED production code with optimized discovery
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

console.log('🔥 TESTING ULTRA-OPTIMIZED FIX FOR ISSUE #10 🔥');
console.log('=============================================');
console.log('User URL: https://www.e-manuscripta.ch/bau/content/zoom/5157616');
console.log('Expected: Multiple blocks with 100+ pages');
console.log('Previous: Timeout after 60+ seconds, falls back to 11 pages');
console.log('Fixed: Should complete in <8 seconds with all blocks\n');

async function testOptimizedDiscovery() {
    const loader = new SharedManifestLoaders();
    const testUrl = 'https://www.e-manuscripta.ch/bau/content/zoom/5157616';
    
    console.log('📍 Testing exact user URL:', testUrl);
    console.log('⏰ Starting at:', new Date().toISOString());
    
    const startTime = Date.now();
    
    try {
        console.log('\n🚀 Calling getEManuscriptaManifest() with ULTRA-OPTIMIZED discovery...\n');
        
        const result = await loader.getEManuscriptaManifest(testUrl);
        
        const elapsed = Date.now() - startTime;
        
        console.log('\n' + '='.repeat(60));
        console.log(`⏱️ COMPLETED IN: ${elapsed}ms (${(elapsed/1000).toFixed(1)} seconds)`);
        console.log('='.repeat(60));
        
        if (result.error) {
            console.error('❌ ERROR:', result.error);
            return;
        }
        
        console.log('\n✅ SUCCESS! Got manifest result');
        console.log('📊 RESULTS:');
        console.log('  - Pages found:', result.images?.length || 0);
        console.log('  - Title:', result.displayName);
        
        if (result.images) {
            // Analyze blocks
            const pageIds = result.images.map(p => {
                const match = p.url.match(/\/(\d+)$/);
                return match ? parseInt(match[1]) : 0;
            });
            
            const blocks = new Set();
            pageIds.forEach(id => {
                const blockStart = Math.floor(id / 11) * 11;
                blocks.add(blockStart);
            });
            
            console.log('  - Unique blocks:', blocks.size);
            console.log('  - Block ranges:', Array.from(blocks).slice(0, 5).join(', '), 
                        '...', Array.from(blocks).slice(-3).join(', '));
            
            // Verify multi-series structure
            const blockArray = Array.from(blocks).sort((a, b) => a - b);
            let hasMultipleSeries = false;
            for (let i = 1; i < blockArray.length; i++) {
                const gap = blockArray[i] - blockArray[i-1];
                if (gap > 100) {
                    hasMultipleSeries = true;
                    console.log(`  - Multi-series detected: gap of ${gap} between blocks`);
                    break;
                }
            }
            
            // Show sample URLs
            console.log('\n📄 Sample page URLs:');
            console.log('  First:', result.images[0]?.url);
            console.log('  Middle:', result.images[Math.floor(result.images.length/2)]?.url);
            console.log('  Last:', result.images[result.images.length - 1]?.url);
        }
        
        // FINAL VERDICT
        console.log('\n' + '='.repeat(60));
        if (result.images && result.images.length > 100) {
            console.log('🎉 ULTRA-PRIORITY FIX SUCCESSFUL! 🎉');
            const blockCount = new Set(result.images.map(p => Math.floor(parseInt(p.url.match(/\/(\d+)$/)?.[1] || 0) / 11) * 11)).size;
            console.log(`   Found ${result.images.length} pages in ${blockCount} blocks`);
            console.log(`   Discovery completed in ${elapsed}ms`);
            console.log('   Issue #10 is RESOLVED!');
        } else if (result.images && result.images.length > 11) {
            console.log('⚠️ PARTIAL SUCCESS');
            console.log(`   Found ${result.images.length} pages (more than 11)`);
            console.log('   But expected 100+ pages');
        } else {
            console.log('❌ FIX NOT WORKING!');
            console.log(`   Still showing only ${result.images?.length || 0} pages`);
            console.log('   User issue persists!');
        }
        console.log('='.repeat(60));
        
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error('\n💥 CRITICAL ERROR after', elapsed, 'ms');
        console.error('Error:', error.message);
        
        if (error.name === 'AbortError' || elapsed > 30000) {
            console.error('⏰ TIMEOUT ISSUE - Discovery still too slow!');
        }
    }
}

// Run the test
console.log('🔬 Starting ULTRA-PRIORITY test...\n');
testOptimizedDiscovery().then(() => {
    console.log('\n✅ Test completed');
}).catch(err => {
    console.error('\n❌ Test failed:', err);
});