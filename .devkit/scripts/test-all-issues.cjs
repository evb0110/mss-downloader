#!/usr/bin/env node

/**
 * COMPREHENSIVE ISSUE TESTING FRAMEWORK
 * 
 * Tests ALL open GitHub issues using ACTUAL production code from SharedManifestLoaders.js
 * Uses EXACT user URLs without modification
 * Reports which issues are actually fixed vs still failing
 */

const fs = require('fs');
const path = require('path');

// Import the ACTUAL production SharedManifestLoaders
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

class IssueTestRunner {
    constructor() {
        this.loaders = new SharedManifestLoaders();
        this.results = [];
    }

    // Issue test definitions with EXACT user URLs and expected behaviors
    getIssueTests() {
        return [
            {
                number: 2,
                title: "Graz University",
                description: "University of Graz IPC timeout and manifest parsing errors",
                urls: [
                    "https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688",
                    "https://unipub.uni-graz.at/obvugrscript/content/titleinfo/6568472",
                    "https://unipub.uni-graz.at/obvugrscript/content/titleinfo/6840185"
                ],
                expectedError: null,
                errorKeywords: ["висит", "javascript error", "не может закачать манифест"],
                status: "CLAIMED_FIXED_V1.4.125"
            },
            {
                number: 4,
                title: "Morgan Library",
                description: "ReferenceError: imagesByPriority is not defined and incomplete page detection",
                urls: [
                    "https://www.themorgan.org/collection/lindau-gospels/thumbs",
                    "https://host.themorgan.org/facsimile/m1/default.asp?id=1&width=100%25&height=100%25&iframe=true"
                ],
                expectedError: "ReferenceError: imagesByPriority is not defined",
                errorKeywords: ["ReferenceError", "imagesByPriority", "видит только 16 страниц"],
                status: "MULTIPLE_FIXES_ATTEMPTED"
            },
            {
                number: 5,
                title: "Florence",
                description: "connect ETIMEDOUT and manifest only showing 1 page out of 316",
                urls: [
                    "https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/",
                    "https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317539/",
                    "https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/174871/"
                ],
                expectedError: "connect ETIMEDOUT",
                errorKeywords: ["ETIMEDOUT", "висит на загрузке манифеста", "только одну страницу"],
                status: "PERSISTENT_ISSUES"
            },
            {
                number: 6,
                title: "Bordeaux",
                description: "Unsupported library and hanging on calculation, sees only 50 pages",
                urls: [
                    "https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778"
                ],
                expectedError: "Unsupported library",
                errorKeywords: ["Unsupported library", "висит на калькуляции", "видит только 50 страниц"],
                status: "RECENT_FIX_CLAIMED"
            },
            {
                number: 9,
                title: "BDL Italy",
                description: "getaddrinfo ENOTFOUND www.bdl.servizirl.it",
                urls: [
                    "https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903"
                ],
                expectedError: "getaddrinfo ENOTFOUND www.bdl.servizirl.it",
                errorKeywords: ["ENOTFOUND", "www.bdl.servizirl.it"],
                status: "CLAIMED_FIXED_V1.4.124"
            },
            {
                number: 10,
                title: "Zurich e-manuscripta",
                description: "Page ordering wrong, sees only 11 pages instead of all manuscript pages",
                urls: [
                    "https://www.e-manuscripta.ch/bau/content/zoom/5157616",
                    "https://www.e-manuscripta.ch/zuz/doi/10.7891/e-manuscripta-13221"
                ],
                expectedError: "AbortError: This operation was aborted",
                errorKeywords: ["висит на калькуляции", "видит только 11 страниц", "AbortError"],
                status: "CLAIMED_FIXED_V1.4.127_and_V1.4.128"
            },
            {
                number: 11,
                title: "BNE Spain",
                description: "Hangs on calculation, sees only 100 pages instead of 438",
                urls: [
                    "https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1"
                ],
                expectedError: null,
                errorKeywords: ["висит на калькуляции", "только 100 страниц", "из 438"],
                status: "MULTIPLE_FIXES_ATTEMPTED_V1.4.120_to_LATEST"
            }
        ];
    }

    async testIssue(issue) {
        console.log(`\n🔍 Testing Issue #${issue.number}: ${issue.title}`);
        console.log(`Description: ${issue.description}`);
        console.log(`Status: ${issue.status}`);
        
        const testResults = {
            issueNumber: issue.number,
            title: issue.title,
            status: issue.status,
            urls: [],
            overallResult: 'UNKNOWN',
            errors: [],
            summary: ''
        };

        for (const url of issue.urls) {
            console.log(`\n  Testing URL: ${url}`);
            const urlResult = await this.testSingleUrl(url);
            testResults.urls.push(urlResult);
            
            // Check if this matches expected errors
            if (issue.expectedError && urlResult.error && urlResult.error.includes(issue.expectedError)) {
                console.log(`  ❌ STILL HAS EXPECTED ERROR: ${issue.expectedError}`);
            } else if (issue.expectedError && !urlResult.error) {
                console.log(`  ✅ EXPECTED ERROR FIXED: ${issue.expectedError}`);
            }

            // Check for error keywords from user reports
            if (urlResult.error) {
                const hasKnownError = issue.errorKeywords.some(keyword => 
                    urlResult.error.toLowerCase().includes(keyword.toLowerCase())
                );
                if (hasKnownError) {
                    console.log(`  ❌ MATCHES USER-REPORTED ERROR PATTERN`);
                }
            }
        }

        // Determine overall result
        const failedUrls = testResults.urls.filter(u => u.status === 'FAILED');
        const successfulUrls = testResults.urls.filter(u => u.status === 'SUCCESS');
        
        if (failedUrls.length === 0) {
            testResults.overallResult = 'FULLY_FIXED';
            testResults.summary = `All ${testResults.urls.length} URLs working correctly`;
        } else if (failedUrls.length === testResults.urls.length) {
            testResults.overallResult = 'STILL_BROKEN';
            testResults.summary = `All ${testResults.urls.length} URLs failing`;
        } else {
            testResults.overallResult = 'PARTIALLY_FIXED';
            testResults.summary = `${successfulUrls.length}/${testResults.urls.length} URLs working`;
        }

        testResults.errors = failedUrls.map(u => u.error);
        
        console.log(`\n  📊 RESULT: ${testResults.overallResult}`);
        console.log(`  📝 SUMMARY: ${testResults.summary}`);
        
        return testResults;
    }

    async testSingleUrl(url) {
        const result = {
            url: url,
            status: 'UNKNOWN',
            error: null,
            manifestSize: 0,
            pageCount: 0,
            timeTaken: 0
        };

        const startTime = Date.now();
        
        try {
            console.log(`    🔄 Loading manifest...`);
            
            // Use the actual production method to determine library and get manifest
            const libraryId = await this.detectLibrary(url);
            console.log(`    📚 Detected library: ${libraryId}`);
            
            const manifest = await this.loaders.getManifestForLibrary(libraryId, url);
            
            result.timeTaken = Date.now() - startTime;
            result.manifestSize = JSON.stringify(manifest).length;
            result.pageCount = manifest.images ? manifest.images.length : 0;
            result.status = 'SUCCESS';
            
            console.log(`    ✅ SUCCESS - ${result.pageCount} pages found (${result.timeTaken}ms)`);
            
        } catch (error) {
            result.timeTaken = Date.now() - startTime;
            result.error = error.message;
            result.status = 'FAILED';
            
            console.log(`    ❌ FAILED - ${error.message} (${result.timeTaken}ms)`);
            
            // Check for specific error patterns that indicate hanging vs actual errors
            if (result.timeTaken > 30000) {
                result.error += ' [TIMEOUT_OR_HANGING]';
            }
        }
        
        return result;
    }

    async detectLibrary(url) {
        // Replicate the library detection logic from the production code
        if (url.includes('bdl.servizirl.it')) return 'bdl';
        if (url.includes('nuovabibliotecamanoscritta.it')) return 'verona';
        if (url.includes('manuscriptorium.com')) return 'vienna-manuscripta';
        if (url.includes('bdh-rd.bne.es')) return 'bne';
        if (url.includes('digital.blb-karlsruhe.de') || url.includes('i3f.vls.io')) return 'karlsruhe';
        if (url.includes('loc.gov')) return 'library-of-congress';
        if (url.includes('unipub.uni-graz.at') || url.includes('gams.uni-graz.at')) return 'graz';
        if (url.includes('mdc.csuc.cat')) return 'mdc-catalunya';
        if (url.includes('bibliotecavirtualpatrimoniobibliografico.es')) return 'bvpb';
        if (url.includes('themorgan.org')) return 'morgan';
        if (url.includes('digital.ulb.hhu.de')) return 'hhu';
        if (url.includes('gams.uni-graz.at')) return 'gams';
        if (url.includes('cdm21059.contentdm.oclc.org')) return 'florence';
        if (url.includes('bmvr.bm-grenoble.fr')) return 'grenoble';
        if (url.includes('iiif.library.manchester.ac.uk')) return 'manchester';
        if (url.includes('digitale-sammlungen.de')) return 'munich';
        if (url.includes('collections.library.utoronto.ca')) return 'toronto';
        if (url.includes('digi.vatlib.it')) return 'vatican';
        if (url.includes('selene.bordeaux.fr')) return 'bordeaux';
        if (url.includes('digital.bodleian.ox.ac.uk')) return 'bodleian';
        if (url.includes('e-manuscripta.ch')) return 'e_manuscripta';
        if (url.includes('digi.ub.uni-heidelberg.de') || url.includes('doi.org/10.11588/diglit')) return 'heidelberg';
        if (url.includes('nb.no')) return 'norwegian';
        
        throw new Error(`Unsupported library for URL: ${url}`);
    }

    async runAllTests() {
        console.log('🚀 STARTING COMPREHENSIVE GITHUB ISSUES TESTING');
        console.log('Using ACTUAL production code from SharedManifestLoaders.js');
        console.log('Testing EXACT user URLs without modification\n');
        
        const issues = this.getIssueTests();
        
        for (const issue of issues) {
            const result = await this.testIssue(issue);
            this.results.push(result);
            
            // Add delay between tests to avoid overwhelming servers
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        this.generateReport();
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 COMPREHENSIVE ISSUE TESTING REPORT');
        console.log('='.repeat(80));
        
        const fixed = this.results.filter(r => r.overallResult === 'FULLY_FIXED');
        const stillBroken = this.results.filter(r => r.overallResult === 'STILL_BROKEN');
        const partiallyFixed = this.results.filter(r => r.overallResult === 'PARTIALLY_FIXED');
        
        console.log(`\n📈 SUMMARY:`);
        console.log(`  ✅ FULLY FIXED: ${fixed.length} issues`);
        console.log(`  🔶 PARTIALLY FIXED: ${partiallyFixed.length} issues`);
        console.log(`  ❌ STILL BROKEN: ${stillBroken.length} issues`);
        console.log(`  📊 TOTAL TESTED: ${this.results.length} issues`);
        
        console.log(`\n✅ FULLY FIXED ISSUES:`);
        fixed.forEach(r => {
            console.log(`  Issue #${r.issueNumber}: ${r.title} - ${r.summary}`);
        });
        
        console.log(`\n🔶 PARTIALLY FIXED ISSUES:`);
        partiallyFixed.forEach(r => {
            console.log(`  Issue #${r.issueNumber}: ${r.title} - ${r.summary}`);
            r.errors.forEach(error => console.log(`    ❌ Error: ${error}`));
        });
        
        console.log(`\n❌ STILL BROKEN ISSUES:`);
        stillBroken.forEach(r => {
            console.log(`  Issue #${r.issueNumber}: ${r.title} - ${r.summary}`);
            console.log(`    Status: ${r.status}`);
            r.errors.forEach(error => console.log(`    ❌ Error: ${error}`));
        });
        
        console.log(`\n🎯 PRIORITY RECOMMENDATIONS:`);
        
        const highPriority = stillBroken.filter(r => r.status.includes('CLAIMED_FIXED'));
        if (highPriority.length > 0) {
            console.log(`\n  🔥 ULTRA HIGH PRIORITY - Issues claimed fixed but still failing:`);
            highPriority.forEach(r => {
                console.log(`    #${r.issueNumber} (${r.title}) - ${r.status}`);
            });
        }
        
        const mediumPriority = stillBroken.filter(r => !r.status.includes('CLAIMED_FIXED'));
        if (mediumPriority.length > 0) {
            console.log(`\n  🔶 MEDIUM PRIORITY - Known ongoing issues:`);
            mediumPriority.forEach(r => {
                console.log(`    #${r.issueNumber} (${r.title})`);
            });
        }
        
        if (partiallyFixed.length > 0) {
            console.log(`\n  📋 INVESTIGATION NEEDED - Partially working issues:`);
            partiallyFixed.forEach(r => {
                console.log(`    #${r.issueNumber} (${r.title}) - Some URLs work, others fail`);
            });
        }
        
        // Save detailed results to file
        const resultsPath = path.join(__dirname, '../reports/issue-test-results.json');
        fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));
        
        console.log(`\n💾 Detailed results saved to: ${resultsPath}`);
        console.log('\n' + '='.repeat(80));
    }
}

// Run the tests
async function main() {
    try {
        const runner = new IssueTestRunner();
        await runner.runAllTests();
    } catch (error) {
        console.error('❌ CRITICAL TEST FRAMEWORK ERROR:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { IssueTestRunner };