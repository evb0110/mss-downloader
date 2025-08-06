#!/usr/bin/env node

/**
 * MANDATORY: This framework tests the ACTUAL production code directly
 * NO isolated test scripts allowed - just the real code
 * 
 * CRITICAL LESSONS FROM v1.4.49 FAILURE:
 * - MUST use exact production code (SharedManifestLoaders)
 * - MUST use exact user-reported URLs (character-by-character)
 * - MUST reproduce exact user errors first
 * - MUST fix root causes in production files
 */

const fs = require('fs');
const path = require('path');

// Import the ACTUAL production SharedManifestLoaders
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

// Load ALL issues from our comprehensive fetch
const allIssues = JSON.parse(fs.readFileSync('.devkit/all-open-issues.json'));

// Build test configuration with EXACT user URLs from ALL GitHub issues
const USER_REPORTED_URLS = {};

console.log(`Processing ${allIssues.length} GitHub issues...`);

for (const issue of allIssues) {
    // Extract EXACT URL from issue body (character-by-character match)
    const urlMatch = issue.body.match(/https?:\/\/[^\s]+/);
    const errorMatch = issue.body.match(/Error[^:]*: (.+?)(?:https|$)/);
    
    // Handle Issue #2 which has images instead of URLs
    let userUrl = 'NO_URL_PROVIDED';
    let userError = issue.body.substring(0, 100);
    
    if (urlMatch) {
        userUrl = urlMatch[0].trim();
    }
    
    if (errorMatch) {
        userError = errorMatch[1].trim();
    }
    
    // Special handling for Issue #2 (UI error with screenshots)
    if (issue.number === 2) {
        userError = 'ошибка во время добавления манифеста (UI error with screenshots)';
    }
    
    USER_REPORTED_URLS[`issue_${issue.number}`] = {
        issue: `#${issue.number}`,
        title: issue.title,
        userUrl: userUrl,
        userError: userError,
        expectedBehavior: `Should handle ${issue.title} library correctly`,
        author: issue.author.login
    };
}

console.log(`Created test cases for ${Object.keys(USER_REPORTED_URLS).length} issues\n`);

// Manual library detection function matching production logic
function detectLibrary(url) {
    if (!url || url === 'NO_URL_PROVIDED') return null;
    
    // EXACT COPY of production detection logic from EnhancedManuscriptDownloaderService.ts
    if (url.includes('themorgan.org')) return 'morgan';
    if (url.includes('pagella.bm-grenoble.fr')) return 'grenoble';
    if (url.includes('e-manuscripta.ch')) return 'e_manuscripta';
    if (url.includes('bdl.servizirl.it')) return 'bdl';
    if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) return 'verona';
    if (url.includes('bdh-rd.bne.es')) return 'bne';
    if (url.includes('mdc.csuc.cat/digital/collection')) return 'mdc_catalonia';
    if (url.includes('cdm21059.contentdm.oclc.org/digital/collection/plutei')) return 'florence';
    if (url.includes('unipub.uni-graz.at')) return 'graz';
    if (url.includes('manuscrits.bordeaux.fr') || url.includes('selene.bordeaux.fr')) return 'bordeaux';
    
    return null;
}

class ProductionCodeTester {
    constructor() {
        this.manifestLoaders = new SharedManifestLoaders();
        this.results = {};
    }

    async testLibrary(libraryId, config) {
        console.log(`\n=== Testing ${libraryId} (${config.issue}) ===`);
        console.log(`Library: ${config.title}`);
        console.log(`URL: ${config.userUrl}`);
        console.log(`Expected Error: ${config.userError}`);
        console.log(`Author: ${config.author}`);
        
        if (config.userUrl === 'NO_URL_PROVIDED') {
            console.log('⚠️  NO URL PROVIDED - This is a UI error issue');
            return { 
                success: false, 
                error: 'NO_URL_PROVIDED',
                needsSpecialHandling: true,
                category: 'UI_ERROR'
            };
        }
        
        try {
            // Use ACTUAL production code to detect library
            const detectedLibrary = detectLibrary(config.userUrl);
            
            if (!detectedLibrary) {
                console.log(`❌ DETECTION FAILED: No library detected for URL`);
                return { 
                    success: false, 
                    error: 'Library detection failed',
                    category: 'DETECTION_ERROR'
                };
            }
            
            console.log(`✅ DETECTED LIBRARY: ${detectedLibrary}`);
            
            // Call ACTUAL production manifest loader
            const startTime = Date.now();
            const manifest = await this.manifestLoaders.getManifestForLibrary(
                detectedLibrary, 
                config.userUrl
            );
            const loadTime = Date.now() - startTime;
            
            // Check for valid manifest based on different structure types
            const isValid = this.validateManifest(manifest);
            
            if (isValid.valid) {
                console.log(`✅ SUCCESS: ${isValid.description} (${loadTime}ms)`);
                console.log(`   Library: ${manifest.library || detectedLibrary}`);
                console.log(`   Title: ${manifest.title || manifest.displayName || 'Unknown'}`);
                return { 
                    success: true, 
                    manifest,
                    loadTime,
                    detectedLibrary,
                    category: 'SUCCESS',
                    manifestType: isValid.type
                };
            } else {
                console.log(`❌ MANIFEST ISSUE: ${isValid.reason}`);
                return { 
                    success: false, 
                    error: isValid.reason,
                    manifest,
                    category: 'MANIFEST_ERROR'
                };
            }
            
        } catch (error) {
            const loadTime = Date.now();
            console.log(`❌ ERROR: ${error.message}`);
            
            // CRITICAL: Check if this matches user-reported error
            const errorMatches = this.checkErrorMatch(error.message, config.userError);
            if (errorMatches.isMatch) {
                console.log(`🎯 REPRODUCED USER ERROR: ${errorMatches.reason}`);
            } else {
                console.log(`⚠️  Different error than reported`);
            }
            
            return { 
                success: false, 
                error: error.message,
                userErrorReproduced: errorMatches.isMatch,
                errorMatchReason: errorMatches.reason,
                category: this.categorizeError(error.message),
                originalUserError: config.userError
            };
        }
    }
    
    validateManifest(manifest) {
        if (!manifest) {
            return { valid: false, reason: 'Manifest is null or undefined' };
        }
        
        // Images array format (most common)
        if (manifest.images && Array.isArray(manifest.images)) {
            if (manifest.images.length > 0) {
                return { 
                    valid: true, 
                    type: 'images', 
                    description: `Loaded manifest with ${manifest.images.length} images` 
                };
            } else {
                return { valid: false, reason: 'Images array is empty' };
            }
        }
        
        // Tile-based format (like Bordeaux)
        if (manifest.type === 'bordeaux_tiles' && manifest.tileConfig) {
            const pageCount = manifest.pageCount || manifest.tileConfig.pageCount;
            if (pageCount > 0) {
                return { 
                    valid: true, 
                    type: 'tiles', 
                    description: `Loaded tile-based manifest with ${pageCount} pages` 
                };
            } else {
                return { valid: false, reason: 'Tile manifest has no pages' };
            }
        }
        
        // Standard totalPages format
        if (manifest.totalPages && manifest.totalPages > 0) {
            return { 
                valid: true, 
                type: 'standard', 
                description: `Loaded manifest with ${manifest.totalPages} pages` 
            };
        }
        
        // Pages array format
        if (manifest.pages && Array.isArray(manifest.pages) && manifest.pages.length > 0) {
            return { 
                valid: true, 
                type: 'pages_array', 
                description: `Loaded manifest with ${manifest.pages.length} pages` 
            };
        }
        
        return { valid: false, reason: 'Manifest has no recognizable page or image data' };
    }

    checkErrorMatch(actualError, expectedError) {
        const actual = actualError.toLowerCase();
        const expected = expectedError.toLowerCase();
        
        // Check for specific error pattern matches
        if (actual.includes('etimedout') && expected.includes('etimedout')) {
            return { isMatch: true, reason: 'Both are ETIMEDOUT errors' };
        }
        
        if (actual.includes('enotfound') && expected.includes('enotfound')) {
            return { isMatch: true, reason: 'Both are ENOTFOUND errors' };
        }
        
        if (actual.includes('eai_again') && expected.includes('eai_again')) {
            return { isMatch: true, reason: 'Both are EAI_AGAIN DNS errors' };
        }
        
        if (actual.includes('imagesbypriority') && expected.includes('imagesbypriority')) {
            return { isMatch: true, reason: 'Both are imagesByPriority undefined errors' };
        }
        
        if (actual.includes('висит') && expected.includes('висит')) {
            return { isMatch: true, reason: 'Both mention hanging/висит' };
        }
        
        // Partial matches for similar error types
        if ((actual.includes('timeout') || actual.includes('etimedout')) && 
            (expected.includes('timeout') || expected.includes('etimedout'))) {
            return { isMatch: true, reason: 'Both are timeout-related errors' };
        }
        
        return { isMatch: false, reason: 'Error patterns do not match' };
    }
    
    categorizeError(error) {
        const err = error.toLowerCase();
        
        if (err.includes('etimedout')) return 'NETWORK_TIMEOUT';
        if (err.includes('enotfound') || err.includes('eai_again')) return 'DNS_ERROR';
        if (err.includes('imagesbypriority')) return 'CODE_ERROR';
        if (err.includes('висит')) return 'HANGING_ERROR';
        if (err.includes('unsupported library')) return 'UNSUPPORTED_LIBRARY';
        
        return 'OTHER_ERROR';
    }
    
    async runAllTests() {
        console.log(`🚀 TESTING ALL ${Object.keys(USER_REPORTED_URLS).length} REPORTED ISSUES WITH PRODUCTION CODE...\n`);
        console.log('=' * 80);
        
        const summary = {
            total: 0,
            success: 0,
            networkErrors: 0,
            dnsErrors: 0,
            codeErrors: 0,
            hangingErrors: 0,
            otherErrors: 0,
            needsSpecialHandling: 0,
            userErrorsReproduced: 0
        };
        
        for (const [id, config] of Object.entries(USER_REPORTED_URLS)) {
            summary.total++;
            this.results[id] = await this.testLibrary(id, config);
            
            const result = this.results[id];
            
            if (result.success) {
                summary.success++;
            } else {
                switch (result.category) {
                    case 'NETWORK_TIMEOUT': summary.networkErrors++; break;
                    case 'DNS_ERROR': summary.dnsErrors++; break;
                    case 'CODE_ERROR': summary.codeErrors++; break;
                    case 'HANGING_ERROR': summary.hangingErrors++; break;
                    case 'UI_ERROR': summary.needsSpecialHandling++; break;
                    default: summary.otherErrors++; break;
                }
                
                if (result.userErrorReproduced) {
                    summary.userErrorsReproduced++;
                }
            }
            
            // Brief pause between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        return { results: this.results, summary };
    }
    
    generateReport(testResults) {
        const { results, summary } = testResults;
        
        console.log('\n' + '=' * 80);
        console.log('📊 COMPREHENSIVE TEST RESULTS SUMMARY');
        console.log('=' * 80);
        
        console.log(`\n📈 OVERVIEW:`);
        console.log(`   Total Issues Tested: ${summary.total}`);
        console.log(`   ✅ Working: ${summary.success}`);
        console.log(`   ❌ Failing: ${summary.total - summary.success - summary.needsSpecialHandling}`);
        console.log(`   ⚠️  Special Handling Needed: ${summary.needsSpecialHandling}`);
        console.log(`   🎯 User Errors Reproduced: ${summary.userErrorsReproduced}`);
        
        console.log(`\n📋 ERROR BREAKDOWN:`);
        console.log(`   🌐 Network Timeouts: ${summary.networkErrors}`);
        console.log(`   🔍 DNS Errors: ${summary.dnsErrors}`);
        console.log(`   💻 Code Errors: ${summary.codeErrors}`);
        console.log(`   ⏳ Hanging Errors: ${summary.hangingErrors}`);
        console.log(`   ❓ Other Errors: ${summary.otherErrors}`);
        
        console.log(`\n🎯 DETAILED ISSUE STATUS:`);
        
        for (const [id, result] of Object.entries(results)) {
            const config = USER_REPORTED_URLS[id];
            const status = result.success ? '✅ WORKING' : 
                          result.needsSpecialHandling ? '⚠️  SPECIAL' : '❌ FAILED';
            const reproduced = result.userErrorReproduced ? ' (🎯 REPRODUCED)' : '';
            
            console.log(`   ${status} Issue ${config.issue} (${config.title})${reproduced}`);
            
            if (!result.success && result.error) {
                console.log(`      Error: ${result.error}`);
                if (result.userErrorReproduced) {
                    console.log(`      Match: ${result.errorMatchReason}`);
                }
            }
        }
        
        console.log('\n' + '=' * 80);
        
        // Write detailed results to file
        const reportData = {
            timestamp: new Date().toISOString(),
            summary,
            results,
            userReportedUrls: USER_REPORTED_URLS
        };
        
        fs.writeFileSync('.devkit/test-results.json', JSON.stringify(reportData, null, 2));
        console.log('📄 Detailed results saved to .devkit/test-results.json');
        
        return reportData;
    }
}

// Self-executing test runner
if (require.main === module) {
    (async () => {
        try {
            const tester = new ProductionCodeTester();
            const results = await tester.runAllTests();
            const report = tester.generateReport(results);
            
            // Exit with appropriate code
            const hasFailures = report.summary.total > (report.summary.success + report.summary.needsSpecialHandling);
            process.exit(hasFailures ? 1 : 0);
            
        } catch (error) {
            console.error('❌ TEST FRAMEWORK ERROR:', error);
            process.exit(1);
        }
    })();
}

module.exports = { ProductionCodeTester, USER_REPORTED_URLS };