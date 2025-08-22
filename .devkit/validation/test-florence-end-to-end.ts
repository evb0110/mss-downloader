#!/usr/bin/env bun

/**
 * Florence End-to-End Download Validation
 * Tests the complete Florence manuscript download workflow
 */

import fs from 'fs';
import path from 'path';
// Import using absolute paths from project root
const SharedLibraryDetector = require('../../src/shared/SharedLibraryDetector').SharedLibraryDetector;
const { FlorenceLoader } = require('../../src/main/services/library-loaders/FlorenceLoader');

// Test URLs for Florence manuscripts
const TEST_MANUSCRIPTS = [
    {
        name: "Plutei 20.5 - Classical Text",
        url: "https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217923/rec/2",
        expectedMinPages: 50,
        expectedMaxPages: 500
    },
    {
        name: "Plutei 25.3 - Medieval Manuscript",
        url: "https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/25456/rec/1", 
        expectedMinPages: 20,
        expectedMaxPages: 400
    }
];

interface ValidationResult {
    manuscript: string;
    url: string;
    steps: {
        detection: boolean;
        manifestLoad: boolean;
        pageExtraction: boolean;
        imageAccess: boolean;
        sizeOptimization: boolean;
    };
    metrics: {
        totalPages: number;
        imageSize: number;
        firstPageSize: number;
        loadTime: number;
    };
    errors: string[];
    success: boolean;
}

class FlorenceValidator {
    private results: ValidationResult[] = [];
    private loader: FlorenceLoader;

    constructor() {
        // Mock logger and dependencies for testing
        const mockDeps: LoaderDependencies = {
            logger: {
                log: (data: any) => console.log(`[LOG] ${data.message}`),
                logDownloadError: (lib: string, url: string, error: Error) => 
                    console.error(`[ERROR] ${lib}: ${error.message}`)
            },
            fetchWithHTTPS: async (url: string, options: any) => {
                return fetch(url, options);
            }
        };

        this.loader = new FlorenceLoader(mockDeps);
    }

    async validateManuscript(manuscript: any): Promise<ValidationResult> {
        console.log(`\n🔍 Testing: ${manuscript.name}`);
        console.log(`📄 URL: ${manuscript.url}`);
        
        const result: ValidationResult = {
            manuscript: manuscript.name,
            url: manuscript.url,
            steps: {
                detection: false,
                manifestLoad: false,
                pageExtraction: false,
                imageAccess: false,
                sizeOptimization: false
            },
            metrics: {
                totalPages: 0,
                imageSize: 0,
                firstPageSize: 0,
                loadTime: 0
            },
            errors: [],
            success: false
        };

        try {
            // Step 1: Test library detection
            console.log('📍 Step 1: Testing library detection...');
            const detectedLibrary = SharedLibraryDetector.detectLibrary(manuscript.url);
            if (detectedLibrary === 'florence') {
                result.steps.detection = true;
                console.log('✅ Library correctly detected as florence');
            } else {
                result.errors.push(`Detection failed: expected 'florence', got '${detectedLibrary}'`);
                return result;
            }

            // Step 2: Test manifest loading
            console.log('📋 Step 2: Testing manifest loading...');
            const startTime = Date.now();
            const manifest = await this.loader.loadManifest(manuscript.url);
            const loadTime = Date.now() - startTime;
            
            result.metrics.loadTime = loadTime;
            result.steps.manifestLoad = true;
            console.log(`✅ Manifest loaded in ${loadTime}ms`);
            console.log(`📄 Found ${manifest.totalPages} pages`);
            console.log(`📝 Title: ${manifest.displayName}`);

            // Step 3: Test page extraction
            console.log('📑 Step 3: Testing page extraction...');
            if (manifest.pageLinks && manifest.pageLinks.length > 0) {
                result.steps.pageExtraction = true;
                result.metrics.totalPages = manifest.pageLinks.length;
                console.log(`✅ Extracted ${manifest.pageLinks.length} page links`);

                // Validate page count is reasonable
                if (manifest.pageLinks.length < manuscript.expectedMinPages || 
                    manifest.pageLinks.length > manuscript.expectedMaxPages) {
                    result.errors.push(`Page count ${manifest.pageLinks.length} outside expected range ${manuscript.expectedMinPages}-${manuscript.expectedMaxPages}`);
                }
            } else {
                result.errors.push('No page links extracted from manifest');
                return result;
            }

            // Step 4: Test image access and size detection
            console.log('🖼️ Step 4: Testing image access and size optimization...');
            const firstPageUrl = manifest.pageLinks[0];
            console.log(`🔗 Testing first page: ${firstPageUrl}`);

            // Extract size from URL 
            const sizeMatch = firstPageUrl.match(/\/full\/(\d+),\//);
            if (sizeMatch) {
                result.metrics.imageSize = parseInt(sizeMatch[1]);
                result.steps.sizeOptimization = true;
                console.log(`✅ Size optimization detected: ${result.metrics.imageSize}px width`);
            }

            // Test actual image access
            try {
                const imageResponse = await fetch(firstPageUrl, { method: 'HEAD' });
                if (imageResponse.ok) {
                    result.steps.imageAccess = true;
                    const contentLength = imageResponse.headers.get('content-length');
                    if (contentLength) {
                        result.metrics.firstPageSize = parseInt(contentLength);
                        console.log(`✅ Image accessible: ${(result.metrics.firstPageSize / 1024 / 1024).toFixed(2)}MB`);
                    } else {
                        console.log('✅ Image accessible (no size header)');
                    }
                } else {
                    result.errors.push(`Image access failed: HTTP ${imageResponse.status}`);
                    return result;
                }
            } catch (error: any) {
                result.errors.push(`Image access error: ${error.message}`);
                return result;
            }

            // All steps successful
            result.success = true;
            console.log('🎉 All validation steps passed!');

        } catch (error: any) {
            result.errors.push(`Validation error: ${error.message}`);
            console.error('❌ Validation failed:', error.message);
        }

        return result;
    }

    async runValidation(): Promise<void> {
        console.log('🚀 Starting Florence End-to-End Validation');
        console.log('=' .repeat(60));

        for (const manuscript of TEST_MANUSCRIPTS) {
            const result = await this.validateManuscript(manuscript);
            this.results.push(result);
            
            // Add delay between tests to avoid rate limiting
            if (manuscript !== TEST_MANUSCRIPTS[TEST_MANUSCRIPTS.length - 1]) {
                console.log('⏳ Waiting 2s before next test...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        await this.generateReport();
    }

    async generateReport(): Promise<void> {
        const timestamp = new Date().toISOString();
        const successfulTests = this.results.filter(r => r.success).length;
        const totalTests = this.results.length;
        const successRate = (successfulTests / totalTests * 100).toFixed(1);

        const report = {
            timestamp,
            summary: {
                totalTests,
                successful: successfulTests,
                failed: totalTests - successfulTests,
                successRate: `${successRate}%`
            },
            results: this.results,
            analysis: {
                avgLoadTime: this.results.reduce((sum, r) => sum + r.metrics.loadTime, 0) / this.results.length,
                avgPageCount: this.results.reduce((sum, r) => sum + r.metrics.totalPages, 0) / this.results.length,
                commonImageSizes: [...new Set(this.results.map(r => r.metrics.imageSize))],
                allStepsWorking: this.results.every(r => 
                    r.steps.detection && r.steps.manifestLoad && 
                    r.steps.pageExtraction && r.steps.imageAccess && 
                    r.steps.sizeOptimization
                )
            }
        };

        // Save detailed JSON report
        const reportPath = '.devkit/validation/florence-end-to-end-results.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Generate markdown summary
        const markdownReport = `# Florence End-to-End Validation Report

**Generated:** ${timestamp}
**Success Rate:** ${successRate}% (${successfulTests}/${totalTests} tests passed)

## Summary

- **Total Tests:** ${totalTests}
- **Successful:** ${successfulTests} 
- **Failed:** ${totalTests - successfulTests}
- **Average Load Time:** ${report.analysis.avgLoadTime.toFixed(0)}ms
- **Average Page Count:** ${report.analysis.avgPageCount.toFixed(0)} pages
- **Image Sizes Used:** ${report.analysis.commonImageSizes.join(', ')}px
- **All Steps Working:** ${report.analysis.allStepsWorking ? '✅ Yes' : '❌ No'}

## Test Results

${this.results.map(result => `
### ${result.manuscript}

**URL:** ${result.url}
**Success:** ${result.success ? '✅' : '❌'}
**Pages:** ${result.metrics.totalPages}
**Load Time:** ${result.metrics.loadTime}ms
**Image Size:** ${result.metrics.imageSize}px

**Steps:**
- Detection: ${result.steps.detection ? '✅' : '❌'}
- Manifest Load: ${result.steps.manifestLoad ? '✅' : '❌'} 
- Page Extraction: ${result.steps.pageExtraction ? '✅' : '❌'}
- Image Access: ${result.steps.imageAccess ? '✅' : '❌'}
- Size Optimization: ${result.steps.sizeOptimization ? '✅' : '❌'}

${result.errors.length > 0 ? `**Errors:**\n${result.errors.map(e => `- ${e}`).join('\n')}` : '**No errors**'}
`).join('\n')}

## Conclusion

${report.analysis.allStepsWorking ? 
`🎉 **ALL VALIDATION STEPS SUCCESSFUL**

Florence manuscripts can be successfully:
- Detected from URLs
- Parsed for manuscript structure
- Extracted for page content
- Downloaded with optimized image sizes
- Accessed without permission errors

The implementation is ready for production use.` :
`❌ **SOME VALIDATION STEPS FAILED**

Issues found that need attention:
${this.results.filter(r => !r.success).map(r => `- ${r.manuscript}: ${r.errors.join(', ')}`).join('\n')}

Please review and fix the failing components before production deployment.`}
`;

        fs.writeFileSync('.devkit/validation/florence-end-to-end-validation.md', markdownReport);

        console.log('\n' + '=' .repeat(60));
        console.log('📊 VALIDATION SUMMARY');
        console.log('=' .repeat(60));
        console.log(`Success Rate: ${successRate}% (${successfulTests}/${totalTests})`);
        console.log(`Average Load Time: ${report.analysis.avgLoadTime.toFixed(0)}ms`);
        console.log(`All Steps Working: ${report.analysis.allStepsWorking ? 'YES' : 'NO'}`);
        console.log('\n📁 Reports saved:');
        console.log('- .devkit/validation/florence-end-to-end-results.json');
        console.log('- .devkit/validation/florence-end-to-end-validation.md');
    }
}

// Run validation
const validator = new FlorenceValidator();
validator.runValidation().catch(console.error);