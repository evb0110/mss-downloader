#!/usr/bin/env node

/**
 * PRODUCTION CODE TEST FRAMEWORK  
 * Tests the ACTUAL production code directly - NO isolated test scripts
 * Uses EXACT URLs from GitHub issues for validation
 */

const path = require('path');
const fs = require('fs');

// Import ACTUAL production SharedManifestLoaders
const srcPath = path.join(__dirname, '../../src/shared/SharedManifestLoaders.js');
if (!fs.existsSync(srcPath)) {
    console.error('❌ ERROR: Production code not found at', srcPath);
    process.exit(1);
}

const { SharedManifestLoaders } = require(srcPath);

// Test cases with EXACT URLs from GitHub issues
const TEST_CASES = {
    issue_2_graz_unipub: {
        issue: '#2',
        title: 'грац (University of Graz - UniPub)',
        url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688',
        expectedError: null,
        description: 'Висит на загрузке манифеста, JavaScript error'
    },
    issue_2_graz_gams: {
        issue: '#2',
        title: 'грац (University of Graz - GAMS)',
        url: 'https://gams.uni-graz.at/o:gzc.1605/sdef:TEI/get',
        expectedError: null,
        description: 'Alternative GAMS URL from issue'
    },
    issue_4_morgan: {
        issue: '#4',
        title: 'морган (Morgan Library)',
        url: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        expectedError: 'imagesByPriority is not defined',
        description: 'ReferenceError: imagesByPriority is not defined'
    },
    issue_5_florence: {
        issue: '#5',
        title: 'Флоренция (Florence)',
        url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
        expectedError: 'connect ETIMEDOUT',
        description: 'Error: connect ETIMEDOUT 193.240.184.109:443'
    },
    issue_6_bordeaux: {
        issue: '#6',
        title: 'Бордо (Bordeaux)',
        url: 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778',
        expectedError: null,
        description: 'Новая библиотека, необходимо добавить поддержку'
    },
    issue_11_bne: {
        issue: '#11',
        title: 'BNE (Biblioteca Nacional de España)',
        url: 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
        expectedError: null,
        description: 'Висит на калькуляции'
    },
    issue_23_bdl: {
        issue: '#23',
        title: 'BDL II (Biblioteca Digitale Lombarda)',
        url: 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3506',
        expectedError: 'Array buffer allocation failed',
        description: 'PDF creation failed: Array buffer allocation failed'
    }
};

class ProductionCodeTester {
    constructor() {
        this.manifestLoaders = new SharedManifestLoaders();
        this.results = {};
        this.allPassed = true;
    }

    async testLibrary(testId, config) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`Testing ${config.issue} - ${config.title}`);
        console.log(`URL: ${config.url}`);
        console.log(`Expected issue: ${config.description}`);
        console.log(`${'='.repeat(80)}`);

        try {
            // Detect library type from URL first
            const libraryId = this.detectLibraryFromUrl(config.url);
            console.log(`Detected library: ${libraryId}`);
            
            // Try to load manifest using production code
            const startTime = Date.now();
            const manifest = await this.manifestLoaders.getManifestForLibrary(libraryId, config.url);
            const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);

            // If we expected an error but didn't get one, check if it's really working
            if (config.expectedError) {
                console.log(`⚠️ WARNING: Expected error "${config.expectedError}" but succeeded`);
                console.log(`⚠️ This might mean the issue was already fixed or is intermittent`);
            }

            // Validate manifest structure
            const pageCount = this.getPageCount(manifest);
            console.log(`✅ SUCCESS: Loaded manifest in ${loadTime}s`);
            console.log(`   - Pages found: ${pageCount}`);
            console.log(`   - Manifest type: ${manifest['@context'] ? 'IIIF' : 'Custom'}`);

            this.results[testId] = {
                success: true,
                issue: config.issue,
                title: config.title,
                pageCount,
                loadTime,
                manifest: '✓',
                error: null
            };

            return true;

        } catch (error) {
            const errorMsg = error.message || error.toString();
            console.log(`❌ FAILED: ${errorMsg}`);

            // Check if this matches the expected error
            if (config.expectedError && errorMsg.includes(config.expectedError)) {
                console.log(`✅ REPRODUCED: User-reported error confirmed!`);
                console.log(`   This issue needs to be fixed in production code.`);
            } else if (config.expectedError) {
                console.log(`⚠️ DIFFERENT ERROR: Expected "${config.expectedError}"`);
                console.log(`   Got: "${errorMsg}"`);
            }

            this.results[testId] = {
                success: false,
                issue: config.issue,
                title: config.title,
                pageCount: 0,
                loadTime: 0,
                manifest: '✗',
                error: errorMsg,
                reproduced: config.expectedError && errorMsg.includes(config.expectedError)
            };

            this.allPassed = false;
            return false;
        }
    }

    detectLibraryFromUrl(url) {
        // Use the same detection logic as production
        if (url.includes('unipub.uni-graz.at')) {
            return 'graz';
        } else if (url.includes('gams.uni-graz.at')) {
            return 'gams';
        } else if (url.includes('themorgan.org')) {
            return 'morgan';
        } else if (url.includes('contentdm.oclc.org')) {
            return 'florence';
        } else if (url.includes('bordeaux.fr')) {
            return 'bordeaux';
        } else if (url.includes('bne.es')) {
            return 'bne';
        } else if (url.includes('bdl.servizirl.it')) {
            return 'bdl';
        }
        return 'unknown';
    }

    getPageCount(manifest) {
        if (!manifest) return 0;
        
        // IIIF manifest
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            return manifest.sequences[0].canvases.length;
        }
        
        // IIIF v3
        if (manifest.items) {
            return manifest.items.length;
        }
        
        // Custom format
        if (manifest.pages) {
            return manifest.pages.length;
        }
        
        if (Array.isArray(manifest)) {
            return manifest.length;
        }
        
        return 0;
    }

    async runAllTests() {
        console.log('🧪 PRODUCTION CODE TEST FRAMEWORK');
        console.log('Testing with EXACT URLs from GitHub issues...\n');

        const startTime = Date.now();

        for (const [testId, config] of Object.entries(TEST_CASES)) {
            await this.testLibrary(testId, config);
            // Small delay between tests to avoid overwhelming servers
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

        // Print summary
        console.log(`\n${'='.repeat(80)}`);
        console.log('📊 TEST SUMMARY');
        console.log(`${'='.repeat(80)}`);

        const passed = Object.values(this.results).filter(r => r.success).length;
        const failed = Object.values(this.results).filter(r => !r.success).length;
        const reproduced = Object.values(this.results).filter(r => r.reproduced).length;

        console.log(`Total tests: ${Object.keys(this.results).length}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`🔍 Reproduced user errors: ${reproduced}`);
        console.log(`⏱️ Total time: ${totalTime}s`);

        // Detailed results table
        console.log('\nDetailed Results:');
        console.log('Issue | Title | Status | Pages | Error');
        console.log('------|-------|--------|-------|------');
        
        for (const [testId, result] of Object.entries(this.results)) {
            const status = result.success ? '✅' : '❌';
            const error = result.error ? result.error.substring(0, 40) + '...' : 'None';
            console.log(`${result.issue} | ${result.title} | ${status} | ${result.pageCount} | ${error}`);
        }

        // Issues that need fixing
        const needsFix = Object.entries(this.results)
            .filter(([_, r]) => !r.success)
            .map(([_, r]) => `${r.issue} (${r.title})`);

        if (needsFix.length > 0) {
            console.log('\n⚠️ ISSUES NEEDING FIXES:');
            needsFix.forEach(issue => console.log(`  - ${issue}`));
        }

        // Save results to file
        const reportPath = path.join(__dirname, '../test-results.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`\n📁 Results saved to: ${reportPath}`);

        return this.allPassed;
    }
}

// Run tests
async function main() {
    const tester = new ProductionCodeTester();
    const success = await tester.runAllTests();
    process.exit(success ? 0 : 1);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});