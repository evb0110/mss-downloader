/**
 * Test script to verify Bordeaux progress reporting fix
 * Tests that tile download progress is now reported incrementally
 */

const path = require('path');
const fs = require('fs').promises;

// Import the fixed DirectTileProcessor
const { DirectTileProcessor } = require('../../src/main/services/DirectTileProcessor');

async function testProgressReporting() {
    console.log('=== TESTING BORDEAUX PROGRESS FIX ===\n');
    
    const processor = new DirectTileProcessor();
    
    // Test with a sample Bordeaux manuscript page
    const baseId = 'btv1b525096f6g';  // Example from user's screenshot
    const pageNum = 1;
    const outputPath = path.join(__dirname, 'test-bordeaux-page.jpg');
    
    // Track progress updates
    const progressUpdates = [];
    let lastReportedProgress = 0;
    
    const progressCallback = (downloaded, total) => {
        const percent = Math.round((downloaded / total) * 100);
        progressUpdates.push({ downloaded, total, percent });
        
        // Only log when progress increases by at least 10%
        if (percent >= lastReportedProgress + 10) {
            console.log(`Progress: ${percent}% (${downloaded}/${total} tiles)`);
            lastReportedProgress = percent;
        }
    };
    
    console.log('Starting Bordeaux page download with progress tracking...\n');
    
    try {
        const startTime = Date.now();
        
        // Call the fixed processPage with progress callback
        const result = await processor.processPage(
            baseId,
            pageNum,
            outputPath,
            progressCallback
        );
        
        const elapsedMs = Date.now() - startTime;
        
        if (result.success) {
            console.log('\n✅ SUCCESS: Page downloaded successfully');
            console.log(`Time taken: ${(elapsedMs / 1000).toFixed(2)} seconds`);
            
            // Check file was created
            const stats = await fs.stat(outputPath);
            console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            
            // Analyze progress reporting
            console.log(`\nProgress updates received: ${progressUpdates.length}`);
            
            if (progressUpdates.length > 0) {
                console.log('First update:', progressUpdates[0]);
                console.log('Last update:', progressUpdates[progressUpdates.length - 1]);
                
                // Check if progress was incremental
                const wasIncremental = progressUpdates.length > 5;
                if (wasIncremental) {
                    console.log('\n✅ PASS: Progress was reported incrementally during download');
                } else {
                    console.log('\n⚠️  WARNING: Few progress updates received');
                }
            } else {
                console.log('\n❌ FAIL: No progress updates received');
            }
            
            // Clean up test file
            await fs.unlink(outputPath);
            console.log('\nTest file cleaned up');
            
        } else {
            console.log(`\n❌ FAILED: ${result.error}`);
        }
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.log('\nNote: This test requires internet access to download from Bordeaux library');
    }
    
    console.log('\n=== TEST COMPLETE ===');
}

// Run the test
testProgressReporting().catch(console.error);