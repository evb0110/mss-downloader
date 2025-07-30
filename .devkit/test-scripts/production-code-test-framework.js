#!/usr/bin/env node

/**
 * Production Code Test Framework
 * 
 * CRITICAL: This framework tests the ACTUAL production code directly via Node.js
 * No isolated test scripts, no fake implementations - just the real code
 * 
 * This ensures that what we test is exactly what users will experience
 */

const path = require('path');
const fs = require('fs');

// Import the ACTUAL production SharedManifestLoaders
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

// Test configuration with EXACT user URLs from GitHub issues
const USER_REPORTED_URLS = {
    graz: {
        issue: '#2',
        userUrl: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
        expectedBehavior: 'Should parse manifest and return page URLs',
        userError: 'ошибки те же, закачка не начинается'
    },
    verona: {
        issue: '#3',
        userUrl: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
        expectedBehavior: 'Should find manifest without timeout',
        userError: 'Error: Verona NBM server connection failed (TIMEOUT)'
    },
    morgan: {
        issue: '#4',
        userUrl: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        expectedBehavior: 'Should handle 301 redirects properly',
        userError: 'Error: Morgan page redirect failed: 301'
    },
    florence: {
        issue: '#5', 
        userUrl: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
        expectedBehavior: 'Should load without JavaScript errors',
        userError: 'ошибка javascript сохраняется'
    },
    bordeaux: {
        issue: '#6',
        userUrl: 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778',
        expectedBehavior: 'Should parse manifest without undefined errors',
        userError: "TypeError: Cannot read properties of undefined (reading 'map')"
    }
};

class ProductionCodeTester {
    constructor() {
        this.manifestLoaders = new SharedManifestLoaders();
        this.results = {
            timestamp: new Date().toISOString(),
            tests: {},
            summary: {
                total: 0,
                passed: 0,
                failed: 0
            }
        };
    }

    async testLibrary(libraryId, config) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing ${libraryId.toUpperCase()} (${config.issue})`);
        console.log(`User URL: ${config.userUrl}`);
        console.log(`User Error: ${config.userError}`);
        console.log(`${'='.repeat(60)}`);

        const startTime = Date.now();
        const testResult = {
            libraryId,
            issue: config.issue,
            userUrl: config.userUrl,
            userError: config.userError,
            expectedBehavior: config.expectedBehavior,
            success: false,
            actualError: null,
            manifest: null,
            duration: 0
        };

        try {
            // First, we need to detect which library this URL belongs to
            // This mimics what the Electron app does
            const detectedLibrary = this.detectLibrary(config.userUrl);
            console.log(`Detected library type: ${detectedLibrary || 'UNKNOWN'}`);

            if (!detectedLibrary) {
                throw new Error('Library not recognized from URL');
            }

            // Call the ACTUAL production manifest loader
            const manifest = await this.manifestLoaders.getManifestForLibrary(detectedLibrary, config.userUrl);
            
            testResult.manifest = {
                title: manifest.title || 'Unknown',
                pages: manifest.pages || 0,
                images: manifest.images ? manifest.images.length : 0
            };

            console.log(`✅ SUCCESS: Loaded manifest`);
            console.log(`   Title: ${testResult.manifest.title}`);
            console.log(`   Pages: ${testResult.manifest.pages}`);
            console.log(`   Images: ${testResult.manifest.images}`);

            testResult.success = true;

        } catch (error) {
            testResult.actualError = error.message;
            console.log(`❌ FAILED: ${error.message}`);
            
            // Check if this matches the user-reported error
            if (this.errorMatches(error.message, config.userError)) {
                console.log(`   ⚠️  This matches the user-reported error!`);
            }
        }

        testResult.duration = Date.now() - startTime;
        this.results.tests[libraryId] = testResult;
        this.results.summary.total++;
        
        if (testResult.success) {
            this.results.summary.passed++;
        } else {
            this.results.summary.failed++;
        }

        return testResult;
    }

    detectLibrary(url) {
        // This should match the detection logic in the actual app
        // Based on SharedManifestAdapter and other production code
        
        if (url.includes('unipub.uni-graz.at') || url.includes('gams.uni-graz.at')) {
            return 'graz';
        }
        if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) {
            return 'verona';
        }
        if (url.includes('themorgan.org')) {
            return 'morgan';
        }
        if (url.includes('contentdm.oclc.org')) {
            return 'florence';
        }
        if (url.includes('selene.bordeaux.fr')) {
            return 'bordeaux';
        }
        
        return null;
    }

    errorMatches(actualError, userError) {
        // Normalize errors for comparison
        const normalizedActual = actualError.toLowerCase();
        const normalizedUser = userError.toLowerCase();
        
        return normalizedActual.includes('timeout') && normalizedUser.includes('timeout') ||
               normalizedActual.includes('301') && normalizedUser.includes('301') ||
               normalizedActual.includes('undefined') && normalizedUser.includes('undefined') ||
               normalizedActual.includes('javascript') && normalizedUser.includes('javascript');
    }

    async runAllTests() {
        console.log('🧪 Production Code Testing Framework');
        console.log('Testing with ACTUAL user-reported URLs');
        console.log(`Date: ${this.results.timestamp}\n`);

        for (const [libraryId, config] of Object.entries(USER_REPORTED_URLS)) {
            await this.testLibrary(libraryId, config);
        }

        this.printSummary();
        this.saveResults();
    }

    printSummary() {
        console.log(`\n${'='.repeat(60)}`);
        console.log('TEST SUMMARY');
        console.log(`${'='.repeat(60)}`);
        console.log(`Total Tests: ${this.results.summary.total}`);
        console.log(`Passed: ${this.results.summary.passed} ✅`);
        console.log(`Failed: ${this.results.summary.failed} ❌`);
        console.log(`Success Rate: ${(this.results.summary.passed / this.results.summary.total * 100).toFixed(1)}%`);

        console.log('\nFailed Tests:');
        for (const [libraryId, result] of Object.entries(this.results.tests)) {
            if (!result.success) {
                console.log(`\n${libraryId.toUpperCase()} (${result.issue}):`);
                console.log(`  URL: ${result.userUrl}`);
                console.log(`  Expected: ${result.userError}`);
                console.log(`  Actual: ${result.actualError}`);
            }
        }
    }

    saveResults() {
        const outputPath = path.join(__dirname, '../validation-results/production-code-test-results.json');
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2));
        console.log(`\nResults saved to: ${outputPath}`);
    }
}

// Run the tests
if (require.main === module) {
    const tester = new ProductionCodeTester();
    tester.runAllTests().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { ProductionCodeTester, USER_REPORTED_URLS };