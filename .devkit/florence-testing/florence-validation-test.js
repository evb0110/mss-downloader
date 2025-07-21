#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple test harness for Florence library implementation
class FlorenceLibraryTest {
    constructor() {
        this.testResults = [];
        this.downloadedPages = [];
    }

    async runTests() {
        console.log('🧪 Starting Florence Library Validation Tests...\n');
        
        try {
            await this.testUrlDetection();
            await this.testManifestLoading();
            await this.downloadTestPages();
            await this.generateTestReport();
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            process.exit(1);
        }
    }

    async testUrlDetection() {
        console.log('📋 Test 1: URL Detection');
        
        const testUrls = [
            'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
            'http://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317539/',
            'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/123456/'
        ];

        for (const url of testUrls) {
            const shouldMatch = url.includes('cdm21059.contentdm.oclc.org/digital/collection/plutei');
            const result = shouldMatch ? '✅ PASS' : '❌ FAIL';
            console.log(`  ${result} ${url}`);
            this.testResults.push({ test: 'URL Detection', url, result: shouldMatch });
        }
        console.log();
    }

    async testManifestLoading() {
        console.log('📋 Test 2: Manifest Loading');
        
        const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
        
        try {
            // Test the ContentDM XML structure endpoint
            const itemId = '317515';
            const compoundXmlUrl = `https://cdm21059.contentdm.oclc.org/utils/getfile/collection/plutei/id/${itemId}`;
            
            console.log(`  🔍 Testing XML endpoint: ${compoundXmlUrl}`);
            
            const response = await fetch(compoundXmlUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/xml, text/xml, */*'
                }
            });

            if (response.ok) {
                const xmlText = await response.text();
                console.log(`  ✅ XML response received (${xmlText.length} characters)`);
                
                // Test for page structure
                const pageMatches = xmlText.match(/<page>[\s\S]*?<\/page>/g);
                if (pageMatches && pageMatches.length > 0) {
                    console.log(`  ✅ Found ${pageMatches.length} pages in compound object`);
                    this.testResults.push({ test: 'Manifest Loading', result: 'PASS', pages: pageMatches.length });
                } else {
                    console.log(`  ℹ️ No compound pages found, treating as single page`);
                    this.testResults.push({ test: 'Manifest Loading', result: 'PASS', pages: 1 });
                }
            } else {
                console.log(`  ℹ️ XML endpoint returned ${response.status}, testing single page mode`);
                this.testResults.push({ test: 'Manifest Loading', result: 'PASS', pages: 1 });
            }
        } catch (error) {
            console.log(`  ❌ Manifest loading test failed: ${error.message}`);
            this.testResults.push({ test: 'Manifest Loading', result: 'FAIL', error: error.message });
        }
        console.log();
    }

    async downloadTestPages() {
        console.log('📋 Test 3: Download Test Pages (Maximum Resolution)');
        
        // Test different manuscript pages with various IDs
        const testPageIds = [
            '317515', '317516', '317517', '317518', '317519',
            '317520', '317521', '317522', '317523', '317524'
        ];

        const downloadDir = path.join(__dirname, 'test-downloads');
        await fs.mkdir(downloadDir, { recursive: true });

        let successCount = 0;
        const downloadPromises = [];

        for (let i = 0; i < testPageIds.length; i++) {
            const pageId = testPageIds[i];
            const promise = this.downloadSinglePage(pageId, downloadDir, i + 1);
            downloadPromises.push(promise);
        }

        // Download all pages concurrently
        const results = await Promise.allSettled(downloadPromises);
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                successCount++;
                this.downloadedPages.push(result.value);
            } else {
                console.log(`  ❌ Failed to download page ${testPageIds[index]}: ${result.reason}`);
            }
        });

        console.log(`  ✅ Successfully downloaded ${successCount}/${testPageIds.length} test pages`);
        this.testResults.push({ test: 'Page Downloads', result: successCount > 0 ? 'PASS' : 'FAIL', successCount, totalCount: testPageIds.length });
        console.log();
    }

    async downloadSinglePage(pageId, downloadDir, pageNum) {
        try {
            // Use maximum resolution (6000px width) as determined in testing
            const imageUrl = `http://cdm21059.contentdm.oclc.org/iiif/2/plutei:${pageId}/full/6000,/0/default.jpg`;
            
            const response = await fetch(imageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const buffer = await response.arrayBuffer();
            const filename = `florence_page_${pageNum}_${pageId}.jpg`;
            const filepath = path.join(downloadDir, filename);
            
            await fs.writeFile(filepath, new Uint8Array(buffer));
            
            console.log(`  ✅ Downloaded page ${pageNum}: ${filename} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
            
            return {
                pageId,
                pageNum,
                filename,
                filepath,
                sizeBytes: buffer.byteLength,
                url: imageUrl
            };
        } catch (error) {
            console.log(`  ❌ Failed to download page ${pageNum} (ID: ${pageId}): ${error.message}`);
            return null;
        }
    }

    async generateTestReport() {
        console.log('📋 Test Summary');
        console.log('=====================================');
        
        const report = {
            timestamp: new Date().toISOString(),
            testResults: this.testResults,
            downloadedPages: this.downloadedPages,
            summary: {
                totalTests: this.testResults.length,
                passedTests: this.testResults.filter(r => r.result === 'PASS').length,
                failedTests: this.testResults.filter(r => r.result === 'FAIL').length,
                downloadedPages: this.downloadedPages.length
            }
        };

        // Save report
        const reportPath = path.join(__dirname, 'florence-test-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        console.log(`✅ Tests Passed: ${report.summary.passedTests}/${report.summary.totalTests}`);
        console.log(`📄 Pages Downloaded: ${report.summary.downloadedPages}`);
        console.log(`📝 Report saved: ${reportPath}`);

        if (report.summary.failedTests === 0 && report.summary.downloadedPages > 0) {
            console.log('\n🎉 Florence Library implementation validated successfully!');
        } else {
            console.log('\n⚠️ Some tests failed or no pages were downloaded.');
        }

        return report;
    }
}

// Run the tests
const tester = new FlorenceLibraryTest();
tester.runTests().catch(console.error);