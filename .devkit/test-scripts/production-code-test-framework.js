#!/usr/bin/env node

/**
 * MANDATORY: This framework tests the ACTUAL production code directly
 * NO isolated test scripts allowed - just the real code
 */

const path = require('path');
const fs = require('fs');

// Import the ACTUAL production SharedManifestLoaders
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

// Load ALL issues from our comprehensive fetch
const allIssues = JSON.parse(fs.readFileSync('.devkit/all-open-issues.json'));

// Build test configuration with EXACT user URLs from ALL GitHub issues
const USER_REPORTED_URLS = {};

for (const issue of allIssues) {
    // Extract URLs and errors from issue body AND comments
    const allText = issue.body + '\n' + issue.comments.map(c => c.body).join('\n');
    
    // Find the MOST RECENT URL reported by the issue author
    const urlMatches = [...allText.matchAll(/https?:\/\/[^\s]+/g)];
    const errorMatches = [...allText.matchAll(/Error[^:]*: ([^h\n]+?)(?:https|$)/g)];
    
    // Get the last URL mentioned (most recent)
    const lastUrl = urlMatches.length > 0 ? urlMatches[urlMatches.length - 1][0].trim() : null;
    const lastError = errorMatches.length > 0 ? errorMatches[errorMatches.length - 1][1].trim() : 'Unknown error';
    
    USER_REPORTED_URLS[`issue_${issue.number}`] = {
        issue: `#${issue.number}`,
        title: issue.title,
        userUrl: lastUrl,
        userError: lastError,
        author: issue.author.login,
        expectedBehavior: `Should handle ${issue.title} library correctly`
    };
}

console.log(`\n=== PRODUCTION CODE TEST FRAMEWORK ===`);
console.log(`Created test cases for ${Object.keys(USER_REPORTED_URLS).length} issues\n`);

class ProductionCodeTester {
    constructor() {
        this.manifestLoaders = new SharedManifestLoaders();
        this.results = {};
    }

    async testLibrary(issueId, config) {
        console.log(`\n=== Testing ${config.issue} - ${config.title} ===`);
        console.log(`Author: ${config.author}`);
        console.log(`EXACT user URL: ${config.userUrl}`);
        console.log(`User reported error: ${config.userError}`);
        
        if (!config.userUrl) {
            console.log('❌ SKIPPED: No URL provided in issue');
            return { success: false, error: 'No URL provided', skipped: true };
        }
        
        try {
            // Detect library from URL using production logic
            const detectedLibrary = this.detectLibraryFromUrl(config.userUrl);
            console.log(`Detected library: ${detectedLibrary || 'UNKNOWN'}`);
            
            if (!detectedLibrary) {
                throw new Error('Could not detect library from URL');
            }
            
            // Call ACTUAL production manifest loader
            console.log('Calling production manifest loader...');
            const manifest = await this.manifestLoaders.getManifestForLibrary(
                detectedLibrary, 
                config.userUrl
            );
            
            console.log('✅ SUCCESS: Production code loaded manifest');
            console.log(`   Type: ${manifest.type}`);
            console.log(`   Images: ${manifest.images ? manifest.images.length : 'N/A'}`);
            console.log(`   Title: ${manifest.metadata?.title || 'N/A'}`);
            
            return { 
                success: true, 
                manifest,
                imageCount: manifest.images ? manifest.images.length : 0
            };
            
        } catch (error) {
            console.log(`❌ FAILED: ${error.message}`);
            
            // CRITICAL: Check if this matches user-reported error
            const errorLower = error.message.toLowerCase();
            const userErrorLower = config.userError.toLowerCase();
            
            if (errorLower.includes('etimedout') && userErrorLower.includes('etimedout')) {
                console.log('⚠️  REPRODUCED USER ERROR - ETIMEDOUT issue confirmed!');
            } else if (errorLower.includes('eai_again') && userErrorLower.includes('eai_again')) {
                console.log('⚠️  REPRODUCED USER ERROR - DNS resolution issue confirmed!');
            } else if (errorLower.includes('enotfound') && userErrorLower.includes('enotfound')) {
                console.log('⚠️  REPRODUCED USER ERROR - DNS lookup failure confirmed!');
            } else if (errorLower.includes('reply was never sent') && userErrorLower.includes('reply was never sent')) {
                console.log('⚠️  REPRODUCED USER ERROR - IPC communication failure confirmed!');
            } else if (errorLower.includes('validImagePaths is not defined') && userErrorLower.includes('validImagePaths is not defined')) {
                console.log('⚠️  REPRODUCED USER ERROR - Variable scope issue confirmed!');
            }
            
            return { 
                success: false, 
                error: error.message,
                reproducedUserError: errorLower.includes(userErrorLower.replace(/[^a-z0-9]/g, ''))
            };
        }
    }
    
    detectLibraryFromUrl(url) {
        // Copy EXACT detection logic from production
        if (url.includes('digitale-sammlungen.de')) return 'munich';
        if (url.includes('pagella.bm-grenoble.fr')) return 'grenoble';
        if (url.includes('mdc.csuc.cat')) return 'mdc_catalonia';
        if (url.includes('bdh-rd.bne.es')) return 'bne';
        if (url.includes('e-manuscripta.ch')) return 'e_manuscripta';
        if (url.includes('bdl.servizirl.it')) return 'bdl';
        if (url.includes('selene.bordeaux.fr') || url.includes('manuscrits.bordeaux.fr')) return 'bordeaux';
        if (url.includes('cdm21059.contentdm.oclc.org')) return 'florence';
        if (url.includes('themorgan.org')) return 'morgan';
        if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) return 'verona';
        if (url.includes('unipub.uni-graz.at')) return 'graz';
        if (url.includes('gams.uni-graz.at')) return 'gams';
        
        return null;
    }
    
    async runAllTests() {
        console.log(`\nTesting ALL ${Object.keys(USER_REPORTED_URLS).length} reported issues with PRODUCTION CODE...\n`);
        
        const startTime = Date.now();
        
        for (const [id, config] of Object.entries(USER_REPORTED_URLS)) {
            this.results[id] = await this.testLibrary(id, config);
            
            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        const elapsed = Date.now() - startTime;
        
        // Summary
        console.log('\n=== TEST SUMMARY ===');
        const successful = Object.values(this.results).filter(r => r.success).length;
        const failed = Object.values(this.results).filter(r => !r.success && !r.skipped).length;
        const skipped = Object.values(this.results).filter(r => r.skipped).length;
        const reproduced = Object.values(this.results).filter(r => r.reproducedUserError).length;
        
        console.log(`Total issues tested: ${Object.keys(this.results).length}`);
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏭️  Skipped (no URL): ${skipped}`);
        console.log(`⚠️  Reproduced user errors: ${reproduced}`);
        console.log(`Time elapsed: ${Math.round(elapsed / 1000)}s`);
        
        // Detailed failure report
        if (failed > 0) {
            console.log('\n=== FAILURES REQUIRING FIXES ===');
            for (const [id, result] of Object.entries(this.results)) {
                if (!result.success && !result.skipped) {
                    const config = USER_REPORTED_URLS[id];
                    console.log(`\n${config.issue} - ${config.title}:`);
                    console.log(`  URL: ${config.userUrl}`);
                    console.log(`  Error: ${result.error}`);
                    console.log(`  User reported: ${config.userError}`);
                    console.log(`  Reproduced: ${result.reproducedUserError ? 'YES' : 'NO'}`);
                }
            }
        }
        
        return this.results;
    }
}

// Run the tests
async function main() {
    const tester = new ProductionCodeTester();
    const results = await tester.runAllTests();
    
    // Save results for reference
    fs.writeFileSync('.devkit/test-results.json', JSON.stringify(results, null, 2));
    
    // Exit with error if any tests failed
    const failed = Object.values(results).filter(r => !r.success && !r.skipped).length;
    process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { ProductionCodeTester, USER_REPORTED_URLS };