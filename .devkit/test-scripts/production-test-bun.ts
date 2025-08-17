#!/usr/bin/env bun

/**
 * Production Code Test using Bun - Verify Current State of Claimed Fixes
 * Tests the ACTUAL production code to check if v1.4.196 fixes are working
 */

import { SharedManifestLoaders } from '../../src/shared/SharedManifestLoaders';
import fs from 'fs';
import path from 'path';

// Test cases from GitHub issues
const TEST_CASES = {
    issue_2: {
        url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/6568472',
        library: 'graz',
        expectedBehavior: 'Should load Graz manuscript without infinite loading'
    },
    issue_4: {
        url: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        library: 'morgan',
        expectedBehavior: 'Should handle Morgan redirects without URL duplication'
    },
    issue_6: {
        url: 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778',
        library: 'bordeaux',
        expectedBehavior: 'Should handle Bordeaux without "Invalid array length" error'
    },
    issue_30: {
        url: 'https://archiviostorico.senato.it/archivio-storico-del-senato/iiif/presentation/IT-AFS-AS00001-000001/manifest',
        library: 'roman_archive',
        expectedBehavior: 'Should handle Roman Archive IIIF manifest'
    },
    issue_31: {
        url: 'https://aurelia.orleans.fr/manuscrits/ark:/23855/bm0008',
        library: 'orleans',
        expectedBehavior: 'Should handle Orleans manuscripts'
    },
    issue_32: {
        url: 'https://digital.onb.ac.at/rep/access/iiif/presentation/11CB7B07-AD57-3AAE-9BDD-0C17C9F4CE64/manifest',
        library: 'onb',
        expectedBehavior: 'Should handle ONB (Austrian National Library) IIIF manifests'
    },
    issue_33: {
        url: 'https://www.digitalscriptorium.org/manifest/canvas/13357',
        library: 'digitalscriptorium',
        expectedBehavior: 'Should handle Digital Scriptorium manifests'
    }
};

class ProductionCodeTester {
    private manifestLoaders: SharedManifestLoaders;
    private results: Record<string, any> = {};

    constructor() {
        this.manifestLoaders = new SharedManifestLoaders();
    }

    async testLibrary(issueId: string, config: any) {
        console.log(`\n=== Testing ${issueId} ===`);
        console.log(`URL: ${config.url}`);
        console.log(`Expected: ${config.expectedBehavior}`);
        
        try {
            const startTime = Date.now();
            
            // Use ACTUAL production code to detect and load manifest
            const detectedLibrary = this.manifestLoaders.detectLibrary(config.url);
            console.log(`Detected library: ${detectedLibrary}`);
            
            // Set a timeout to detect infinite loading
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout: Possible infinite loading')), 30000)
            );
            
            // Call production manifest loader
            const manifestPromise = this.manifestLoaders.getManifestForLibrary(
                detectedLibrary, 
                config.url
            );
            
            const manifest = await Promise.race([manifestPromise, timeoutPromise]);
            
            const elapsed = Date.now() - startTime;
            
            // Check for specific success indicators
            if (manifest && manifest.pageLinks && manifest.pageLinks.length > 0) {
                console.log(`✅ SUCCESS: Loaded ${manifest.pageLinks.length} pages in ${elapsed}ms`);
                return { 
                    success: true, 
                    manifest: {
                        pages: manifest.pageLinks.length,
                        library: manifest.library,
                        displayName: manifest.displayName
                    },
                    elapsed 
                };
            } else {
                console.log(`⚠️ WARNING: Manifest loaded but no pages found`);
                return { 
                    success: false, 
                    error: 'No pages in manifest',
                    elapsed 
                };
            }
            
        } catch (error: any) {
            console.log(`❌ FAILED: ${error.message}`);
            
            // Check if this is the expected error from user reports
            const isKnownIssue = 
                (issueId === 'issue_2' && error.message.includes('infinite')) ||
                (issueId === 'issue_4' && (error.message.includes('301') || error.message.includes('concat'))) ||
                (issueId === 'issue_6' && error.message.includes('Invalid array length'));
                
            if (isKnownIssue) {
                console.log('⚠️ REPRODUCED USER ERROR - Issue persists despite v1.4.196 fix claim!');
            }
            
            return { 
                success: false, 
                error: error.message,
                isKnownIssue 
            };
        }
    }
    
    async runAllTests() {
        console.log('='.repeat(60));
        console.log('PRODUCTION CODE TEST - CURRENT STATE VERIFICATION');
        console.log('Testing v1.4.196 claimed fixes + new issues');
        console.log('='.repeat(60));
        
        for (const [id, config] of Object.entries(TEST_CASES)) {
            this.results[id] = await this.testLibrary(id, config);
        }
        
        return this.generateReport();
    }
    
    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('TEST RESULTS SUMMARY');
        console.log('='.repeat(60));
        
        const summary: any = {
            total: 0,
            success: 0,
            failed: 0,
            needsUltrathink: [],
            newIssues: [],
            report: {}
        };
        
        for (const [id, result] of Object.entries(this.results)) {
            summary.total++;
            summary.report[id] = result;
            
            if (result.success) {
                summary.success++;
                console.log(`✅ ${id}: WORKING`);
            } else {
                summary.failed++;
                console.log(`❌ ${id}: FAILED - ${result.error}`);
                
                // Issues 2, 4, 6 were claimed fixed but still failing = need ultrathink
                if (['issue_2', 'issue_4', 'issue_6'].includes(id) && result.isKnownIssue) {
                    summary.needsUltrathink.push(id);
                }
                // Issues 30-33 are new
                else if (parseInt(id.split('_')[1]) >= 30) {
                    summary.newIssues.push(id);
                }
            }
        }
        
        console.log('\n' + '-'.repeat(60));
        console.log(`Total: ${summary.total} | Success: ${summary.success} | Failed: ${summary.failed}`);
        
        if (summary.needsUltrathink.length > 0) {
            console.log(`\n⚠️ NEEDS ULTRATHINK ANALYSIS (claimed fixed but still failing):`);
            console.log(summary.needsUltrathink.join(', '));
        }
        
        if (summary.newIssues.length > 0) {
            console.log(`\n📌 NEW ISSUES TO FIX:`);
            console.log(summary.newIssues.join(', '));
        }
        
        // Save report for next phase
        const reportPath = path.join(import.meta.dir, '../orchestrator/current-state-report.json');
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
        
        return summary;
    }
}

// Run tests
(async () => {
    const tester = new ProductionCodeTester();
    const results = await tester.runAllTests();
    
    console.log('\n✅ Report saved to .devkit/orchestrator/current-state-report.json');
    process.exit(results.failed > 0 ? 1 : 0);
})();