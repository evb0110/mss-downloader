#!/usr/bin/env node

/**
 * Test to verify EXACT blocks that should be found
 * According to user textorhub from Issue #10:
 * - Core blocks: 5157225 to 5157606 
 * - Technical blocks: 5157616, 5157615 (in that order on website, but should be reversed)
 */

const https = require('https');

async function checkBlock(blockId) {
    const url = `https://www.e-manuscripta.ch/bau/content/zoom/${blockId}`;
    
    return new Promise((resolve) => {
        https.get(url, (res) => {
            resolve({ blockId, exists: res.statusCode === 200 });
        }).on('error', () => {
            resolve({ blockId, exists: false });
        });
    });
}

async function findActualBlocks() {
    console.log('🔍 Finding ACTUAL e-manuscripta blocks for Issue #10');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Check the specific blocks mentioned by user
    console.log('\n1️⃣ Checking user-specified technical blocks:');
    const tech1 = await checkBlock(5157616);
    console.log(`   Block 5157616: ${tech1.exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    
    const tech2 = await checkBlock(5157615);
    console.log(`   Block 5157615: ${tech2.exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    
    // Check core boundary blocks
    console.log('\n2️⃣ Checking core boundary blocks:');
    const coreStart = await checkBlock(5157225);
    console.log(`   Block 5157225 (core start): ${coreStart.exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    
    const coreEnd = await checkBlock(5157606);
    console.log(`   Block 5157606 (core end): ${coreEnd.exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    
    // Check pattern between core blocks
    console.log('\n3️⃣ Checking core block pattern (should be +11):');
    const coreBlocks = [];
    for (let id = 5157225; id <= 5157606; id += 11) {
        const result = await checkBlock(id);
        if (result.exists) {
            coreBlocks.push(id);
        }
        process.stdout.write(result.exists ? '✓' : '✗');
    }
    console.log(`\n   Found ${coreBlocks.length} core blocks`);
    
    // Check what's after 5157616
    console.log('\n4️⃣ Checking blocks after 5157616:');
    const afterBlocks = [];
    for (let id = 5157627; id <= 5157682; id += 11) {
        const result = await checkBlock(id);
        if (result.exists) {
            afterBlocks.push(id);
            console.log(`   Block ${id}: ✅ EXISTS (unexpected!)`);
        } else {
            console.log(`   Block ${id}: ❌ NOT FOUND`);
            break;
        }
    }
    
    // Calculate expected structure
    console.log('\n📊 ANALYSIS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Core blocks found: ${coreBlocks.length}`);
    if (coreBlocks.length > 0) {
        console.log(`  First: ${coreBlocks[0]}`);
        console.log(`  Last: ${coreBlocks[coreBlocks.length - 1]}`);
    }
    console.log(`Technical blocks confirmed: ${[5157616, 5157615].filter(id => 
        (id === 5157616 ? tech1.exists : tech2.exists)).length}/2`);
    console.log(`Unexpected blocks after 5157616: ${afterBlocks.length}`);
    
    // Show correct order
    console.log('\n✅ CORRECT BLOCK ORDER SHOULD BE:');
    console.log('1. Core blocks (in ascending order):');
    coreBlocks.forEach((id, idx) => {
        console.log(`   ${idx + 1}. Block ${id} (pages ${idx * 11 + 1}-${(idx + 1) * 11})`);
    });
    console.log('\n2. Technical blocks (special order):');
    console.log('   37. Block 5157616 (technical block 1)');
    console.log('   38. Block 5157615 (technical block 2 - NOTE: reverse order!)');
    
    const totalExpectedPages = (coreBlocks.length * 11) + 22; // core + 2 technical blocks
    console.log(`\nTotal expected pages: ${totalExpectedPages}`);
    
    // The problem insight
    console.log('\n🚨 KEY INSIGHT:');
    console.log('The technical blocks are in REVERSE numerical order!');
    console.log('Website shows: 5157616, then 5157615');
    console.log('But 5157615 < 5157616, so pure numerical sort breaks the order!');
    
    return {
        coreBlocks,
        technicalBlocks: [5157616, 5157615],
        afterBlocks
    };
}

// Run the analysis
(async () => {
    await findActualBlocks();
})();