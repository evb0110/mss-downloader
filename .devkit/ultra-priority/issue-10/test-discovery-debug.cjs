#!/usr/bin/env node

/**
 * Debug the discovery logic to understand block categorization
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

async function debugDiscovery() {
    const loader = new SharedManifestLoaders();
    
    // Manually call the discovery function
    const manuscriptId = '5157616';
    const library = 'bau';
    
    console.log('🔍 Debugging e-manuscripta block discovery');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const result = await loader.discoverEManuscriptaBlocks(manuscriptId, library);
    
    console.log('\n📊 Discovery Result:');
    console.log(`Total blocks: ${result.blocks.length}`);
    console.log(`Total pages: ${result.totalPages}`);
    console.log('\nBlock IDs:');
    console.log(result.blocks.join(', '));
    
    // Analyze the sequence
    console.log('\n🔬 Sequence Analysis:');
    const blocks = result.blocks;
    for (let i = 1; i < blocks.length; i++) {
        const gap = blocks[i] - blocks[i-1];
        if (gap !== 11) {
            console.log(`Gap of ${gap} between ${blocks[i-1]} and ${blocks[i]}`);
        }
    }
    
    // Check specific blocks
    console.log('\n📋 Specific Block Checks:');
    console.log(`Contains 5157605? ${blocks.includes(5157605)}`);
    console.log(`Contains 5157616? ${blocks.includes(5157616)}`);
    console.log(`Contains 5157615? ${blocks.includes(5157615)}`);
    console.log(`Contains 5157627? ${blocks.includes(5157627)}`);
    
    // Where are they in the array?
    if (blocks.includes(5157605)) {
        console.log(`Position of 5157605: ${blocks.indexOf(5157605)}`);
    }
    if (blocks.includes(5157616)) {
        console.log(`Position of 5157616: ${blocks.indexOf(5157616)}`);
    }
    if (blocks.includes(5157615)) {
        console.log(`Position of 5157615: ${blocks.indexOf(5157615)}`);
    }
}

debugDiscovery().catch(console.error);