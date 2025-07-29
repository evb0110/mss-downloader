#!/usr/bin/env node

/**
 * Verona Timeout Fix Validation Test
 * Tests the enhanced Verona implementation with improved timeout handling
 */

const { SharedManifestLoaders } = require('./src/shared/SharedManifestLoaders');
const path = require('path');
const fs = require('fs').promises;

// Test URLs that have been reported to cause timeout issues
const TEST_URLS = [
    {
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
        description: 'Primary timeout issue URL (codice=15)',
        expectedManifestId: 'LXXXIX841'
    },
    {
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=14',
        description: 'Secondary test URL (codice=14)',
        expectedManifestId: 'CVII1001'
    },
    {
        url: 'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json',
        description: 'Direct manifest URL test',
        isDirect: true
    }
];

class VeronaTimeoutTest {
    constructor() {
        this.loader = new SharedManifestLoaders();
        this.results = [];
        this.startTime = Date.now();
    }

    async runAllTests() {
        console.log('🧪 Starting Verona Timeout Fix Validation Tests');
        console.log('=' .repeat(60));

        // Test 1: Server Health Check
        await this.testServerHealth();

        // Test 2: Individual URL Tests
        for (const testCase of TEST_URLS) {
            await this.testVeronaUrl(testCase);
        }

        // Test 3: Concurrent Load Test
        await this.testConcurrentLoad();

        // Generate Report
        await this.generateReport();
    }

    async testServerHealth() {
        console.log('\n📡 Testing Verona Server Health Check...');
        
        try {
            const startTime = Date.now();
            const isHealthy = await this.loader.checkVeronaServerHealth();
            const duration = Date.now() - startTime;
            
            this.results.push({
                test: 'Server Health Check',
                success: isHealthy,
                duration: duration,
                message: isHealthy ? 'Server is responsive' : 'Server appears to be down',
                details: `Health check completed in ${duration}ms`
            });
            
            console.log(`✅ Health check: ${isHealthy ? 'PASSED' : 'FAILED'} (${duration}ms)`);
            
        } catch (error) {
            this.results.push({
                test: 'Server Health Check',
                success: false,
                error: error.message,
                details: 'Health check threw exception'
            });
            console.log(`❌ Health check failed: ${error.message}`);
        }
    }

    async testVeronaUrl(testCase) {
        console.log(`\\n📋 Testing: ${testCase.description}`);
        console.log(`URL: ${testCase.url}`);
        
        const startTime = Date.now();
        
        try {
            console.log('⏳ Fetching manifest...');
            const result = await this.loader.getVeronaManifest(testCase.url);
            const duration = Date.now() - startTime;
            
            // Validate result structure
            const isValid = this.validateManifestResult(result);
            
            this.results.push({
                test: `Verona URL: ${testCase.description}`,
                url: testCase.url,
                success: true,
                duration: duration,
                imagesFound: result.images.length,
                displayName: result.displayName,
                isValid: isValid,
                details: `Found ${result.images.length} pages in ${Math.round(duration/1000)}s`
            });
            
            console.log(`✅ SUCCESS: Found ${result.images.length} pages in ${Math.round(duration/1000)}s`);
            console.log(`   Display Name: ${result.displayName}`);
            console.log(`   First Image: ${result.images[0]?.url || 'N/A'}`);
            
            // Test image URL accessibility
            if (result.images.length > 0) {
                await this.testImageAccessibility(result.images[0].url, testCase.description);
            }
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.results.push({
                test: `Verona URL: ${testCase.description}`,
                url: testCase.url,
                success: false,
                duration: duration,
                error: error.message,
                details: `Failed after ${Math.round(duration/1000)}s`
            });
            
            console.log(`❌ FAILED after ${Math.round(duration/1000)}s: ${error.message}`);
        }
    }

    async testImageAccessibility(imageUrl, testDescription) {
        console.log(`   🖼️  Testing image accessibility...`);
        
        try {
            const response = await this.loader.fetchWithRetry(imageUrl, {}, 2);
            const isAccessible = response.ok;
            
            this.results.push({
                test: `Image Accessibility: ${testDescription}`,
                url: imageUrl,
                success: isAccessible,
                httpStatus: response.status,
                details: `Image ${isAccessible ? 'accessible' : 'not accessible'} (${response.status})`
            });
            
            console.log(`   ${isAccessible ? '✅' : '❌'} Image accessibility: ${response.status}`);
            
        } catch (error) {
            this.results.push({
                test: `Image Accessibility: ${testDescription}`,
                url: imageUrl,
                success: false,
                error: error.message,
                details: 'Image accessibility test failed'
            });
            console.log(`   ❌ Image test failed: ${error.message}`);
        }
    }

    async testConcurrentLoad() {
        console.log('\\n🔄 Testing Concurrent Load Handling...');
        
        const concurrentUrl = TEST_URLS[0].url; // Use the main problematic URL
        const concurrentTests = 3;
        
        console.log(`Launching ${concurrentTests} concurrent requests...`);
        
        const startTime = Date.now();
        const promises = [];
        
        for (let i = 0; i < concurrentTests; i++) {
            promises.push(
                this.loader.getVeronaManifest(concurrentUrl)
                    .then(result => ({ success: true, result, index: i + 1 }))
                    .catch(error => ({ success: false, error: error.message, index: i + 1 }))
            );
        }
        
        try {
            const results = await Promise.all(promises);
            const duration = Date.now() - startTime;
            const successCount = results.filter(r => r.success).length;
            
            this.results.push({
                test: 'Concurrent Load Test',
                success: successCount > 0,
                duration: duration,
                successCount: successCount,
                totalRequests: concurrentTests,
                details: `${successCount}/${concurrentTests} requests succeeded in ${Math.round(duration/1000)}s`
            });
            
            console.log(`${successCount > 0 ? '✅' : '❌'} Concurrent load: ${successCount}/${concurrentTests} succeeded in ${Math.round(duration/1000)}s`);
            
            results.forEach(result => {
                if (result.success) {
                    console.log(`   Request ${result.index}: ✅ ${result.result.images.length} pages`);
                } else {
                    console.log(`   Request ${result.index}: ❌ ${result.error}`);
                }
            });
            
        } catch (error) {
            console.log(`❌ Concurrent load test failed: ${error.message}`);
        }
    }

    validateManifestResult(result) {
        if (!result || typeof result !== 'object') return false;
        if (!Array.isArray(result.images) || result.images.length === 0) return false;
        if (!result.displayName || typeof result.displayName !== 'string') return false;
        
        // Validate each image object
        for (const image of result.images) {
            if (!image.url || !image.label) return false;
            if (!image.url.startsWith('http')) return false;
        }
        
        return true;
    }

    async generateReport() {
        const totalDuration = Date.now() - this.startTime;
        const successCount = this.results.filter(r => r.success).length;
        const totalTests = this.results.length;
        
        console.log('\\n' + '=' .repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('=' .repeat(60));
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Successful: ${successCount}`);
        console.log(`Failed: ${totalTests - successCount}`);
        console.log(`Success Rate: ${Math.round((successCount / totalTests) * 100)}%`);
        console.log(`Total Duration: ${Math.round(totalDuration / 1000)}s`);
        
        // Detailed results
        console.log('\\n📋 DETAILED RESULTS:');
        this.results.forEach((result, index) => {
            const status = result.success ? '✅' : '❌';
            const duration = result.duration ? ` (${Math.round(result.duration/1000)}s)` : '';
            console.log(`${index + 1}. ${status} ${result.test}${duration}`);
            if (result.details) console.log(`   ${result.details}`);
            if (result.error) console.log(`   Error: ${result.error}`);
        });
        
        // Save detailed report
        const reportPath = path.join(__dirname, '.devkit', 'reports', 'verona-timeout-test-results.json');
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        
        const detailedReport = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests,
                successCount,
                failureCount: totalTests - successCount,
                successRate: Math.round((successCount / totalTests) * 100),
                totalDurationMs: totalDuration
            },
            results: this.results,
            improvements: [
                'Exponential backoff with jitter implemented',
                'Adaptive timeouts (90s discovery, 180s manifest)',
                'Server health checking added',
                'Enhanced error messages with specific guidance',
                'Better connection handling and retry logic'
            ]
        };
        
        await fs.writeFile(reportPath, JSON.stringify(detailedReport, null, 2));
        console.log(`\\n📄 Detailed report saved: ${reportPath}`);
        
        // Success criteria evaluation
        const healthCheckPassed = this.results.find(r => r.test === 'Server Health Check')?.success;
        const mainUrlPassed = this.results.find(r => r.test.includes('Primary timeout issue'))?.success;
        
        console.log('\\n🎯 SUCCESS CRITERIA:');
        console.log(`Server Health Check: ${healthCheckPassed ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Main Problem URL: ${mainUrlPassed ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Overall Success Rate: ${successCount >= totalTests * 0.7 ? '✅ PASS (≥70%)' : '❌ FAIL (<70%)'}`);
        
        if (healthCheckPassed && mainUrlPassed && successCount >= totalTests * 0.7) {
            console.log('\\n🎉 VERONA TIMEOUT FIX VALIDATION: SUCCESSFUL');
            console.log('The enhanced timeout handling appears to be working correctly.');
        } else {
            console.log('\\n⚠️  VERONA TIMEOUT FIX VALIDATION: NEEDS ATTENTION');
            console.log('Some issues remain. Check the detailed results above.');
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const test = new VeronaTimeoutTest();
    test.runAllTests().catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = VeronaTimeoutTest;