const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TEST_URL = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';

async function testBelgicaKbrTileEngine() {
  console.log('=== BELGICA KBR TILE ENGINE COMPREHENSIVE TEST ===');
  console.log(`Test URL: ${TEST_URL}`);
  console.log(`Test Time: ${new Date().toISOString()}`);
  console.log('');

  const results = {
    timestamp: new Date().toISOString(),
    testUrl: TEST_URL,
    tests: {},
    summary: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      warnings: []
    }
  };

  // Test 1: URL Detection and Adapter Selection
  console.log('--- Test 1: URL Detection and Adapter Selection ---');
  try {
    const { TileEngineService } = require('../../src/main/services/tile-engine/TileEngineService.ts');
    const service = new TileEngineService();
    
    const isTileBased = await service.isTileBasedUrl(TEST_URL);
    const adapter = await service.detectAdapter(TEST_URL);
    
    results.tests.urlDetection = {
      passed: isTileBased && adapter !== null,
      details: {
        isTileBased,
        adapterName: adapter?.name || 'none',
        adapterDescription: adapter?.description || 'none'
      }
    };
    
    if (isTileBased && adapter) {
      console.log('✓ URL correctly identified as tile-based');
      console.log(`✓ Adapter selected: ${adapter.name} - ${adapter.description}`);
      results.summary.passedTests++;
    } else {
      console.log('✗ URL detection failed');
      results.summary.failedTests++;
    }
    
    results.summary.totalTests++;
  } catch (error) {
    console.log(`✗ URL detection error: ${error.message}`);
    results.tests.urlDetection = { passed: false, error: error.message };
    results.summary.failedTests++;
    results.summary.totalTests++;
  }

  // Test 2: Manuscript Page Analysis
  console.log('\\n--- Test 2: Manuscript Page Analysis ---');
  try {
    const { TileEngineService } = require('../../src/main/services/tile-engine/TileEngineService.ts');
    const service = new TileEngineService();
    
    const analysis = await service.analyzeUrl(TEST_URL);
    
    results.tests.pageAnalysis = {
      passed: analysis !== null,
      details: analysis
    };
    
    if (analysis) {
      console.log('✓ Manuscript page analysis successful');
      console.log(`  - Grid: ${analysis.gridConfig.gridWidth}×${analysis.gridConfig.gridHeight}`);
      console.log(`  - Tile size: ${analysis.gridConfig.tileWidth}×${analysis.gridConfig.tileHeight}`);
      console.log(`  - Total dimensions: ${analysis.gridConfig.totalWidth}×${analysis.gridConfig.totalHeight}`);
      console.log(`  - Estimated tiles: ${analysis.estimatedTiles}`);
      console.log(`  - Estimated size: ${Math.round(analysis.estimatedSize / 1024 / 1024 * 100) / 100}MB`);
      console.log(`  - Estimated time: ${analysis.estimatedTime}s`);
      results.summary.passedTests++;
    } else {
      console.log('✗ Manuscript page analysis failed');
      results.summary.failedTests++;
    }
    
    results.summary.totalTests++;
  } catch (error) {
    console.log(`✗ Page analysis error: ${error.message}`);
    results.tests.pageAnalysis = { passed: false, error: error.message };
    results.summary.failedTests++;
    results.summary.totalTests++;
  }

  // Test 3: Tile URL Generation
  console.log('\\n--- Test 3: Tile URL Generation ---');
  try {
    const { BelgicaKbrAdapter } = require('../../src/main/services/tile-engine/adapters/BelgicaKbrAdapter.ts');
    const adapter = new BelgicaKbrAdapter();
    
    const baseUrl = 'https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/16994415_0001/';
    const gridConfig = {
      gridWidth: 8,
      gridHeight: 10,
      tileWidth: 768,
      tileHeight: 768,
      zoomLevel: 3,
      totalWidth: 6144,
      totalHeight: 7680,
      format: 'jpg',
      overlap: 0
    };
    
    const tileUrls = await adapter.generateTileUrls(baseUrl, gridConfig);
    
    results.tests.tileUrlGeneration = {
      passed: tileUrls.length === 80,
      details: {
        expectedCount: 80,
        actualCount: tileUrls.length,
        sampleUrls: tileUrls.slice(0, 5),
        lastUrl: tileUrls[tileUrls.length - 1]
      }
    };
    
    if (tileUrls.length === 80) {
      console.log('✓ Tile URL generation successful');
      console.log(`  - Generated ${tileUrls.length} tile URLs`);
      console.log(`  - Sample: ${tileUrls[0]}`);
      console.log(`  - Last: ${tileUrls[tileUrls.length - 1]}`);
      results.summary.passedTests++;
    } else {
      console.log(`✗ Tile URL generation failed: expected 80, got ${tileUrls.length}`);
      results.summary.failedTests++;
    }
    
    results.summary.totalTests++;
  } catch (error) {
    console.log(`✗ Tile URL generation error: ${error.message}`);
    results.tests.tileUrlGeneration = { passed: false, error: error.message };
    results.summary.failedTests++;
    results.summary.totalTests++;
  }

  // Test 4: Authentication Configuration
  console.log('\\n--- Test 4: Authentication Configuration ---');
  try {
    const { BelgicaKbrAdapter } = require('../../src/main/services/tile-engine/adapters/BelgicaKbrAdapter.ts');
    const adapter = new BelgicaKbrAdapter();
    
    const baseUrl = 'https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/16994415_0001/';
    const authConfig = await adapter.getAuthConfig(baseUrl);
    
    results.tests.authConfig = {
      passed: authConfig.type === 'referrer' && authConfig.referrer && authConfig.customHeaders,
      details: authConfig
    };
    
    if (authConfig.type === 'referrer' && authConfig.referrer && authConfig.customHeaders) {
      console.log('✓ Authentication configuration successful');
      console.log(`  - Type: ${authConfig.type}`);
      console.log(`  - Referrer: ${authConfig.referrer}`);
      console.log(`  - Custom headers: ${Object.keys(authConfig.customHeaders).length} headers`);
      results.summary.passedTests++;
    } else {
      console.log('✗ Authentication configuration failed');
      results.summary.failedTests++;
    }
    
    results.summary.totalTests++;
  } catch (error) {
    console.log(`✗ Authentication configuration error: ${error.message}`);
    results.tests.authConfig = { passed: false, error: error.message };
    results.summary.failedTests++;
    results.summary.totalTests++;
  }

  // Test 5: Tile System Validation
  console.log('\\n--- Test 5: Tile System Validation ---');
  try {
    const { TileEngineService } = require('../../src/main/services/tile-engine/TileEngineService.ts');
    const service = new TileEngineService();
    
    const validation = await service.validateTileSystem(TEST_URL);
    
    results.tests.tileSystemValidation = {
      passed: validation.isValid,
      details: validation
    };
    
    if (validation.isValid) {
      console.log('✓ Tile system validation successful');
      console.log(`  - Adapter: ${validation.adapter}`);
      console.log(`  - Grid: ${validation.gridConfig.gridWidth}×${validation.gridConfig.gridHeight}`);
      if (validation.warnings.length > 0) {
        console.log(`  - Warnings: ${validation.warnings.join(', ')}`);
        results.summary.warnings.push(...validation.warnings);
      }
      results.summary.passedTests++;
    } else {
      console.log('✗ Tile system validation failed');
      console.log(`  - Errors: ${validation.errors.join(', ')}`);
      results.summary.failedTests++;
    }
    
    results.summary.totalTests++;
  } catch (error) {
    console.log(`✗ Tile system validation error: ${error.message}`);
    results.tests.tileSystemValidation = { passed: false, error: error.message };
    results.summary.failedTests++;
    results.summary.totalTests++;
  }

  // Test 6: Single Tile Download Test
  console.log('\\n--- Test 6: Single Tile Download Test ---');
  try {
    const https = require('https');
    const { URL } = require('url');
    
    const testTileUrl = 'https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/16994415_0001/3-0-0.jpg';
    const referrer = 'https://viewerd.kbr.be/display/SYRACUSE/';
    
    const response = await new Promise((resolve, reject) => {
      const urlObj = new URL(testTileUrl);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'Referer': referrer,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      };
      
      const req = https.request(options, (res) => {
        let data = Buffer.alloc(0);
        res.on('data', (chunk) => {
          data = Buffer.concat([data, chunk]);
        });
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      });
      
      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });
    
    const isValidJpeg = response.data.subarray(0, 2).toString('hex') === 'ffd8' &&
                       response.data.subarray(response.data.length - 2).toString('hex') === 'ffd9';
    
    results.tests.singleTileDownload = {
      passed: response.status === 200 && isValidJpeg && response.data.length > 5000,
      details: {
        httpStatus: response.status,
        contentLength: response.data.length,
        contentType: response.headers['content-type'],
        isValidJpeg,
        sizeKB: Math.round(response.data.length / 1024)
      }
    };
    
    if (response.status === 200 && isValidJpeg && response.data.length > 5000) {
      console.log('✓ Single tile download successful');
      console.log(`  - HTTP Status: ${response.status}`);
      console.log(`  - Content Length: ${response.data.length} bytes (${Math.round(response.data.length / 1024)}KB)`);
      console.log(`  - Content Type: ${response.headers['content-type']}`);
      console.log(`  - Valid JPEG: ${isValidJpeg}`);
      results.summary.passedTests++;
    } else {
      console.log('✗ Single tile download failed');
      console.log(`  - HTTP Status: ${response.status}`);
      console.log(`  - Content Length: ${response.data.length} bytes`);
      console.log(`  - Valid JPEG: ${isValidJpeg}`);
      results.summary.failedTests++;
    }
    
    results.summary.totalTests++;
  } catch (error) {
    console.log(`✗ Single tile download error: ${error.message}`);
    results.tests.singleTileDownload = { passed: false, error: error.message };
    results.summary.failedTests++;
    results.summary.totalTests++;
  }

  // Test 7: Statistics and Configuration
  console.log('\\n--- Test 7: Statistics and Configuration ---');
  try {
    const { TileEngineService } = require('../../src/main/services/tile-engine/TileEngineService.ts');
    const service = new TileEngineService();
    
    const statistics = service.getStatistics();
    const config = service.getConfig();
    const supportedAdapters = service.getSupportedAdapters();
    
    results.tests.statisticsAndConfig = {
      passed: statistics.supportedAdapters > 0 && supportedAdapters.includes('belgica-kbr'),
      details: {
        statistics,
        supportedAdapters,
        configKeys: Object.keys(config)
      }
    };
    
    if (statistics.supportedAdapters > 0 && supportedAdapters.includes('belgica-kbr')) {
      console.log('✓ Statistics and configuration successful');
      console.log(`  - Supported adapters: ${statistics.supportedAdapters}`);
      console.log(`  - Belgica KBR adapter: ${supportedAdapters.includes('belgica-kbr') ? 'available' : 'missing'}`);
      console.log(`  - Rate limit: ${config.rateLimit.requestsPerSecond} requests/second`);
      console.log(`  - Max concurrent: ${config.maxConcurrentDownloads}`);
      results.summary.passedTests++;
    } else {
      console.log('✗ Statistics and configuration failed');
      results.summary.failedTests++;
    }
    
    results.summary.totalTests++;
  } catch (error) {
    console.log(`✗ Statistics and configuration error: ${error.message}`);
    results.tests.statisticsAndConfig = { passed: false, error: error.message };
    results.summary.failedTests++;
    results.summary.totalTests++;
  }

  // Final Summary
  console.log('\\n=== TEST SUMMARY ===');
  console.log(`Total Tests: ${results.summary.totalTests}`);
  console.log(`Passed: ${results.summary.passedTests}`);
  console.log(`Failed: ${results.summary.failedTests}`);
  console.log(`Success Rate: ${Math.round((results.summary.passedTests / results.summary.totalTests) * 100)}%`);
  
  if (results.summary.warnings.length > 0) {
    console.log(`\\nWarnings: ${results.summary.warnings.length}`);
    results.summary.warnings.forEach((warning, i) => {
      console.log(`  ${i + 1}. ${warning}`);
    });
  }

  // Save results
  const outputPath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/belgica-kbr-tile-engine-test-results.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\\nDetailed results saved to: ${outputPath}`);

  return results;
}

if (require.main === module) {
  testBelgicaKbrTileEngine()
    .then((results) => {
      process.exit(results.summary.failedTests > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testBelgicaKbrTileEngine };