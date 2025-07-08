const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TEST_URLS = [
  'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415',
  'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994416',
  'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994417',
  'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994418',
  'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994419'
];

async function performanceTest() {
  console.log('=== BELGICA KBR TILE ENGINE PERFORMANCE TEST ===');
  console.log(`Test URLs: ${TEST_URLS.length} pages`);
  console.log(`Test Time: ${new Date().toISOString()}`);
  console.log('');

  const results = {
    timestamp: new Date().toISOString(),
    testUrls: TEST_URLS,
    performance: {
      totalTime: 0,
      averageTimePerPage: 0,
      totalTilesDownloaded: 0,
      averageDownloadSpeed: 0,
      totalBytesDownloaded: 0,
      memoryUsage: {
        peak: 0,
        average: 0,
        samples: []
      }
    },
    pageResults: [],
    errors: [],
    warnings: []
  };

  let successfulDownloads = 0;
  const startTime = Date.now();

  for (let i = 0; i < TEST_URLS.length; i++) {
    const url = TEST_URLS[i];
    console.log(`\\n--- Performance Test ${i + 1}/${TEST_URLS.length}: ${url} ---`);
    
    const pageStartTime = Date.now();
    const pageResult = {
      url,
      index: i + 1,
      startTime: pageStartTime,
      endTime: 0,
      duration: 0,
      success: false,
      error: null,
      metrics: {
        tilesDownloaded: 0,
        bytesDownloaded: 0,
        downloadSpeed: 0,
        gridConfig: null,
        finalDimensions: null
      }
    };

    try {
      const { TileEngineService } = require('../../src/main/services/tile-engine/TileEngineService.ts');
      const service = new TileEngineService();
      
      // Analyze URL first
      const analysis = await service.analyzeUrl(url);
      if (!analysis) {
        throw new Error('URL analysis failed');
      }
      
      console.log(`  Grid: ${analysis.gridConfig.gridWidth}×${analysis.gridConfig.gridHeight} tiles`);
      console.log(`  Estimated: ${analysis.estimatedTiles} tiles, ${Math.round(analysis.estimatedSize / 1024 / 1024 * 100) / 100}MB`);
      
      // Create output directory
      const outputDir = `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/belgica-performance-test/`;
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputPath = path.join(outputDir, `page-${i + 1}.jpg`);
      
      // Track progress
      let progressCount = 0;
      let bytesDownloaded = 0;
      
      const progressCallback = (progress) => {
        progressCount = progress.downloadedImages;
        bytesDownloaded = progress.bytesDownloaded;
        
        // Sample memory usage
        const memUsage = process.memoryUsage();
        const totalMem = memUsage.rss / 1024 / 1024; // MB
        results.performance.memoryUsage.samples.push({
          timestamp: Date.now(),
          rss: totalMem,
          heapUsed: memUsage.heapUsed / 1024 / 1024,
          heapTotal: memUsage.heapTotal / 1024 / 1024
        });
        
        if (totalMem > results.performance.memoryUsage.peak) {
          results.performance.memoryUsage.peak = totalMem;
        }
        
        console.log(`    Progress: ${progressCount}/${analysis.estimatedTiles} tiles (${Math.round(progress.percentage)}%) - ${Math.round(totalMem)}MB RAM`);
      };
      
      // Download tiles and stitch
      const downloadResult = await service.downloadWithProgressIntegration(
        url,
        outputPath,
        progressCallback,
        (status) => {
          console.log(`    Status: ${status.phase} - ${status.message}`);
        }
      );
      
      pageResult.endTime = Date.now();
      pageResult.duration = pageResult.endTime - pageStartTime;
      pageResult.success = downloadResult.success;
      pageResult.metrics = {
        tilesDownloaded: downloadResult.downloadedTiles,
        bytesDownloaded: downloadResult.metadata.totalBytes,
        downloadSpeed: downloadResult.metadata.totalBytes / (pageResult.duration / 1000),
        gridConfig: downloadResult.metadata.gridConfig,
        finalDimensions: downloadResult.metadata.finalDimensions
      };
      
      if (downloadResult.success) {
        // Verify output file
        const stats = fs.statSync(outputPath);
        console.log(`  ✓ Success: ${downloadResult.downloadedTiles} tiles downloaded in ${Math.round(pageResult.duration / 1000)}s`);
        console.log(`  ✓ Output: ${outputPath} (${Math.round(stats.size / 1024 / 1024 * 100) / 100}MB)`);
        console.log(`  ✓ Dimensions: ${pageResult.metrics.finalDimensions.width}×${pageResult.metrics.finalDimensions.height}`);
        console.log(`  ✓ Speed: ${Math.round(pageResult.metrics.downloadSpeed / 1024)}KB/s`);
        
        successfulDownloads++;
        results.performance.totalTilesDownloaded += downloadResult.downloadedTiles;
        results.performance.totalBytesDownloaded += downloadResult.metadata.totalBytes;
      } else {
        console.log(`  ✗ Failed: ${downloadResult.errors.join(', ')}`);
        pageResult.error = downloadResult.errors.join(', ');
        results.errors.push(`Page ${i + 1}: ${pageResult.error}`);
      }
      
    } catch (error) {
      pageResult.endTime = Date.now();
      pageResult.duration = pageResult.endTime - pageStartTime;
      pageResult.success = false;
      pageResult.error = error.message;
      console.log(`  ✗ Error: ${error.message}`);
      results.errors.push(`Page ${i + 1}: ${error.message}`);
    }
    
    results.pageResults.push(pageResult);
    
    // Memory cleanup
    if (global.gc) {
      global.gc();
    }
  }

  const totalTime = Date.now() - startTime;
  results.performance.totalTime = totalTime;
  results.performance.averageTimePerPage = totalTime / TEST_URLS.length;
  results.performance.averageDownloadSpeed = results.performance.totalBytesDownloaded / (totalTime / 1000);

  // Calculate average memory usage
  if (results.performance.memoryUsage.samples.length > 0) {
    const avgMem = results.performance.memoryUsage.samples.reduce((sum, sample) => sum + sample.rss, 0) / results.performance.memoryUsage.samples.length;
    results.performance.memoryUsage.average = avgMem;
  }

  // Performance Summary
  console.log('\\n=== PERFORMANCE SUMMARY ===');
  console.log(`Total Time: ${Math.round(totalTime / 1000)}s`);
  console.log(`Average Time per Page: ${Math.round(results.performance.averageTimePerPage / 1000)}s`);
  console.log(`Successful Downloads: ${successfulDownloads}/${TEST_URLS.length}`);
  console.log(`Total Tiles Downloaded: ${results.performance.totalTilesDownloaded}`);
  console.log(`Total Data Downloaded: ${Math.round(results.performance.totalBytesDownloaded / 1024 / 1024 * 100) / 100}MB`);
  console.log(`Average Download Speed: ${Math.round(results.performance.averageDownloadSpeed / 1024)}KB/s`);
  console.log(`Peak Memory Usage: ${Math.round(results.performance.memoryUsage.peak)}MB`);
  console.log(`Average Memory Usage: ${Math.round(results.performance.memoryUsage.average)}MB`);

  if (results.errors.length > 0) {
    console.log(`\\nErrors: ${results.errors.length}`);
    results.errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error}`);
    });
  }

  // Rate limiting analysis
  console.log('\\n=== RATE LIMITING ANALYSIS ===');
  const rateLimit = 2; // requests per second
  const expectedMinTime = (80 * TEST_URLS.length) / rateLimit; // 80 tiles per page
  const actualTime = totalTime / 1000;
  const rateEfficiency = expectedMinTime / actualTime;
  
  console.log(`Expected minimum time (rate-limited): ${Math.round(expectedMinTime)}s`);
  console.log(`Actual time: ${Math.round(actualTime)}s`);
  console.log(`Rate limiting efficiency: ${Math.round(rateEfficiency * 100)}%`);
  
  if (rateEfficiency > 0.8) {
    console.log('✓ Rate limiting working effectively');
  } else {
    console.log('⚠ Rate limiting may not be working optimally');
    results.warnings.push('Rate limiting efficiency below 80%');
  }

  // Save results
  const outputPath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/belgica-kbr-performance-test-results.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\\nDetailed results saved to: ${outputPath}`);

  return results;
}

if (require.main === module) {
  performanceTest()
    .then((results) => {
      const successRate = results.pageResults.filter(p => p.success).length / results.pageResults.length;
      process.exit(successRate >= 0.8 ? 0 : 1);
    })
    .catch((error) => {
      console.error('Performance test failed:', error);
      process.exit(1);
    });
}

module.exports = { performanceTest };