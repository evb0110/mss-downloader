#!/usr/bin/env node

/**
 * CRITICAL: Production code verification for v1.4.50
 * Testing EXACT user URLs from GitHub issues with ACTUAL production code
 */

const path = require('path');
const fs = require('fs');

// Import ACTUAL production SharedManifestLoaders
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

// EXACT URLs from user issue reports - NO MODIFICATIONS
const USER_REPORTED_ISSUES = {
    graz: {
        issue: '#2',
        userUrl: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
        userError: 'ошибки те же, закачка не начинается',
        expectedBehavior: 'Should parse manifest and return page URLs'
    },
    verona: {
        issue: '#3',
        userUrl: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
        userError: 'Error: Verona NBM server connection failed (TIMEOUT)',
        expectedBehavior: 'Should load manifest from new server'
    },
    morgan: {
        issue: '#4',
        userUrl: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        userError: 'Error: Morgan page redirect failed: 301',
        expectedBehavior: 'Should follow redirects and load images'
    },
    florence: {
        issue: '#5',
        userUrl: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
        userError: 'ошибка javascript сохраняется',
        expectedBehavior: 'Should load ContentDM manifest'
    },
    bordeaux: {
        issue: '#6',
        userUrl: 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778',
        userError: 'TypeError: Cannot read properties of undefined (reading \'map\')',
        expectedBehavior: 'Should handle tiles without undefined errors'
    }
};

class ProductionCodeVerifier {
    constructor() {
        this.loaders = new SharedManifestLoaders();
        this.results = {
            passed: 0,
            failed: 0,
            details: {}
        };
    }

    async verifyAllFixes() {
        console.log('='.repeat(80));
        console.log('PRODUCTION CODE VERIFICATION - v1.4.50');
        console.log('Testing with EXACT user-reported URLs');
        console.log('='.repeat(80));
        console.log();

        for (const [library, config] of Object.entries(USER_REPORTED_ISSUES)) {
            await this.testLibrary(library, config);
            console.log();
        }

        this.printSummary();
    }

    async testLibrary(libraryId, config) {
        console.log(`[${libraryId.toUpperCase()}] Testing ${config.issue}`);
        console.log(`URL: ${config.userUrl}`);
        console.log(`User error: "${config.userError}"`);
        
        const startTime = Date.now();
        
        try {
            // Detect library using production code
            const detectedLibrary = this.detectLibraryFromUrl(config.userUrl);
            console.log(`Detected library: ${detectedLibrary}`);
            
            // Call production manifest loader
            const manifest = await this.loaders.getManifestForLibrary(detectedLibrary, config.userUrl);
            
            const elapsed = Date.now() - startTime;
            
            console.log(`Raw manifest result:`, { 
                hasManifest: !!manifest,
                keys: manifest ? Object.keys(manifest) : [],
                hasImages: manifest && manifest.images ? manifest.images.length : 0,
                hasPageLinks: manifest && manifest.pageLinks ? manifest.pageLinks.length : 0
            });
            
            // Verify we got valid data - SharedManifestLoaders returns { images: [...] }
            if (manifest && manifest.images && manifest.images.length > 0) {
                console.log(`✅ SUCCESS: Loaded ${manifest.images.length} pages in ${elapsed}ms`);
                console.log(`First page URL: ${manifest.images[0].url}`);
                
                this.results.passed++;
                this.results.details[libraryId] = {
                    status: 'PASSED',
                    pages: manifest.images.length,
                    timeMs: elapsed,
                    firstPageUrl: manifest.images[0].url
                };
            } else {
                console.log(`❌ FAILED: No pages found`);
                this.results.failed++;
                this.results.details[libraryId] = {
                    status: 'FAILED',
                    error: 'No pages in manifest'
                };
            }
            
        } catch (error) {
            const elapsed = Date.now() - startTime;
            console.log(`❌ FAILED: ${error.message} (${elapsed}ms)`);
            
            // Check if this is the same error user reported
            if (error.message.includes(config.userError) || 
                error.message.includes('TIMEOUT') && config.userError.includes('TIMEOUT') ||
                error.message.includes('301') && config.userError.includes('301')) {
                console.log('⚠️  ERROR MATCHES USER REPORT - FIX DID NOT WORK!');
            }
            
            this.results.failed++;
            this.results.details[libraryId] = {
                status: 'FAILED',
                error: error.message,
                timeMs: elapsed,
                matchesUserError: error.message.includes(config.userError)
            };
        }
    }

    detectLibraryFromUrl(url) {
        // Use actual production detection logic
        if (url.includes('unipub.uni-graz.at') || url.includes('gams.uni-graz.at')) return 'graz';
        if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) return 'verona';
        if (url.includes('themorgan.org')) return 'morgan';
        if (url.includes('contentdm.oclc.org')) return 'florence';
        if (url.includes('selene.bordeaux.fr')) return 'bordeaux';
        throw new Error('Unknown library');
    }

    printSummary() {
        console.log('='.repeat(80));
        console.log('VERIFICATION SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total tests: ${this.results.passed + this.results.failed}`);
        console.log(`Passed: ${this.results.passed}`);
        console.log(`Failed: ${this.results.failed}`);
        console.log();
        
        if (this.results.failed > 0) {
            console.log('FAILED LIBRARIES:');
            for (const [library, details] of Object.entries(this.results.details)) {
                if (details.status === 'FAILED') {
                    console.log(`- ${library}: ${details.error}`);
                    if (details.matchesUserError) {
                        console.log('  ⚠️  CRITICAL: Same error as user reported!');
                    }
                }
            }
        }
        
        console.log();
        console.log(`Result: ${this.results.failed === 0 ? '✅ ALL TESTS PASSED' : '❌ FAILURES DETECTED'}`);
        
        // Save results
        const resultsPath = path.join(__dirname, 'v1.4.50-verification-results.json');
        fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));
        console.log(`\nResults saved to: ${resultsPath}`);
    }
}

// Run verification
const verifier = new ProductionCodeVerifier();
verifier.verifyAllFixes().catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
});