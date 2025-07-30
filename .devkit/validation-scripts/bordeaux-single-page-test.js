#!/usr/bin/env node

/**
 * Simple single-page test for Bordeaux library
 * Tests DirectTileProcessor with just one page
 */

const { DirectTileProcessor } = require('../../src/main/services/DirectTileProcessor.ts');
const path = require('path');
const fs = require('fs').promises;

async function testSinglePage() {
    console.log('=== Bordeaux Single Page Test ===\n');
    
    const processor = new DirectTileProcessor();
    const testDir = path.join(__dirname, '../validation-results/bordeaux-v1.4.49');
    const imagePath = path.join(testDir, 'single-page-test.jpg');
    
    try {
        await fs.mkdir(testDir, { recursive: true });
        
        console.log('Testing DirectTileProcessor.processPage()...');
        console.log('Base ID: 330636101_MS0778');
        console.log('Page Number: 6');
        console.log('Output Path:', imagePath);
        
        const result = await processor.processPage('330636101_MS0778', 6, imagePath);
        
        if (result.success) {
            console.log('\n✅ Page processing succeeded!');
            
            // Check file
            const stats = await fs.stat(imagePath);
            console.log(`✅ File created: ${Math.round(stats.size / 1024 / 1024 * 100) / 100} MB`);
            
            return true;
        } else {
            console.log('\n❌ Page processing failed:', result.error);
            return false;
        }
        
    } catch (error) {
        console.error('\n💥 Test error:', error.message);
        return false;
    }
}

if (require.main === module) {
    testSinglePage().then(success => {
        if (success) {
            console.log('\n🎉 Single page test completed successfully!');
        } else {
            console.log('\n💥 Single page test failed!');
            process.exit(1);
        }
    });
}

module.exports = { testSinglePage };