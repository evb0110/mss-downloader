#!/usr/bin/env node

/**
 * ULTRA-PRIORITY TEST for Issue #10
 * Tests e-manuscripta block ordering for Zurich manuscripts
 * User reported: pages are in wrong order in final PDF
 * Core blocks (5157225-5157606) should come before technical blocks (5157616, 5157615)
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');
const fs = require('fs').promises;
const path = require('path');

console.log('🔬 ULTRA-PRIORITY TEST: e-manuscripta Block Ordering (Issue #10)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function testEManuscriptaOrdering() {
    const loader = new SharedManifestLoaders();
    
    // User's exact URL from Issue #10
    const testUrl = 'https://www.e-manuscripta.ch/bau/content/zoom/5157616';
    
    console.log('\n📋 Test Case: Zurich e-manuscripta multi-block manuscript');
    console.log(`URL: ${testUrl}`);
    console.log('\nExpected block order (per user textorhub):');
    console.log('1. Core blocks: 5157225 → 5157606 (manuscript pages 1-404)');
    console.log('2. Technical blocks: 5157616, 5157615 (should come AFTER core)\n');
    
    try {
        // Test the manifest loading
        console.log('🔍 Loading manifest...');
        const result = await loader.getEManuscriptaManifest(testUrl);
        
        console.log(`\n✅ Loaded ${result.images.length} total images`);
        console.log(`📚 Title: ${result.displayName}`);
        
        // Analyze block ordering
        console.log('\n📊 Analyzing block order in generated pages:');
        
        const blockOrder = [];
        let currentBlock = null;
        let blockPageCount = 0;
        
        for (let i = 0; i < result.images.length; i++) {
            const image = result.images[i];
            
            if (image.blockId && image.blockId !== currentBlock) {
                if (currentBlock !== null) {
                    blockOrder.push({ 
                        blockId: currentBlock, 
                        pages: blockPageCount,
                        type: identifyBlockType(currentBlock)
                    });
                }
                currentBlock = image.blockId;
                blockPageCount = 1;
            } else {
                blockPageCount++;
            }
        }
        
        // Add last block
        if (currentBlock !== null) {
            blockOrder.push({ 
                blockId: currentBlock, 
                pages: blockPageCount,
                type: identifyBlockType(currentBlock)
            });
        }
        
        // Display block order
        console.log('\nDetected blocks in order:');
        blockOrder.forEach((block, idx) => {
            const marker = block.type === 'technical' ? '⚠️  ' : '📄 ';
            console.log(`${marker}Block ${idx + 1}: ${block.blockId} (${block.pages} pages) - ${block.type}`);
        });
        
        // Check if order is correct
        console.log('\n🔍 Verification:');
        
        let hasOrderingIssue = false;
        let technicalBeforeCore = false;
        
        // Find if any technical block comes before core blocks
        for (let i = 0; i < blockOrder.length - 1; i++) {
            if (blockOrder[i].type === 'technical') {
                for (let j = i + 1; j < blockOrder.length; j++) {
                    if (blockOrder[j].type === 'core') {
                        technicalBeforeCore = true;
                        console.log(`❌ ERROR: Technical block ${blockOrder[i].blockId} comes before core block ${blockOrder[j].blockId}`);
                        hasOrderingIssue = true;
                    }
                }
            }
        }
        
        // Check specific requirements from user
        const firstBlock = blockOrder[0]?.blockId;
        const lastBlocks = blockOrder.slice(-2).map(b => b.blockId);
        
        if (firstBlock === 5157616 || firstBlock === 5157615) {
            console.log(`❌ ERROR: Manuscript starts with technical block ${firstBlock} instead of core block`);
            hasOrderingIssue = true;
        }
        
        // Core blocks should be in range 5157225-5157606
        const coreBlocks = blockOrder.filter(b => b.type === 'core');
        const technicalBlocks = blockOrder.filter(b => b.type === 'technical');
        
        console.log(`\n📊 Summary:`);
        console.log(`- Core blocks found: ${coreBlocks.length}`);
        console.log(`- Technical blocks found: ${technicalBlocks.length}`);
        console.log(`- Total blocks: ${blockOrder.length}`);
        console.log(`- Total pages: ${result.images.length}`);
        
        if (hasOrderingIssue) {
            console.log('\n🚨 CRITICAL: Block ordering is INCORRECT!');
            console.log('Technical blocks are mixed with or precede core blocks.');
            console.log('This causes pages to appear in wrong order in final PDF.');
            
            // Save detailed analysis
            const analysisPath = path.join(__dirname, 'block-order-analysis.json');
            await fs.writeFile(analysisPath, JSON.stringify({
                url: testUrl,
                totalImages: result.images.length,
                blockOrder: blockOrder,
                hasOrderingIssue: true,
                technicalBeforeCore: technicalBeforeCore,
                firstFiveImages: result.images.slice(0, 5).map(img => ({
                    url: img.url,
                    label: img.label,
                    blockId: img.blockId
                })),
                lastFiveImages: result.images.slice(-5).map(img => ({
                    url: img.url,
                    label: img.label,
                    blockId: img.blockId
                }))
            }, null, 2));
            
            console.log(`\n📝 Detailed analysis saved to: ${analysisPath}`);
            return false;
        } else {
            console.log('\n✅ Block ordering appears correct!');
            console.log('Core blocks come first, technical blocks at the end.');
            return true;
        }
        
    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
}

function identifyBlockType(blockId) {
    // Based on user's information:
    // Core blocks: 5157225 to 5157606
    // Technical blocks: 5157616, 5157615
    
    if (blockId >= 5157225 && blockId <= 5157606) {
        return 'core';
    } else if (blockId === 5157616 || blockId === 5157615) {
        return 'technical';
    } else if (blockId > 5157606) {
        // Blocks after core are likely technical
        return 'technical';
    } else {
        // Blocks before core might be technical too
        return 'unknown';
    }
}

// Run the test
(async () => {
    console.log('\n🚀 Starting test...\n');
    const success = await testEManuscriptaOrdering();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (success) {
        console.log('✅ TEST PASSED: Block ordering is correct');
        process.exit(0);
    } else {
        console.log('❌ TEST FAILED: Block ordering needs to be fixed');
        process.exit(1);
    }
})();