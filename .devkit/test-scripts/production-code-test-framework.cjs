#!/usr/bin/env node

/**
 * MANDATORY: This framework tests the ACTUAL production code directly
 * NO isolated test scripts allowed - just the real code
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Test cases with EXACT URLs from GitHub issues
const TEST_CASES = {
    issue_2_graz_unipub: {
        issue: '#2',
        title: 'грац (University of Graz - UniPub)',
        url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688',
        userError: 'ошибка во время добавления манифеста',
        expectedBehavior: 'Should load Graz University IIIF manifest'
    },
    issue_4: {
        issue: '#4',
        title: 'морган (Morgan Library)',
        userUrl: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        userError: 'ReferenceError: imagesByPriority is not defined',
        expectedBehavior: 'Should handle Morgan Library pages'
    },
    issue_5: {
        issue: '#5',
        title: 'Флоренция (Florence)',
        userUrl: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
        userError: 'Error: connect ETIMEDOUT 193.240.184.109:443',
        expectedBehavior: 'Should handle ContentDM Florence library'
    },
    issue_6: {
        issue: '#6',
        title: 'Бордо (Bordeaux)',
        userUrl: 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778',
        userError: 'необходимо добавить новую библиотеку',
        expectedBehavior: 'Should support Bordeaux library'
    },
    issue_9: {
        issue: '#9',
        title: 'BDL (Bodleian Digital Library)',
        userUrl: 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903',
        userError: 'Error: getaddrinfo ENOTFOUND www.bdl.servizirl.it',
        expectedBehavior: 'Should handle BDL library'
    },
    issue_11: {
        issue: '#11',
        title: 'BNE (National Library Spain)',
        userUrl: 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
        userError: 'висит на калькуляции',
        expectedBehavior: 'Should handle BNE library without hanging'
    }
};

console.log(`Created test cases for ${Object.keys(USER_REPORTED_URLS).length} issues`);

class ProductionCodeTester {
    constructor() {
        this.results = {};
    }

    async testLibrary(libraryId, config) {
        console.log(`\nTesting ${config.title} with EXACT user URL: ${config.userUrl}`);
        
        try {
            // Import the ACTUAL production SharedManifestLoaders
            const modulePath = path.resolve(__dirname, '../../src/shared/SharedManifestLoaders.js');
            delete require.cache[modulePath]; // Clear cache to get fresh code
            const { SharedManifestLoaders } = require(modulePath);
            const manifestLoaders = new SharedManifestLoaders();
            
            // Try to detect library from URL
            const libraryName = this.detectLibraryFromUrl(config.userUrl);
            console.log(`  Detected library: ${libraryName}`);
            
            // Call ACTUAL production manifest loader
            const manifest = await manifestLoaders.getManifestForLibrary(
                libraryName, 
                config.userUrl
            );
            
            // Check for both 'images' and 'pages' (different libraries use different names)
            const pages = manifest?.images || manifest?.pages;
            
            if (manifest && pages && pages.length > 0) {
                console.log(`  ✅ SUCCESS: Loaded manifest with ${pages.length} pages/images`);
                return { 
                    success: true, 
                    manifest: {
                        pages: pages.length,
                        firstPage: pages[0]
                    }
                };
            } else {
                console.log(`  ❌ FAILED: No pages/images in manifest`);
                return { success: false, error: 'No pages/images found in manifest' };
            }
            
        } catch (error) {
            console.log(`  ❌ FAILED: ${error.message}`);
            
            // CRITICAL: Check if this matches user-reported error
            if (config.userError && (
                error.message.includes(config.userError) ||
                config.userError.includes(error.message) ||
                (config.userError.includes('imagesByPriority') && error.message.includes('imagesByPriority')) ||
                (config.userError.includes('ETIMEDOUT') && error.message.includes('ETIMEDOUT')) ||
                (config.userError.includes('ENOTFOUND') && error.message.includes('ENOTFOUND'))
            )) {
                console.log('  ⚠️ REPRODUCED USER ERROR - This needs fixing!');
            }
            
            return { success: false, error: error.message };
        }
    }
    
    detectLibraryFromUrl(url) {
        // Match production detection logic
        if (url.includes('gams.uni-graz.at')) return 'gams';  // GAMS system, not regular Graz
        if (url.includes('unipub.uni-graz.at')) return 'graz';  // Regular Graz
        if (url.includes('themorgan.org')) return 'morgan';
        if (url.includes('contentdm.oclc.org')) return 'contentdm';
        if (url.includes('selene.bordeaux.fr')) return 'bordeaux';
        if (url.includes('bdl.servizirl.it')) return 'bdl';
        if (url.includes('bne.es')) return 'bne';
        if (url.includes('bdh-rd.bne.es')) return 'bne';
        return 'unknown';
    }
    
    async runAllTests() {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing ALL ${Object.keys(USER_REPORTED_URLS).length} reported issues...`);
        console.log(`${'='.repeat(60)}`);
        
        for (const [id, config] of Object.entries(USER_REPORTED_URLS)) {
            this.results[id] = await this.testLibrary(id, config);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between tests
        }
        
        // Summary
        console.log(`\n${'='.repeat(60)}`);
        console.log('TEST SUMMARY:');
        console.log(`${'='.repeat(60)}`);
        
        const successful = Object.entries(this.results).filter(([,r]) => r.success);
        const failed = Object.entries(this.results).filter(([,r]) => !r.success);
        
        console.log(`✅ Successful: ${successful.length}`);
        successful.forEach(([id, result]) => {
            const config = USER_REPORTED_URLS[id];
            console.log(`  ${config.issue} ${config.title}: ${result.manifest.pages} pages`);
        });
        
        console.log(`\n❌ Failed: ${failed.length}`);
        failed.forEach(([id, result]) => {
            const config = USER_REPORTED_URLS[id];
            console.log(`  ${config.issue} ${config.title}: ${result.error}`);
        });
        
        return this.results;
    }
}

// Run tests if executed directly
if (require.main === module) {
    const tester = new ProductionCodeTester();
    tester.runAllTests().then(results => {
        const allSuccess = Object.values(results).every(r => r.success);
        process.exit(allSuccess ? 0 : 1);
    }).catch(err => {
        console.error('Test framework error:', err);
        process.exit(1);
    });
}

module.exports = { ProductionCodeTester, USER_REPORTED_URLS };