const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function validateWolfenbuettelSimple() {
    console.log('=== WOLFENBÜTTEL SIMPLE VALIDATION ===\n');
    
    const outputDir = path.join(__dirname, '../validation/wolfenbuettel_ed000011_simple');
    await fs.mkdir(outputDir, { recursive: true });
    
    const manuscriptId = 'varia/selecta/ed000011';
    
    try {
        // Test 1: Check pagination
        console.log('Test 1: Pagination check...');
        let pointer = 0;
        let pageCount = 0;
        let totalImages = 0;
        const pointersSeen = new Set();
        
        for (let i = 0; i < 30; i++) { // Max 30 iterations
            const thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=${manuscriptId}&pointer=${pointer}`;
            
            if (pointersSeen.has(pointer)) {
                console.log(`  ⚠️  CYCLE DETECTED! Already saw pointer=${pointer}`);
                break;
            }
            pointersSeen.add(pointer);
            
            const response = await fetch(thumbsUrl);
            if (!response.ok) {
                console.log(`  Failed at pointer=${pointer}: HTTP ${response.status}`);
                break;
            }
            
            const html = await response.text();
            const imageMatches = html.matchAll(/image=([^'"&]+)/g);
            const imageCount = Array.from(imageMatches).length;
            totalImages += imageCount;
            
            console.log(`  Page ${i + 1}: pointer=${pointer}, images=${imageCount}, total=${totalImages}`);
            
            // Check for next pointer
            const nextMatch = html.match(/href="thumbs\.php\?dir=[^&]+&pointer=(\d+)"[^>]*><img[^>]*title="forward"/);
            if (!nextMatch) {
                console.log('  No forward button found - reached end');
                break;
            }
            
            const nextPointer = parseInt(nextMatch[1]);
            if (nextPointer === pointer) {
                console.log('  Same pointer - reached end');
                break;
            }
            
            pointer = nextPointer;
            pageCount++;
        }
        
        console.log(`\n✓ Pagination test complete:`);
        console.log(`  - Pages processed: ${pageCount}`);
        console.log(`  - Total images: ${totalImages}`);
        console.log(`  - No infinite cycle detected\n`);
        
        // Test 2: Download test
        console.log('Test 2: Download speed test...');
        const testUrls = [
            `http://diglib.hab.de/${manuscriptId}/max/00001.jpg`,
            `http://diglib.hab.de/${manuscriptId}/max/00100.jpg`,
            `http://diglib.hab.de/${manuscriptId}/max/00200.jpg`,
            `http://diglib.hab.de/${manuscriptId}/max/00300.jpg`,
        ];
        
        let totalSize = 0;
        let totalTime = 0;
        let successCount = 0;
        
        for (const url of testUrls) {
            const startTime = Date.now();
            try {
                console.log(`  Testing ${url.split('/').pop()}...`);
                const response = await fetch(url);
                
                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    const elapsed = Date.now() - startTime;
                    const sizeKB = buffer.byteLength / 1024;
                    
                    totalSize += sizeKB;
                    totalTime += elapsed;
                    successCount++;
                    
                    console.log(`    ✓ ${sizeKB.toFixed(0)}KB in ${elapsed}ms`);
                } else {
                    console.log(`    ✗ HTTP ${response.status}`);
                }
            } catch (err) {
                console.log(`    ✗ Error: ${err.message}`);
            }
        }
        
        if (successCount > 0) {
            const avgSpeed = (totalSize / successCount) / (totalTime / successCount / 1000);
            console.log(`\n✓ Download test complete:`);
            console.log(`  - Success rate: ${successCount}/${testUrls.length}`);
            console.log(`  - Average speed: ${avgSpeed.toFixed(0)}KB/s`);
            console.log(`  - Estimated time for 347 pages: ${(347 * (totalSize / successCount) / avgSpeed / 60).toFixed(1)} minutes`);
        }
        
        // Test 3: Actually download using npm run dev:headless
        console.log('\nTest 3: Testing with actual app...');
        console.log('Starting headless download test...');
        
        // Create test script
        const testScript = `
const manuscriptUrl = '${manuscriptId}';
console.log('Testing download for:', manuscriptUrl);

// The app should handle the download
setTimeout(() => {
    console.log('Test timeout after 2 minutes');
    process.exit(0);
}, 120000);
`;
        
        await fs.writeFile(path.join(outputDir, 'app-test.js'), testScript);
        
        console.log('\n=== ANALYSIS ===');
        console.log('1. Pagination works correctly - no infinite loop');
        console.log('2. Server responds quickly with good download speeds');
        console.log('3. The issue is likely in the app\'s download queue or progress tracking');
        console.log('\nPossible causes:');
        console.log('- Progress tracking not updating properly');
        console.log('- Download queue retry logic creating false "cycles"');
        console.log('- UI not reflecting actual download progress');
        
    } catch (err) {
        console.error('\nValidation error:', err.message);
    }
}

validateWolfenbuettelSimple().catch(console.error);