const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

async function testWolfenbuettelDownloadProgress() {
    console.log('=== TESTING WOLFENBÜTTEL DOWNLOAD PROGRESS ===\n');
    
    const manuscriptId = 'varia/selecta/ed000011';
    const outputDir = path.join(__dirname, '../reports/wolfenbuettel-progress-test');
    await fs.mkdir(outputDir, { recursive: true });
    
    // First, gather all image URLs
    console.log('Phase 1: Collecting all image URLs...');
    const allImageNames = [];
    let pointer = 0;
    let pageCount = 0;
    
    while (pageCount < 20) { // Limit to 20 pages of thumbs for testing
        const thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=${manuscriptId}&pointer=${pointer}`;
        
        try {
            const response = await fetch(thumbsUrl);
            const html = await response.text();
            
            const imageMatches = html.matchAll(/image=([^'"&]+)/g);
            const imageNames = Array.from(imageMatches, m => m[1]);
            
            if (imageNames.length === 0) break;
            
            allImageNames.push(...imageNames.filter(name => !allImageNames.includes(name)));
            
            const nextMatch = html.match(/href="thumbs\.php\?dir=[^&]+&pointer=(\d+)"[^>]*><img[^>]*title="forward"/);
            if (!nextMatch || parseInt(nextMatch[1]) === pointer) break;
            
            pointer = parseInt(nextMatch[1]);
            pageCount++;
        } catch (err) {
            console.error('Error:', err.message);
            break;
        }
    }
    
    console.log(`Total images found: ${allImageNames.length}`);
    
    // Now test downloading with progress monitoring
    console.log('\nPhase 2: Testing download speed and progress...');
    
    const testSizes = ['max', '2000', '1000', '500']; // Different resolution options
    const downloadTests = [];
    
    // Test first 5 images with different resolutions
    for (let i = 0; i < Math.min(5, allImageNames.length); i++) {
        for (const size of testSizes) {
            const imageName = allImageNames[i];
            const imageUrl = `http://diglib.hab.de/${manuscriptId}/${size}/${imageName}.jpg`;
            
            const startTime = Date.now();
            try {
                console.log(`\nDownloading ${imageName} at ${size} resolution...`);
                const response = await fetch(imageUrl);
                
                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    const downloadTime = Date.now() - startTime;
                    const sizeKB = buffer.byteLength / 1024;
                    const speedKBps = sizeKB / (downloadTime / 1000);
                    
                    downloadTests.push({
                        image: imageName,
                        resolution: size,
                        success: true,
                        sizeKB: Math.round(sizeKB),
                        timeMs: downloadTime,
                        speedKBps: Math.round(speedKBps)
                    });
                    
                    console.log(`  ✓ Success: ${sizeKB.toFixed(0)}KB in ${downloadTime}ms (${speedKBps.toFixed(0)}KB/s)`);
                } else {
                    downloadTests.push({
                        image: imageName,
                        resolution: size,
                        success: false,
                        error: `HTTP ${response.status}`
                    });
                    console.log(`  ✗ Failed: HTTP ${response.status}`);
                }
            } catch (err) {
                const downloadTime = Date.now() - startTime;
                downloadTests.push({
                    image: imageName,
                    resolution: size,
                    success: false,
                    error: err.message,
                    timeMs: downloadTime
                });
                console.log(`  ✗ Error: ${err.message} (after ${downloadTime}ms)`);
            }
        }
    }
    
    // Analyze results
    console.log('\n=== ANALYSIS ===');
    
    const successfulDownloads = downloadTests.filter(t => t.success);
    if (successfulDownloads.length > 0) {
        const avgSpeed = successfulDownloads.reduce((sum, t) => sum + t.speedKBps, 0) / successfulDownloads.length;
        const avgSize = successfulDownloads.reduce((sum, t) => sum + t.sizeKB, 0) / successfulDownloads.length;
        
        console.log(`\nAverage download speed: ${avgSpeed.toFixed(0)}KB/s`);
        console.log(`Average file size: ${avgSize.toFixed(0)}KB`);
        
        // Estimate time for full manuscript
        const estimatedTotalSizeMB = (avgSize * allImageNames.length) / 1024;
        const estimatedTimeMinutes = (estimatedTotalSizeMB * 1024) / avgSpeed / 60;
        
        console.log(`\nEstimated for full manuscript (${allImageNames.length} pages):`);
        console.log(`  Total size: ~${estimatedTotalSizeMB.toFixed(0)}MB`);
        console.log(`  Download time: ~${estimatedTimeMinutes.toFixed(1)} minutes`);
        
        if (estimatedTimeMinutes > 30) {
            console.log('\n⚠️  WARNING: Download would take over 30 minutes!');
            console.log('This might appear as a "cycle" to users when it\'s actually just slow.');
        }
    }
    
    // Check which resolution works best
    const resolutionStats = {};
    testSizes.forEach(size => {
        const tests = downloadTests.filter(t => t.resolution === size);
        const successful = tests.filter(t => t.success);
        resolutionStats[size] = {
            successRate: (successful.length / tests.length * 100).toFixed(0) + '%',
            avgSize: successful.length > 0 ? 
                Math.round(successful.reduce((sum, t) => sum + t.sizeKB, 0) / successful.length) : 0
        };
    });
    
    console.log('\nResolution success rates:');
    Object.entries(resolutionStats).forEach(([res, stats]) => {
        console.log(`  ${res}: ${stats.successRate} success, avg ${stats.avgSize}KB`);
    });
    
    // Save report
    const report = {
        manuscriptId,
        timestamp: new Date().toISOString(),
        totalPages: allImageNames.length,
        downloadTests,
        analysis: {
            avgSpeedKBps: Math.round(avgSpeed || 0),
            avgSizeKB: Math.round(avgSize || 0),
            estimatedTotalSizeMB: Math.round(estimatedTotalSizeMB || 0),
            estimatedTimeMinutes: Math.round(estimatedTimeMinutes || 0)
        },
        resolutionStats
    };
    
    await fs.writeFile(
        path.join(outputDir, 'progress-analysis.json'),
        JSON.stringify(report, null, 2)
    );
    
    console.log(`\nReport saved to: ${outputDir}/progress-analysis.json`);
}

testWolfenbuettelDownloadProgress().catch(console.error);