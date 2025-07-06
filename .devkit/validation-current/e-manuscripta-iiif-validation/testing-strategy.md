# E-Manuscripta IIIF Implementation Testing Strategy

## Overview

This testing strategy ensures the new IIIF implementation works correctly while maintaining backward compatibility with all existing E-Manuscripta URL patterns.

## Test Categories

### 1. IIIF Primary Method Tests

#### 1.1 Direct IIIF Manifest URLs
- **Test**: `https://www.e-manuscripta.ch/i3f/v20/5157222/manifest`
- **Expected**: Should use new IIIF method, return 404 pages
- **Validation**: Check that console logs show "IIIF manifest loaded successfully"

#### 1.2 Invalid IIIF Manifest IDs
- **Test**: `https://www.e-manuscripta.ch/i3f/v20/9999999/manifest`
- **Expected**: Should fail with 404, fallback to legacy (which should also fail)
- **Validation**: Check error handling and fallback attempt

#### 1.3 Maximum Resolution Verification
- **Test**: Compare image sizes between IIIF and legacy URLs
- **IIIF URL**: `{service_id}/full/full/0/default.jpg`
- **Legacy URL**: `https://www.e-manuscripta.ch/{library}/download/webcache/0/{pageId}`
- **Expected**: IIIF images should be larger or equal in file size

### 2. Backward Compatibility Tests

#### 2.1 Legacy Titleinfo URLs (Multi-block)
- **Test**: `https://www.e-manuscripta.ch/zuz/content/titleinfo/5157222`
- **Expected**: Should try IIIF first, then fallback to complex multi-block parsing
- **Validation**: Check both IIIF attempt and successful legacy processing

#### 2.2 Legacy Zoom URLs (Single page context)
- **Test**: `https://www.e-manuscripta.ch/zuz/content/zoom/5157222`
- **Expected**: Should try IIIF first (succeed), skip legacy parsing
- **Validation**: Check that legacy fallback is NOT called

#### 2.3 Legacy Thumbview URLs (Individual blocks)
- **Test**: `https://www.e-manuscripta.ch/zuz/content/thumbview/5157222`
- **Expected**: Should try IIIF first, then fallback to thumbview parsing
- **Validation**: Check fallback behavior for block-specific URLs

### 3. Edge Case Testing

#### 3.1 ID Extraction from Various URL Formats
```javascript
const testUrls = [
    'https://www.e-manuscripta.ch/zuz/content/zoom/5157222',
    'https://www.e-manuscripta.ch/bau/content/titleinfo/1234567',
    'https://www.e-manuscripta.ch/gsg/content/thumbview/987654',
    'https://www.e-manuscripta.ch/i3f/v20/5157222/manifest',
    'https://www.e-manuscripta.ch/some-library/anything/5157222?param=value'
];
```
- **Expected**: All should extract correct manuscript ID
- **Validation**: Check `extractEManuscriptaId()` function

#### 3.2 Invalid URL Formats
```javascript
const invalidUrls = [
    'https://www.e-manuscripta.ch/invalid',
    'https://other-site.com/manuscript/123',
    'https://www.e-manuscripta.ch/zuz/content/unknown/123'
];
```
- **Expected**: Should throw clear error messages
- **Validation**: Check error handling in ID extraction

### 4. Performance and Reliability Tests

#### 4.1 IIIF vs Legacy Speed Comparison
- **Test**: Measure time to load manifest for same manuscript ID
- **Method 1**: IIIF manifest fetch + processing
- **Method 2**: Legacy HTML parsing + URL generation
- **Expected**: IIIF should be significantly faster

#### 4.2 Network Error Handling
- **Test**: Simulate network failures during IIIF fetch
- **Expected**: Should gracefully fallback to legacy method
- **Validation**: Check error logging and fallback behavior

#### 4.3 Large Manuscript Handling
- **Test**: Load manuscripts with 500+ pages via both methods
- **Expected**: Both should handle large manuscripts efficiently
- **Validation**: Check memory usage and processing time

## Test Implementation

### Test Script: `.devkit/temp/comprehensive-e-manuscripta-test.cjs`

```javascript
const { EnhancedManuscriptDownloaderService } = require('../../src/main/services/EnhancedManuscriptDownloaderService.js');
const fs = require('fs').promises;
const path = require('path');

class EManuscriptaTestSuite {
    constructor() {
        this.service = new EnhancedManuscriptDownloaderService();
        this.results = [];
    }

    async runAllTests() {
        console.log('🧪 Starting E-Manuscripta IIIF Implementation Test Suite...\n');

        await this.testIIIFPrimaryMethod();
        await this.testBackwardCompatibility();
        await this.testEdgeCases();
        await this.testPerformance();

        await this.generateReport();
    }

    async testIIIFPrimaryMethod() {
        console.log('📋 Testing IIIF Primary Method...');

        // Test 1: Valid IIIF manuscript
        await this.runTest('IIIF Valid Manuscript', async () => {
            const manifest = await this.service.loadEManuscriptaManifest(
                'https://www.e-manuscripta.ch/i3f/v20/5157222/manifest'
            );
            return {
                success: manifest.totalPages === 404,
                details: `Got ${manifest.totalPages} pages, expected 404`,
                manifest: manifest
            };
        });

        // Test 2: Invalid IIIF manuscript (should fallback)
        await this.runTest('IIIF Invalid Manuscript', async () => {
            try {
                await this.service.loadEManuscriptaManifest(
                    'https://www.e-manuscripta.ch/i3f/v20/9999999/manifest'
                );
                return { success: false, details: 'Should have failed' };
            } catch (error) {
                return {
                    success: true,
                    details: `Correctly failed: ${error.message}`
                };
            }
        });

        // Test 3: Resolution comparison
        await this.runTest('IIIF Resolution Comparison', async () => {
            const manifest = await this.service.loadEManuscriptaManifest(
                'https://www.e-manuscripta.ch/i3f/v20/5157222/manifest'
            );
            
            // Check if IIIF URLs use full resolution pattern
            const iiifUrl = manifest.pageLinks[0];
            const usesFullResolution = iiifUrl.includes('/full/full/0/default.jpg');
            
            return {
                success: usesFullResolution,
                details: `IIIF URL pattern: ${iiifUrl}`,
                iiifUrl: iiifUrl
            };
        });
    }

    async testBackwardCompatibility() {
        console.log('📋 Testing Backward Compatibility...');

        // Test 1: Legacy zoom URL
        await this.runTest('Legacy Zoom URL', async () => {
            const manifest = await this.service.loadEManuscriptaManifest(
                'https://www.e-manuscripta.ch/zuz/content/zoom/5157222'
            );
            return {
                success: manifest.totalPages > 0,
                details: `Got ${manifest.totalPages} pages from legacy zoom URL`,
                manifest: manifest
            };
        });

        // Test 2: Legacy titleinfo URL (if available)
        await this.runTest('Legacy Titleinfo URL', async () => {
            try {
                const manifest = await this.service.loadEManuscriptaManifest(
                    'https://www.e-manuscripta.ch/zuz/content/titleinfo/5157222'
                );
                return {
                    success: manifest.totalPages > 0,
                    details: `Got ${manifest.totalPages} pages from titleinfo URL`,
                    manifest: manifest
                };
            } catch (error) {
                return {
                    success: false,
                    details: `Titleinfo URL failed: ${error.message}`
                };
            }
        });

        // Test 3: Legacy thumbview URL
        await this.runTest('Legacy Thumbview URL', async () => {
            try {
                const manifest = await this.service.loadEManuscriptaManifest(
                    'https://www.e-manuscripta.ch/zuz/content/thumbview/5157222'
                );
                return {
                    success: manifest.totalPages > 0,
                    details: `Got ${manifest.totalPages} pages from thumbview URL`,
                    manifest: manifest
                };
            } catch (error) {
                return {
                    success: false,
                    details: `Thumbview URL failed: ${error.message}`
                };
            }
        });
    }

    async testEdgeCases() {
        console.log('📋 Testing Edge Cases...');

        // Test 1: ID extraction from various URL formats
        const testUrls = [
            'https://www.e-manuscripta.ch/zuz/content/zoom/5157222',
            'https://www.e-manuscripta.ch/bau/content/titleinfo/1234567',
            'https://www.e-manuscripta.ch/gsg/content/thumbview/987654',
            'https://www.e-manuscripta.ch/i3f/v20/5157222/manifest'
        ];

        for (const url of testUrls) {
            await this.runTest(`ID Extraction: ${url}`, async () => {
                try {
                    const id = this.service.extractEManuscriptaId(url);
                    return {
                        success: !!id,
                        details: `Extracted ID: ${id}`,
                        extractedId: id
                    };
                } catch (error) {
                    return {
                        success: false,
                        details: `ID extraction failed: ${error.message}`
                    };
                }
            });
        }

        // Test 2: Invalid URL formats
        const invalidUrls = [
            'https://www.e-manuscripta.ch/invalid',
            'https://other-site.com/manuscript/123'
        ];

        for (const url of invalidUrls) {
            await this.runTest(`Invalid URL: ${url}`, async () => {
                try {
                    await this.service.loadEManuscriptaManifest(url);
                    return { success: false, details: 'Should have failed' };
                } catch (error) {
                    return {
                        success: true,
                        details: `Correctly failed: ${error.message}`
                    };
                }
            });
        }
    }

    async testPerformance() {
        console.log('📋 Testing Performance...');

        // Test 1: IIIF loading speed
        await this.runTest('IIIF Loading Speed', async () => {
            const startTime = Date.now();
            const manifest = await this.service.loadEManuscriptaManifest(
                'https://www.e-manuscripta.ch/i3f/v20/5157222/manifest'
            );
            const endTime = Date.now();
            const duration = endTime - startTime;

            return {
                success: duration < 5000, // Should complete in under 5 seconds
                details: `IIIF manifest loaded in ${duration}ms`,
                duration: duration,
                pages: manifest.totalPages
            };
        });

        // Test 2: Memory usage check
        await this.runTest('Memory Usage Check', async () => {
            const memBefore = process.memoryUsage().heapUsed;
            
            const manifest = await this.service.loadEManuscriptaManifest(
                'https://www.e-manuscripta.ch/i3f/v20/5157222/manifest'
            );
            
            const memAfter = process.memoryUsage().heapUsed;
            const memIncrease = memAfter - memBefore;

            return {
                success: memIncrease < 50 * 1024 * 1024, // Less than 50MB increase
                details: `Memory increase: ${Math.round(memIncrease / 1024 / 1024)}MB`,
                memoryIncrease: memIncrease,
                pages: manifest.totalPages
            };
        });
    }

    async runTest(testName, testFunction) {
        try {
            console.log(`  🔄 Running: ${testName}`);
            const result = await testFunction();
            
            if (result.success) {
                console.log(`  ✅ PASS: ${testName} - ${result.details}`);
            } else {
                console.log(`  ❌ FAIL: ${testName} - ${result.details}`);
            }
            
            this.results.push({
                name: testName,
                success: result.success,
                details: result.details,
                data: result
            });
        } catch (error) {
            console.log(`  💥 ERROR: ${testName} - ${error.message}`);
            this.results.push({
                name: testName,
                success: false,
                details: `Exception: ${error.message}`,
                error: error.message
            });
        }
    }

    async generateReport() {
        const totalTests = this.results.length;
        const passedTests = this.results.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;

        console.log('\n📊 Test Results Summary:');
        console.log(`  Total Tests: ${totalTests}`);
        console.log(`  Passed: ${passedTests} ✅`);
        console.log(`  Failed: ${failedTests} ❌`);
        console.log(`  Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

        // Save detailed report
        const reportPath = path.join(__dirname, 'test-results.json');
        await fs.writeFile(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            summary: { totalTests, passedTests, failedTests },
            results: this.results
        }, null, 2));

        console.log(`\n📄 Detailed report saved: ${reportPath}`);

        if (failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            this.results
                .filter(r => !r.success)
                .forEach(r => console.log(`  - ${r.name}: ${r.details}`));
        }
    }
}

// Run the test suite
const testSuite = new EManuscriptaTestSuite();
testSuite.runAllTests().catch(console.error);
```

## Validation Criteria

### Must Pass (Critical)
1. ✅ **IIIF manifest loads successfully** for known manuscript ID 5157222
2. ✅ **Backward compatibility maintained** for all existing URL patterns
3. ✅ **Error handling works** for invalid manuscripts/URLs
4. ✅ **ID extraction works** for all supported URL formats
5. ✅ **Maximum resolution achieved** via IIIF Image API

### Should Pass (Important)
1. 🎯 **Performance improvement** - IIIF faster than legacy parsing
2. 🎯 **Memory efficiency** - No significant memory leaks
3. 🎯 **Graceful fallback** - Legacy method works when IIIF fails
4. 🎯 **Clear error messages** - Users understand what went wrong

### Nice to Have (Optional)
1. 💡 **Progressive enhancement** - Can detect IIIF availability
2. 💡 **Caching optimization** - IIIF manifests cached effectively
3. 💡 **Detailed logging** - Clear debug information for troubleshooting

## Test Execution Plan

### Phase 1: Pre-Implementation Testing
1. Run existing E-Manuscripta tests to establish baseline
2. Verify current functionality works as expected
3. Document current performance metrics

### Phase 2: Post-Implementation Testing
1. Run comprehensive test suite after code changes
2. Compare performance vs baseline
3. Validate all backward compatibility scenarios

### Phase 3: Integration Testing
1. Test within full application context
2. Verify UI displays correctly
3. Test actual PDF download and validation

### Phase 4: User Acceptance Testing
1. Test with real-world manuscript URLs
2. Verify maximum resolution images
3. Confirm user experience improvements

## Success Metrics

- ✅ **100% backward compatibility** - All existing URLs continue to work
- ✅ **Performance improvement** - IIIF method 50%+ faster than legacy
- ✅ **Resolution enhancement** - Images equal or larger than current
- ✅ **Error reduction** - Fewer parsing failures due to HTML changes
- ✅ **Code simplification** - Primary path uses simple IIIF processing

This testing strategy ensures the implementation is robust, maintains compatibility, and provides measurable improvements.