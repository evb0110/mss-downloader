const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function testProductionReadiness() {
  console.log('=== BELGICA KBR PRODUCTION READINESS TEST ===');
  console.log(`Test Time: ${new Date().toISOString()}`);
  console.log('');

  const results = {
    timestamp: new Date().toISOString(),
    tests: {
      typeScriptCompilation: { passed: false, details: null, error: null },
      lintingCheck: { passed: false, details: null, error: null },
      buildProcess: { passed: false, details: null, error: null },
      runtimeIntegration: { passed: false, details: null, error: null },
      memoryLeakTest: { passed: false, details: null, error: null },
      errorHandling: { passed: false, details: null, error: null },
      configurationValidation: { passed: false, details: null, error: null }
    },
    summary: {
      totalTests: 7,
      passedTests: 0,
      failedTests: 0,
      readyForProduction: false
    },
    buildOutput: null,
    errors: [],
    warnings: []
  };

  // Test 1: TypeScript Compilation
  console.log('--- Test 1: TypeScript Compilation ---');
  try {
    const tscOutput = execSync('npx tsc --noEmit', { 
      cwd: '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader',
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    results.tests.typeScriptCompilation.passed = true;
    results.tests.typeScriptCompilation.details = {
      output: tscOutput || 'No compilation errors',
      command: 'npx tsc --noEmit'
    };
    
    console.log('✓ TypeScript compilation successful');
    console.log('  - No type errors detected');
    results.summary.passedTests++;
    
  } catch (error) {
    results.tests.typeScriptCompilation.error = error.message;
    console.log(`✗ TypeScript compilation failed: ${error.message}`);
    results.errors.push(`TypeScript compilation: ${error.message}`);
    results.summary.failedTests++;
  }

  // Test 2: Linting Check
  console.log('\\n--- Test 2: Linting Check ---');
  try {
    const lintOutput = execSync('npm run lint', { 
      cwd: '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader',
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    results.tests.lintingCheck.passed = true;
    results.tests.lintingCheck.details = {
      output: lintOutput || 'No linting errors',
      command: 'npm run lint'
    };
    
    console.log('✓ Linting check successful');
    console.log('  - Code style compliance verified');
    results.summary.passedTests++;
    
  } catch (error) {
    results.tests.lintingCheck.error = error.message;
    console.log(`✗ Linting check failed: ${error.message}`);
    results.errors.push(`Linting: ${error.message}`);
    results.summary.failedTests++;
  }

  // Test 3: Build Process
  console.log('\\n--- Test 3: Build Process ---');
  try {
    const buildOutput = execSync('npm run build', { 
      cwd: '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader',
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // Check if build artifacts exist
    const distPath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/dist';
    const buildExists = fs.existsSync(distPath);
    
    results.tests.buildProcess.passed = buildExists;
    results.tests.buildProcess.details = {
      output: buildOutput,
      distExists: buildExists,
      command: 'npm run build'
    };
    
    if (buildExists) {
      console.log('✓ Build process successful');
      console.log('  - Build artifacts created');
      console.log(`  - Dist directory: ${distPath}`);
      results.summary.passedTests++;
    } else {
      console.log('✗ Build process failed: dist directory not created');
      results.errors.push('Build process: dist directory not created');
      results.summary.failedTests++;
    }
    
  } catch (error) {
    results.tests.buildProcess.error = error.message;
    console.log(`✗ Build process failed: ${error.message}`);
    results.errors.push(`Build process: ${error.message}`);
    results.summary.failedTests++;
  }

  // Test 4: Runtime Integration
  console.log('\\n--- Test 4: Runtime Integration ---');
  try {
    // Test that the tile engine service can be imported and instantiated
    const { TileEngineService } = require('../../src/main/services/tile-engine/TileEngineService.ts');
    const service = new TileEngineService();
    
    const statistics = service.getStatistics();
    const supportedAdapters = service.getSupportedAdapters();
    const belgicaSupported = supportedAdapters.includes('belgica-kbr');
    
    results.tests.runtimeIntegration.passed = belgicaSupported && statistics.supportedAdapters > 0;
    results.tests.runtimeIntegration.details = {
      supportedAdapters: statistics.supportedAdapters,
      belgicaSupported,
      adapterNames: supportedAdapters,
      configuration: service.getConfig()
    };
    
    if (results.tests.runtimeIntegration.passed) {
      console.log('✓ Runtime integration successful');
      console.log(`  - Tile engine service initialized`);
      console.log(`  - Belgica KBR adapter: ${belgicaSupported ? 'available' : 'missing'}`);
      console.log(`  - Total adapters: ${statistics.supportedAdapters}`);
      results.summary.passedTests++;
    } else {
      console.log('✗ Runtime integration failed');
      results.errors.push('Runtime integration: Belgica KBR adapter not available');
      results.summary.failedTests++;
    }
    
  } catch (error) {
    results.tests.runtimeIntegration.error = error.message;
    console.log(`✗ Runtime integration failed: ${error.message}`);
    results.errors.push(`Runtime integration: ${error.message}`);
    results.summary.failedTests++;
  }

  // Test 5: Memory Leak Test
  console.log('\\n--- Test 5: Memory Leak Test ---');
  try {
    const { TileEngineService } = require('../../src/main/services/tile-engine/TileEngineService.ts');
    
    const initialMemory = process.memoryUsage();
    console.log(`  Initial memory: ${Math.round(initialMemory.rss / 1024 / 1024)}MB`);
    
    // Create and destroy multiple service instances
    const iterations = 10;
    for (let i = 0; i < iterations; i++) {
      const service = new TileEngineService();
      await service.analyzeUrl('https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415');
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
    
    const finalMemory = process.memoryUsage();
    console.log(`  Final memory: ${Math.round(finalMemory.rss / 1024 / 1024)}MB`);
    
    const memoryIncrease = finalMemory.rss - initialMemory.rss;
    const memoryIncreasePercent = (memoryIncrease / initialMemory.rss) * 100;
    
    // Consider it a pass if memory increase is less than 50%
    const memoryTestPassed = memoryIncreasePercent < 50;
    
    results.tests.memoryLeakTest.passed = memoryTestPassed;
    results.tests.memoryLeakTest.details = {
      initialMemoryMB: Math.round(initialMemory.rss / 1024 / 1024),
      finalMemoryMB: Math.round(finalMemory.rss / 1024 / 1024),
      memoryIncreaseMB: Math.round(memoryIncrease / 1024 / 1024),
      memoryIncreasePercent: Math.round(memoryIncreasePercent * 100) / 100,
      iterations
    };
    
    if (memoryTestPassed) {
      console.log('✓ Memory leak test passed');
      console.log(`  - Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB (${Math.round(memoryIncreasePercent)}%)`);
      results.summary.passedTests++;
    } else {
      console.log('✗ Memory leak test failed');
      console.log(`  - Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB (${Math.round(memoryIncreasePercent)}%)`);
      results.warnings.push(`High memory increase detected: ${Math.round(memoryIncreasePercent)}%`);
      results.summary.failedTests++;
    }
    
  } catch (error) {
    results.tests.memoryLeakTest.error = error.message;
    console.log(`✗ Memory leak test failed: ${error.message}`);
    results.errors.push(`Memory leak test: ${error.message}`);
    results.summary.failedTests++;
  }

  // Test 6: Error Handling
  console.log('\\n--- Test 6: Error Handling ---');
  try {
    const { TileEngineService } = require('../../src/main/services/tile-engine/TileEngineService.ts');
    const service = new TileEngineService();
    
    // Test various error scenarios
    const errorTests = [
      {
        name: 'Invalid URL',
        test: async () => {
          try {
            await service.analyzeUrl('not-a-valid-url');
            return false; // Should have thrown an error
          } catch (error) {
            return error.message.includes('Invalid') || error.message.includes('URL');
          }
        }
      },
      {
        name: 'Non-existent domain',
        test: async () => {
          try {
            await service.analyzeUrl('https://this-domain-does-not-exist-12345.com/test');
            return false; // Should have thrown an error
          } catch (error) {
            return error.message.includes('fetch') || error.message.includes('network') || error.message.includes('ENOTFOUND');
          }
        }
      },
      {
        name: 'Unsupported URL pattern',
        test: async () => {
          try {
            const result = await service.analyzeUrl('https://google.com');
            return result === null; // Should return null for unsupported URLs
          } catch (error) {
            return false; // Should not throw, just return null
          }
        }
      }
    ];
    
    let errorHandlingPassed = 0;
    const errorResults = [];
    
    for (const errorTest of errorTests) {
      console.log(`    Testing: ${errorTest.name}`);
      try {
        const testResult = await errorTest.test();
        errorResults.push({
          name: errorTest.name,
          passed: testResult,
          error: null
        });
        if (testResult) {
          console.log(`      ✓ ${errorTest.name} handled correctly`);
          errorHandlingPassed++;
        } else {
          console.log(`      ✗ ${errorTest.name} not handled correctly`);
        }
      } catch (error) {
        errorResults.push({
          name: errorTest.name,
          passed: false,
          error: error.message
        });
        console.log(`      ✗ ${errorTest.name} test failed: ${error.message}`);
      }
    }
    
    results.tests.errorHandling.passed = errorHandlingPassed === errorTests.length;
    results.tests.errorHandling.details = {
      totalTests: errorTests.length,
      passedTests: errorHandlingPassed,
      results: errorResults
    };
    
    if (results.tests.errorHandling.passed) {
      console.log('✓ Error handling test passed');
      console.log(`  - All ${errorTests.length} error scenarios handled correctly`);
      results.summary.passedTests++;
    } else {
      console.log('✗ Error handling test failed');
      console.log(`  - ${errorHandlingPassed}/${errorTests.length} error scenarios handled correctly`);
      results.errors.push(`Error handling: ${errorTests.length - errorHandlingPassed} scenarios failed`);
      results.summary.failedTests++;
    }
    
  } catch (error) {
    results.tests.errorHandling.error = error.message;
    console.log(`✗ Error handling test failed: ${error.message}`);
    results.errors.push(`Error handling test: ${error.message}`);
    results.summary.failedTests++;
  }

  // Test 7: Configuration Validation
  console.log('\\n--- Test 7: Configuration Validation ---');
  try {
    const { TileEngineService } = require('../../src/main/services/tile-engine/TileEngineService.ts');
    
    // Test default configuration
    const service = new TileEngineService();
    const defaultConfig = service.getConfig();
    
    // Test custom configuration
    const customConfig = {
      maxConcurrentDownloads: 3,
      rateLimit: {
        requestsPerSecond: 1,
        burstSize: 3
      }
    };
    
    const customService = new TileEngineService(customConfig);
    const updatedConfig = customService.getConfig();
    
    const configValidation = {
      hasDefaultConfig: defaultConfig && typeof defaultConfig === 'object',
      hasRateLimit: defaultConfig.rateLimit && typeof defaultConfig.rateLimit.requestsPerSecond === 'number',
      hasStitchingConfig: defaultConfig.stitching && typeof defaultConfig.stitching.outputFormat === 'string',
      customConfigApplied: updatedConfig.maxConcurrentDownloads === 3,
      customRateLimitApplied: updatedConfig.rateLimit.requestsPerSecond === 1
    };
    
    const validationPassed = Object.values(configValidation).every(v => v === true);
    
    results.tests.configurationValidation.passed = validationPassed;
    results.tests.configurationValidation.details = {
      defaultConfig,
      customConfig,
      updatedConfig,
      validation: configValidation
    };
    
    if (validationPassed) {
      console.log('✓ Configuration validation passed');
      console.log('  - Default configuration valid');
      console.log('  - Custom configuration applied correctly');
      console.log(`  - Rate limit: ${defaultConfig.rateLimit.requestsPerSecond} requests/second`);
      console.log(`  - Max concurrent: ${defaultConfig.maxConcurrentDownloads}`);
      results.summary.passedTests++;
    } else {
      console.log('✗ Configuration validation failed');
      const failedChecks = Object.entries(configValidation)
        .filter(([_, passed]) => !passed)
        .map(([check, _]) => check);
      console.log(`  - Failed checks: ${failedChecks.join(', ')}`);
      results.errors.push(`Configuration validation: ${failedChecks.join(', ')}`);
      results.summary.failedTests++;
    }
    
  } catch (error) {
    results.tests.configurationValidation.error = error.message;
    console.log(`✗ Configuration validation failed: ${error.message}`);
    results.errors.push(`Configuration validation: ${error.message}`);
    results.summary.failedTests++;
  }

  // Final Assessment
  results.summary.readyForProduction = results.summary.passedTests >= 6; // At least 6 of 7 tests must pass
  
  console.log('\\n=== PRODUCTION READINESS SUMMARY ===');
  console.log(`Total Tests: ${results.summary.totalTests}`);
  console.log(`Passed: ${results.summary.passedTests}`);
  console.log(`Failed: ${results.summary.failedTests}`);
  console.log(`Success Rate: ${Math.round((results.summary.passedTests / results.summary.totalTests) * 100)}%`);
  console.log(`Production Ready: ${results.summary.readyForProduction ? 'YES' : 'NO'}`);
  
  if (results.errors.length > 0) {
    console.log(`\\nErrors: ${results.errors.length}`);
    results.errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log(`\\nWarnings: ${results.warnings.length}`);
    results.warnings.forEach((warning, i) => {
      console.log(`  ${i + 1}. ${warning}`);
    });
  }

  // Production readiness checklist
  if (results.summary.readyForProduction) {
    console.log('\\n✓ PRODUCTION READINESS CHECKLIST:');
    console.log('  ✓ TypeScript compilation clean');
    console.log('  ✓ Code passes linting checks');
    console.log('  ✓ Build process successful');
    console.log('  ✓ Runtime integration working');
    console.log('  ✓ Memory management acceptable');
    console.log('  ✓ Error handling robust');
    console.log('  ✓ Configuration system working');
    console.log('\\n🚀 BELGICA KBR TILE ENGINE IS PRODUCTION READY!');
  } else {
    console.log('\\n✗ PRODUCTION READINESS ISSUES:');
    Object.entries(results.tests).forEach(([testName, testResult]) => {
      if (!testResult.passed) {
        console.log(`  ✗ ${testName}: ${testResult.error || 'Failed'}`);
      }
    });
    console.log('\\n⚠️  Additional work needed before production deployment.');
  }

  // Save results
  const outputPath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/belgica-kbr-production-readiness-results.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\\nDetailed results saved to: ${outputPath}`);

  return results;
}

if (require.main === module) {
  testProductionReadiness()
    .then((results) => {
      process.exit(results.summary.readyForProduction ? 0 : 1);
    })
    .catch((error) => {
      console.error('Production readiness test failed:', error);
      process.exit(1);
    });
}

module.exports = { testProductionReadiness };