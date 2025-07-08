const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const TEST_SCENARIOS = [
  {
    name: 'Primary test manuscript',
    url: 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415',
    expectedTileUrl: 'https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/16994415_0001/3-0-0.jpg',
    expectedReferrer: 'https://viewerd.kbr.be/display/SYRACUSE/'
  },
  {
    name: 'Alternative manuscript',
    url: 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994416',
    expectedTileUrl: 'https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/16994416_0001/3-0-0.jpg',
    expectedReferrer: 'https://viewerd.kbr.be/display/SYRACUSE/'
  },
  {
    name: 'Different collection',
    url: 'https://belgica.kbr.be/BELGICA/doc/BRUSSELS/17450123',
    expectedTileUrl: 'https://viewerd.kbr.be/display/BRUSSELS/zoomtiles/17450123_0001/3-0-0.jpg',
    expectedReferrer: 'https://viewerd.kbr.be/display/BRUSSELS/'
  }
];

async function validateAdapterPattern() {
  console.log('=== BELGICA KBR ADAPTER PATTERN VALIDATION ===');
  console.log(`Test scenarios: ${TEST_SCENARIOS.length}`);
  console.log(`Test Time: ${new Date().toISOString()}`);
  console.log('');

  const results = {
    timestamp: new Date().toISOString(),
    scenarios: TEST_SCENARIOS,
    validationResults: [],
    summary: {
      totalScenarios: TEST_SCENARIOS.length,
      passedScenarios: 0,
      failedScenarios: 0,
      patternValidation: {
        urlDetection: { passed: 0, failed: 0 },
        tileUrlGeneration: { passed: 0, failed: 0 },
        authenticationConfig: { passed: 0, failed: 0 },
        actualTileAccess: { passed: 0, failed: 0 }
      }
    },
    errors: [],
    warnings: []
  };

  const { BelgicaKbrAdapter } = require('../../src/main/services/tile-engine/adapters/BelgicaKbrAdapter.ts');
  const adapter = new BelgicaKbrAdapter();

  for (let i = 0; i < TEST_SCENARIOS.length; i++) {
    const scenario = TEST_SCENARIOS[i];
    console.log(`\\n--- Scenario ${i + 1}: ${scenario.name} ---`);
    console.log(`URL: ${scenario.url}`);
    
    const scenarioResult = {
      name: scenario.name,
      url: scenario.url,
      tests: {
        urlValidation: { passed: false, details: null, error: null },
        manuscriptAnalysis: { passed: false, details: null, error: null },
        tileUrlGeneration: { passed: false, details: null, error: null },
        authConfiguration: { passed: false, details: null, error: null },
        actualTileAccess: { passed: false, details: null, error: null }
      },
      overallPassed: false
    };

    // Test 1: URL Validation
    try {
      const isValid = await adapter.validateUrl(scenario.url);
      scenarioResult.tests.urlValidation.passed = isValid;
      scenarioResult.tests.urlValidation.details = { isValid };
      
      if (isValid) {
        console.log('  ✓ URL validation passed');
        results.summary.patternValidation.urlDetection.passed++;
      } else {
        console.log('  ✗ URL validation failed');
        results.summary.patternValidation.urlDetection.failed++;
      }
    } catch (error) {
      scenarioResult.tests.urlValidation.error = error.message;
      console.log(`  ✗ URL validation error: ${error.message}`);
      results.summary.patternValidation.urlDetection.failed++;
    }

    // Test 2: Manuscript Analysis
    try {
      const analysis = await adapter.analyzeManuscriptPage(scenario.url);
      const expectedGrid = { width: 8, height: 10 };
      const gridMatch = analysis.gridWidth === expectedGrid.width && 
                       analysis.gridHeight === expectedGrid.height;
      
      scenarioResult.tests.manuscriptAnalysis.passed = gridMatch;
      scenarioResult.tests.manuscriptAnalysis.details = {
        gridConfig: analysis,
        expectedGrid,
        gridMatch
      };
      
      if (gridMatch) {
        console.log(`  ✓ Manuscript analysis passed: ${analysis.gridWidth}×${analysis.gridHeight} grid`);
      } else {
        console.log(`  ✗ Manuscript analysis failed: expected ${expectedGrid.width}×${expectedGrid.height}, got ${analysis.gridWidth}×${analysis.gridHeight}`);
      }
    } catch (error) {
      scenarioResult.tests.manuscriptAnalysis.error = error.message;
      console.log(`  ✗ Manuscript analysis error: ${error.message}`);
    }

    // Test 3: Tile URL Generation
    try {
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
      
      // Parse the URL to get base URL for tile generation
      const parsed = adapter.parseManuscriptUrl(scenario.url);
      const baseUrl = `https://viewerd.kbr.be/display/${parsed.documentPath}/zoomtiles/${parsed.manuscriptId}_0001/`;
      
      const tileUrls = await adapter.generateTileUrls(baseUrl, gridConfig);
      const expectedTileCount = 80; // 8×10
      const firstTileCorrect = tileUrls[0] === `${baseUrl}3-0-0.jpg`;
      const lastTileCorrect = tileUrls[tileUrls.length - 1] === `${baseUrl}3-7-9.jpg`;
      
      scenarioResult.tests.tileUrlGeneration.passed = 
        tileUrls.length === expectedTileCount && firstTileCorrect && lastTileCorrect;
      scenarioResult.tests.tileUrlGeneration.details = {
        tileCount: tileUrls.length,
        expectedCount: expectedTileCount,
        firstTile: tileUrls[0],
        lastTile: tileUrls[tileUrls.length - 1],
        sampleUrls: tileUrls.slice(0, 5)
      };
      
      if (scenarioResult.tests.tileUrlGeneration.passed) {
        console.log(`  ✓ Tile URL generation passed: ${tileUrls.length} URLs`);
        console.log(`    First: ${tileUrls[0]}`);
        console.log(`    Last: ${tileUrls[tileUrls.length - 1]}`);
        results.summary.patternValidation.tileUrlGeneration.passed++;
      } else {
        console.log(`  ✗ Tile URL generation failed`);
        console.log(`    Expected: ${expectedTileCount} URLs, got: ${tileUrls.length}`);
        results.summary.patternValidation.tileUrlGeneration.failed++;
      }
    } catch (error) {
      scenarioResult.tests.tileUrlGeneration.error = error.message;
      console.log(`  ✗ Tile URL generation error: ${error.message}`);
      results.summary.patternValidation.tileUrlGeneration.failed++;
    }

    // Test 4: Authentication Configuration
    try {
      const parsed = adapter.parseManuscriptUrl(scenario.url);
      const baseUrl = `https://viewerd.kbr.be/display/${parsed.documentPath}/zoomtiles/${parsed.manuscriptId}_0001/`;
      
      const authConfig = await adapter.getAuthConfig(baseUrl);
      const referrerCorrect = authConfig.referrer === scenario.expectedReferrer;
      const hasHeaders = authConfig.customHeaders && Object.keys(authConfig.customHeaders).length > 0;
      
      scenarioResult.tests.authConfiguration.passed = 
        authConfig.type === 'referrer' && referrerCorrect && hasHeaders;
      scenarioResult.tests.authConfiguration.details = {
        authType: authConfig.type,
        referrer: authConfig.referrer,
        expectedReferrer: scenario.expectedReferrer,
        referrerCorrect,
        headerCount: Object.keys(authConfig.customHeaders || {}).length
      };
      
      if (scenarioResult.tests.authConfiguration.passed) {
        console.log(`  ✓ Authentication configuration passed`);
        console.log(`    Type: ${authConfig.type}`);
        console.log(`    Referrer: ${authConfig.referrer}`);
        results.summary.patternValidation.authenticationConfig.passed++;
      } else {
        console.log(`  ✗ Authentication configuration failed`);
        results.summary.patternValidation.authenticationConfig.failed++;
      }
    } catch (error) {
      scenarioResult.tests.authConfiguration.error = error.message;
      console.log(`  ✗ Authentication configuration error: ${error.message}`);
      results.summary.patternValidation.authenticationConfig.failed++;
    }

    // Test 5: Actual Tile Access
    try {
      const testTileUrl = scenario.expectedTileUrl;
      const referrer = scenario.expectedReferrer;
      
      const response = await new Promise((resolve, reject) => {
        const urlObj = new URL(testTileUrl);
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || 443,
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: {
            'Referer': referrer,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
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
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
        req.end();
      });
      
      const isValidJpeg = response.data.length > 0 && 
                         response.data.subarray(0, 2).toString('hex') === 'ffd8';
      const success = response.status === 200 && isValidJpeg && response.data.length > 5000;
      
      scenarioResult.tests.actualTileAccess.passed = success;
      scenarioResult.tests.actualTileAccess.details = {
        httpStatus: response.status,
        contentLength: response.data.length,
        isValidJpeg,
        sizeKB: Math.round(response.data.length / 1024)
      };
      
      if (success) {
        console.log(`  ✓ Actual tile access passed: ${response.status} (${Math.round(response.data.length / 1024)}KB)`);
        results.summary.patternValidation.actualTileAccess.passed++;
      } else {
        console.log(`  ✗ Actual tile access failed: ${response.status} (${response.data.length} bytes)`);
        results.summary.patternValidation.actualTileAccess.failed++;
      }
    } catch (error) {
      scenarioResult.tests.actualTileAccess.error = error.message;
      console.log(`  ✗ Actual tile access error: ${error.message}`);
      results.summary.patternValidation.actualTileAccess.failed++;
    }

    // Overall scenario result
    const testsPassed = Object.values(scenarioResult.tests).filter(test => test.passed).length;
    scenarioResult.overallPassed = testsPassed >= 4; // At least 4 of 5 tests must pass
    
    if (scenarioResult.overallPassed) {
      console.log(`  ✓ Scenario passed: ${testsPassed}/5 tests`);
      results.summary.passedScenarios++;
    } else {
      console.log(`  ✗ Scenario failed: ${testsPassed}/5 tests`);
      results.summary.failedScenarios++;
    }
    
    results.validationResults.push(scenarioResult);
  }

  // Final Summary
  console.log('\\n=== ADAPTER PATTERN VALIDATION SUMMARY ===');
  console.log(`Total Scenarios: ${results.summary.totalScenarios}`);
  console.log(`Passed Scenarios: ${results.summary.passedScenarios}`);
  console.log(`Failed Scenarios: ${results.summary.failedScenarios}`);
  console.log(`Success Rate: ${Math.round((results.summary.passedScenarios / results.summary.totalScenarios) * 100)}%`);
  
  console.log('\\nPattern Validation Breakdown:');
  console.log(`  URL Detection: ${results.summary.patternValidation.urlDetection.passed}/${results.summary.patternValidation.urlDetection.passed + results.summary.patternValidation.urlDetection.failed} passed`);
  console.log(`  Tile URL Generation: ${results.summary.patternValidation.tileUrlGeneration.passed}/${results.summary.patternValidation.tileUrlGeneration.passed + results.summary.patternValidation.tileUrlGeneration.failed} passed`);
  console.log(`  Authentication Config: ${results.summary.patternValidation.authenticationConfig.passed}/${results.summary.patternValidation.authenticationConfig.passed + results.summary.patternValidation.authenticationConfig.failed} passed`);
  console.log(`  Actual Tile Access: ${results.summary.patternValidation.actualTileAccess.passed}/${results.summary.patternValidation.actualTileAccess.passed + results.summary.patternValidation.actualTileAccess.failed} passed`);

  // Save results
  const outputPath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/belgica-kbr-adapter-validation-results.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\\nDetailed results saved to: ${outputPath}`);

  return results;
}

if (require.main === module) {
  validateAdapterPattern()
    .then((results) => {
      process.exit(results.summary.failedScenarios === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('Adapter validation failed:', error);
      process.exit(1);
    });
}

module.exports = { validateAdapterPattern };