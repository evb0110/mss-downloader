#!/usr/bin/env node

/**
 * ULTRA-PRIORITY TEST: Issue #10 - e-manuscripta.ch multi-block discovery
 * This tests the EXACT production code with the user's failing URL
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

console.log('🔥 ULTRA-PRIORITY PRODUCTION CODE TEST 🔥');
console.log('=========================================');
console.log('Issue #10: e-manuscripta.ch showing only 11 pages');
console.log('User URL: https://www.e-manuscripta.ch/bau/content/zoom/5157616');
console.log('Expected: Multiple blocks (101+ blocks with 1111+ pages)');
console.log('Current: Only showing 11 pages\n');

async function ultraDeepTest() {
    const loader = new SharedManifestLoaders();
    const testUrl = 'https://www.e-manuscripta.ch/bau/content/zoom/5157616';
    
    console.log('📍 Testing exact user URL:', testUrl);
    console.log('⏰ Starting test at:', new Date().toISOString());
    
    try {
        // Add logging to understand what's happening
        const originalConsoleLog = console.log;
        const logs = [];
        
        // Intercept console.log to capture internal logs
        console.log = (...args) => {
            logs.push(args.join(' '));
            originalConsoleLog(...args);
        };
        
        console.log('\n🔬 Phase 1: Calling getEManuscriptaManifest()...');
        const startTime = Date.now();
        
        const result = await loader.getEManuscriptaManifest(testUrl);
        
        const elapsed = Date.now() - startTime;
        console.log = originalConsoleLog; // Restore original console.log
        
        console.log(`⏱️ Execution time: ${elapsed}ms`);
        
        if (result.error) {
            console.error('❌ ERROR:', result.error);
            console.log('\n📋 Internal logs captured:');
            logs.forEach(log => console.log('  >', log));
            return;
        }
        
        console.log('\n✅ SUCCESS! Got manifest result');
        console.log('📊 Result Analysis:');
        console.log('  - Pages found:', result.pages?.length || 0);
        console.log('  - Title:', result.title);
        console.log('  - Library:', result.library);
        
        if (result.pages) {
            console.log('\n📄 Page Details:');
            console.log('  - First page URL:', result.pages[0]?.url);
            console.log('  - Last page URL:', result.pages[result.pages.length - 1]?.url);
            
            // Check for unique page IDs
            const pageIds = result.pages.map(p => {
                const match = p.url.match(/\/(\d+)$/);
                return match ? match[1] : 'unknown';
            });
            
            const uniqueIds = [...new Set(pageIds)];
            console.log('  - Unique page IDs:', uniqueIds.length);
            
            // Check for block patterns
            const blocks = new Map();
            pageIds.forEach((id, index) => {
                const baseId = Math.floor(parseInt(id) / 11) * 11;
                if (!blocks.has(baseId)) {
                    blocks.set(baseId, []);
                }
                blocks.get(baseId).push({ id, index });
            });
            
            console.log('  - Detected blocks:', blocks.size);
            
            if (blocks.size > 1) {
                console.log('\n🎯 MULTI-BLOCK STRUCTURE DETECTED!');
                let blockNum = 1;
                for (const [baseId, pages] of blocks) {
                    console.log(`  Block ${blockNum}: Base ID ${baseId}, Pages: ${pages.length}`);
                    blockNum++;
                }
            } else {
                console.log('\n⚠️ SINGLE BLOCK ONLY - THIS IS THE BUG!');
                console.log('  Expected: Multiple blocks as shown in issue');
                console.log('  Actual: Only one block detected');
            }
            
            // Show sample of page IDs
            console.log('\n📋 Sample page IDs (first 5 and last 5):');
            pageIds.slice(0, 5).forEach((id, i) => {
                console.log(`  Page ${i + 1}: ${id}`);
            });
            if (pageIds.length > 10) {
                console.log('  ...');
                pageIds.slice(-5).forEach((id, i) => {
                    console.log(`  Page ${result.pages.length - 4 + i}: ${id}`);
                });
            }
        }
        
        console.log('\n🔍 Internal logs during execution:');
        logs.slice(0, 20).forEach(log => console.log('  >', log));
        if (logs.length > 20) {
            console.log(`  ... (${logs.length - 20} more logs)`);
        }
        
        // CRITICAL CHECK
        console.log('\n' + '='.repeat(60));
        if (result.pages && result.pages.length <= 11) {
            console.log('❌ CRITICAL BUG CONFIRMED!');
            console.log('   Only ' + result.pages.length + ' pages found');
            console.log('   User reports this is the exact same bug');
            console.log('   Production code is NOT using the improved version!');
        } else if (result.pages && result.pages.length > 100) {
            console.log('✅ BUG APPEARS FIXED!');
            console.log('   Found ' + result.pages.length + ' pages');
            console.log('   This matches expected multi-block behavior');
        } else {
            console.log('⚠️ PARTIAL FIX?');
            console.log('   Found ' + (result.pages?.length || 0) + ' pages');
            console.log('   More than 11 but less than expected');
        }
        console.log('='.repeat(60));
        
        return result;
        
    } catch (error) {
        console.error('\n💥 CRITICAL ERROR:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Check if it's a timeout or network error
        if (error.name === 'AbortError') {
            console.error('⏰ TIMEOUT detected - this might be the root cause!');
        }
    }
}

// Run the test
console.log('\n🚀 Starting ULTRA-PRIORITY test...\n');
ultraDeepTest().then(() => {
    console.log('\n✅ Test completed');
}).catch(err => {
    console.error('\n❌ Test failed:', err);
});