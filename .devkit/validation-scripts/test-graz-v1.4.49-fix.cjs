/**
 * University of Graz v1.4.49 Fix Validation Script
 * Tests the fixes for JavaScript errors, infinite loading, and download issues
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const fs = require('fs').promises;
const path = require('path');

// Test URLs
const TEST_URLS = [
    'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538', // Valid UniPub URL  
    'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/259994',   // HHU-style URL
    'https://gams.uni-graz.at/context:rbas.ms.P0008s11',                 // GAMS URL (should error gracefully)
    'https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540'    // PageView URL (should convert)
];

class GrazValidationTest {
    constructor() {
        this.loader = new SharedManifestLoaders();
        this.results = [];
        this.errors = [];
    }

    async runAllTests() {
        console.log('=== University of Graz v1.4.49 Fix Validation ===\n');
        
        for (let i = 0; i < TEST_URLS.length; i++) {
            const url = TEST_URLS[i];
            console.log(`Test ${i + 1}: ${url}`);
            
            try {
                const startTime = Date.now();
                const result = await this.testGrazUrl(url);
                const duration = Date.now() - startTime;
                
                console.log(`✅ SUCCESS: Processed in ${duration}ms`);
                if (result.images) {
                    console.log(`   Found ${result.images.length} pages`);
                    console.log(`   Display name: ${result.displayName || 'N/A'}`);
                }
                console.log(`   Result type: ${result.type || 'standard'}`);
                
                this.results.push({
                    url,
                    success: true,
                    duration,
                    imageCount: result.images?.length || 0,
                    displayName: result.displayName,
                    type: result.type
                });
                
            } catch (error) {
                console.log(`❌ ERROR: ${error.message}`);
                this.errors.push({
                    url,
                    error: error.message,
                    stack: error.stack
                });
                
                this.results.push({
                    url,
                    success: false,
                    error: error.message
                });
            }
            
            console.log('');
        }
        
        await this.testMemoryHandling();
        await this.testRedirectProtection();
        await this.generateReport();
    }

    async testGrazUrl(url) {
        if (url.includes('gams.uni-graz.at')) {
            return await this.loader.getGAMSManifest(url);
        } else {
            return await this.loader.getGrazManifest(url);
        }
    }

    async testMemoryHandling() {
        console.log('=== Memory Handling Test ===');
        
        const memBefore = process.memoryUsage();
        console.log(`Memory before: ${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`);
        
        try {
            // Test with a known large manuscript
            const result = await this.loader.getGrazManifest(TEST_URLS[0]);
            const memAfter = process.memoryUsage();
            console.log(`Memory after: ${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`);
            console.log(`Memory increase: ${Math.round((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024)}MB`);
            console.log(`✅ Memory handling test passed (${result.images?.length || 0} pages loaded)`);
        } catch (error) {
            console.log(`❌ Memory handling test failed: ${error.message}`);
            this.errors.push({
                test: 'memory_handling',
                error: error.message
            });
        }
        
        console.log('');
    }

    async testRedirectProtection() {
        console.log('=== Redirect Protection Test ===');
        
        try {
            // Test redirect loop protection with a redirect loop URL
            await this.loader.fetchUrl('http://httpbin.org/redirect/15'); // Creates 15 redirects (should fail)
            console.log('❌ Redirect protection failed - should have thrown error');
        } catch (error) {
            if (error.message.includes('Too many redirects')) {
                console.log('✅ Redirect protection working correctly');
            } else {
                console.log(`❌ Unexpected redirect error: ${error.message}`);
                this.errors.push({
                    test: 'redirect_protection',
                    error: error.message
                });
            }
        }
        
        console.log('');
    }

    async generateReport() {
        console.log('=== Test Summary ===');
        
        const successful = this.results.filter(r => r.success).length;
        const failed = this.results.filter(r => !r.success).length;
        
        console.log(`Total tests: ${this.results.length}`);
        console.log(`Successful: ${successful}`);
        console.log(`Failed: ${failed}`);
        
        if (this.errors.length > 0) {
            console.log('\n=== Errors ===');
            this.errors.forEach((error, i) => {
                console.log(`${i + 1}. ${error.url || error.test}: ${error.error}`);
            });
        }
        
        // Save detailed results
        const reportData = {
            timestamp: new Date().toISOString(),
            summary: {
                total: this.results.length,
                successful,
                failed
            },
            results: this.results,
            errors: this.errors,
            memoryUsage: process.memoryUsage()
        };
        
        const reportPath = path.join(__dirname, '..', 'validation-results', 'graz-v1.4.49-validation.json');
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
        
        console.log(`\nDetailed report saved to: ${reportPath}`);
    }
}

// Run the test
if (require.main === module) {
    const test = new GrazValidationTest();
    test.runAllTests().catch(console.error);
}

module.exports = { GrazValidationTest };