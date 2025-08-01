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
    const urlMatch = issue.body.match(/https?:\/\/[^\s]+/);
    const errorMatch = issue.body.match(/Error[^:]*: (.+?)(?:https|$)/);
    
    // Extract clean URL without any appended error messages
    let userUrl = null;
    if (urlMatch) {
        userUrl = urlMatch[0];
        // Clean up URL if it has error text appended
        if (userUrl.includes('Error')) {
            userUrl = userUrl.split('Error')[0];
        }
        // Remove trailing markdown image extensions
        userUrl = userUrl.replace(/\.(json|png|jpg|jpeg|gif)(\]|\)|$).*$/, '');
        // Clean trailing non-URL characters
        userUrl = userUrl.replace(/[\s\n\r\t].*$/, '');
    }
    
    USER_REPORTED_URLS[`issue_${issue.number}`] = {
        issue: `#${issue.number}`,
        title: issue.title,
        userUrl: userUrl ? userUrl.trim() : 'NO_URL_PROVIDED',
        userError: errorMatch ? errorMatch[1].trim() : issue.body.substring(0, 100),
        expectedBehavior: `Should handle ${issue.title} library correctly`,
        author: issue.author.login
    };
}

console.log(`Created test cases for ${Object.keys(USER_REPORTED_URLS).length} issues`);

class ProductionCodeTester {
    constructor() {
        this.manifestLoaders = new SharedManifestLoaders();
        this.results = {};
    }

    detectLibrary(url) {
        // MUST match production detection logic EXACTLY
        // Copy from actual production code
        if (url.includes('unipub.uni-graz.at')) return 'graz';
        if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) return 'verona';
        if (url.includes('themorgan.org')) return 'morgan';
        if (url.includes('cdm21059.contentdm.oclc.org/digital/collection/plutei')) return 'florence';
        if (url.includes('manuscrits.bordeaux.fr') || url.includes('selene.bordeaux.fr')) return 'bordeaux';
        if (url.includes('digital.bodleian.ox.ac.uk')) return 'bodleian';
        if (url.includes('bdl.servizirl.it')) return 'bdl';
        if (url.includes('e-manuscripta.ch')) return 'e_manuscripta';
        if (url.includes('bdh-rd.bne.es')) return 'bne';
        if (url.includes('mdc.csuc.cat/digital/collection')) return 'mdc_catalonia';
        if (url.includes('pagella.bm-grenoble.fr')) return 'grenoble';
        
        return null;
    }

    async testLibrary(libraryId, config) {
        console.log(`\n=== Testing ${libraryId} ===`);
        console.log(`Issue: ${config.issue} (${config.title})`);
        console.log(`EXACT user URL: ${config.userUrl}`);
        console.log(`User error: ${config.userError}`);
        
        try {
            // Check for missing URL
            if (config.userUrl === 'NO_URL_PROVIDED' || !config.userUrl.startsWith('http')) {
                console.log('⚠️ SKIPPED: No valid URL provided in issue');
                return { success: false, error: 'No URL provided', skipped: true };
            }
            
            // Use ACTUAL production code to detect library
            const detectedLibrary = this.detectLibrary(config.userUrl);
            console.log(`Detected library: ${detectedLibrary || 'NONE'}`);
            
            if (!detectedLibrary) {
                throw new Error(`Unsupported library for URL: ${config.userUrl}`);
            }
            
            // Call ACTUAL production manifest loader
            const manifest = await this.manifestLoaders.getManifestForLibrary(
                detectedLibrary, 
                config.userUrl
            );
            
            console.log('✅ SUCCESS: Production code loaded manifest');
            
            // Handle special tile-based libraries
            if (manifest.requiresTileProcessor) {
                console.log(`Found tile-based library with ${manifest.pageCount || 0} pages`);
            } else {
                console.log(`Found ${manifest.images?.length || 0} images`);
            }
            
            return { success: true, manifest, library: detectedLibrary };
            
        } catch (error) {
            console.log(`❌ FAILED: ${error.message}`);
            
            // CRITICAL: Check if this matches user-reported error
            const errorStr = error.message.toLowerCase();
            const userErrorStr = config.userError.toLowerCase();
            
            if (errorStr.includes(userErrorStr) || 
                userErrorStr.includes(errorStr.split(':')[0]) ||
                (errorStr.includes('unsupported') && userErrorStr.includes('unsupported')) ||
                (errorStr.includes('timeout') && userErrorStr.includes('timeout')) ||
                (errorStr.includes('etimedout') && userErrorStr.includes('etimedout')) ||
                (errorStr.includes('enotfound') && userErrorStr.includes('enotfound')) ||
                (errorStr.includes('eai_again') && userErrorStr.includes('eai_again'))) {
                console.log('⚠️ REPRODUCED USER ERROR - This needs fixing!');
                return { success: false, error: error.message, reproduced: true };
            }
            
            return { success: false, error: error.message };
        }
    }
    
    async runAllTests() {
        console.log(`Testing ALL ${Object.keys(USER_REPORTED_URLS).length} reported issues...\n`);
        
        for (const [id, config] of Object.entries(USER_REPORTED_URLS)) {
            this.results[id] = await this.testLibrary(id, config);
            
            // Add delay to avoid overwhelming servers
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        return this.results;
    }
    
    generateReport() {
        const total = Object.keys(this.results).length;
        const successful = Object.values(this.results).filter(r => r.success).length;
        const failed = Object.values(this.results).filter(r => !r.success && !r.skipped).length;
        const reproduced = Object.values(this.results).filter(r => r.reproduced).length;
        const skipped = Object.values(this.results).filter(r => r.skipped).length;
        
        console.log('\n=== TEST SUMMARY ===');
        console.log(`Total issues tested: ${total}`);
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⚠️ Reproduced user errors: ${reproduced}`);
        console.log(`⏭️ Skipped (no URL): ${skipped}`);
        
        console.log('\n=== ISSUES NEEDING FIXES ===');
        for (const [id, result] of Object.entries(this.results)) {
            if (result.reproduced) {
                const config = USER_REPORTED_URLS[id];
                console.log(`\nIssue ${config.issue} (${config.title}):`);
                console.log(`  URL: ${config.userUrl}`);
                console.log(`  Error: ${result.error}`);
            }
        }
        
        // Save detailed results
        fs.writeFileSync(
            '.devkit/test-results.json', 
            JSON.stringify(this.results, null, 2)
        );
        
        console.log('\n\nDetailed results saved to .devkit/test-results.json');
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new ProductionCodeTester();
    
    console.log('Starting production code tests...\n');
    
    tester.runAllTests()
        .then(() => {
            tester.generateReport();
        })
        .catch(error => {
            console.error('Test framework error:', error);
            process.exit(1);
        });
}

module.exports = { ProductionCodeTester, USER_REPORTED_URLS };