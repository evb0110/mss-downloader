#!/usr/bin/env node

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');
const https = require('https');

async function testFix() {
    console.log('🧪 TESTING FIX FOR ISSUE #10');
    console.log('============================\n');
    
    const loaders = new SharedManifestLoaders();
    const testUrl = 'https://www.e-manuscripta.ch/bau/content/zoom/5157616';
    
    console.log('Testing URL:', testUrl);
    console.log('Expected: Should find blocks starting at 5157232, not 5157231\n');
    
    try {
        const manifest = await loaders.getEManuscriptaManifest(testUrl);
        
        console.log('✅ Manifest loaded successfully');
        console.log('  Total pages:', manifest.images.length);
        
        // Extract unique blocks
        const blocks = new Set();
        manifest.images.forEach(img => {
            if (img.blockId) blocks.add(img.blockId);
        });
        
        const blockArray = Array.from(blocks).sort((a, b) => a - b);
        console.log('  Unique blocks:', blockArray.length);
        console.log('  First 5 blocks:', blockArray.slice(0, 5).join(', '));
        
        // Check if we have the correct starting block
        const expectedFirstBlock = 5157232;
        const actualFirstBlock = blockArray.find(b => b >= 5157200 && b <= 5157250);
        
        console.log('\n🎯 Critical Check:');
        if (actualFirstBlock === expectedFirstBlock) {
            console.log(`  ✅ CORRECT: First multi-series block is ${actualFirstBlock}`);
        } else {
            console.log(`  ❌ WRONG: First multi-series block is ${actualFirstBlock}, expected ${expectedFirstBlock}`);
        }
        
        // Test accessibility of first few pages
        console.log('\n📋 Testing URL accessibility:');
        const testUrls = [
            manifest.images[0].url,
            manifest.images[11].url,  // Second block
            manifest.images[22].url   // Third block
        ];
        
        for (let i = 0; i < testUrls.length; i++) {
            const url = testUrls[i];
            const result = await new Promise((resolve) => {
                https.get(url, (res) => {
                    resolve(res.statusCode);
                }).on('error', () => resolve('error'));
            });
            
            const id = url.split('/').pop();
            if (result === 200) {
                console.log(`  ✅ Page ${i * 11 + 1} (ID ${id}): Accessible`);
            } else {
                console.log(`  ❌ Page ${i * 11 + 1} (ID ${id}): Status ${result}`);
            }
        }
        
        // Final verdict
        console.log('\n📊 VERDICT:');
        if (actualFirstBlock === expectedFirstBlock && manifest.images.length > 100) {
            console.log('  ✅✅✅ FIX SUCCESSFUL! Issue #10 is resolved.');
            console.log(`  Found ${manifest.images.length} pages across ${blockArray.length} blocks.`);
        } else {
            console.log('  ❌ Fix needs more work.');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testFix();