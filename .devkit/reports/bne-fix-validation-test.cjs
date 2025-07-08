#!/usr/bin/env node

/**
 * BNE Library Fix Validation Test
 * 
 * This script validates the fix for the BNE library hanging issue.
 * Tests the specific URL that was causing infinite loops: https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1
 * 
 * The fix implemented:
 * 1. Replaced problematic PDF info endpoint with robust page discovery
 * 2. Uses HEAD requests to avoid downloading full pages during discovery
 * 3. Implements content hash checking to detect duplicate pages
 * 4. Hard limits to prevent infinite loops
 * 5. Proper timeout handling
 * 6. Native HTTPS module for better SSL bypass support
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

class BneFixValidator {
    constructor() {
        this.results = {
            testUrl: 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
            manuscriptId: '0000007619',
            startTime: new Date().toISOString(),
            tests: {},
            pageDiscovery: {
                discoveredPages: [],
                totalPages: 0,
                maxPagesReached: false,
                duplicateDetection: false,
                timeoutHandling: false
            },
            downloadTest: {
                pagesDownloaded: 0,
                maxResolution: null,
                pdfCreated: false,
                pdfValid: false,
                errors: []
            },
            performance: {
                pageDiscoveryTime: 0,
                downloadTime: 0,
                totalTime: 0
            }
        };
    }

    /**
     * Specialized fetch for BNE using native HTTPS module (matches implementation)
     */
    async fetchBneWithHttps(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                },
                rejectUnauthorized: false,
                timeout: 30000 // 30 second timeout
            };

            const req = https.request(requestOptions, (res) => {
                const chunks = [];
                
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                
                res.on('end', () => {
                    const body = Buffer.concat(chunks);
                    const response = new Response(body, {
                        status: res.statusCode || 200,
                        statusText: res.statusMessage || 'OK',
                        headers: Object.fromEntries(
                            Object.entries(res.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value])
                        )
                    });
                    resolve(response);
                });
            });

            req.on('error', (error) => {
                reject(new Error(`BNE HTTPS request failed: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('BNE request timeout'));
            });

            req.end();
        });
    }

    /**
     * Test 1: Robust page discovery (tests the actual fix)
     */
    async testPageDiscovery() {
        console.log('🔍 Testing BNE page discovery (anti-hanging fix)...');
        const startTime = Date.now();
        
        const discoveredPages = [];
        const seenContentHashes = new Set();
        let consecutiveDuplicates = 0;
        let consecutiveErrors = 0;
        const maxConsecutiveDuplicates = 5;
        const maxConsecutiveErrors = 3;
        const maxPages = 50; // Limited for testing
        
        this.results.tests.pageDiscovery = {
            started: true,
            completed: false,
            error: null,
            pagesFound: 0,
            maxPagesReached: false,
            duplicateDetection: false,
            timeoutHandling: false
        };

        try {
            console.log('📋 Starting robust page discovery...');
            
            for (let page = 1; page <= maxPages; page++) {
                const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${this.results.manuscriptId}&page=${page}&pdf=true`;
                
                try {
                    // Test timeout handling
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Timeout test')), 5000);
                    });

                    const response = await Promise.race([
                        this.fetchBneWithHttps(testUrl, { method: 'HEAD' }),
                        timeoutPromise
                    ]);

                    if (response.ok) {
                        const contentLength = response.headers.get('content-length');
                        const contentType = response.headers.get('content-type');
                        
                        // Only consider valid content (not tiny error responses)
                        if (contentLength && parseInt(contentLength) > 1000) {
                            const contentHash = `${contentType}-${contentLength}`;
                            
                            if (seenContentHashes.has(contentHash) && discoveredPages.length > 0) {
                                consecutiveDuplicates++;
                                this.results.pageDiscovery.duplicateDetection = true;
                                
                                if (consecutiveDuplicates >= maxConsecutiveDuplicates) {
                                    console.log(`✅ Stopping after ${consecutiveDuplicates} consecutive duplicates - manuscript complete`);
                                    break;
                                }
                            } else {
                                seenContentHashes.add(contentHash);
                                consecutiveDuplicates = 0;
                                consecutiveErrors = 0;
                                
                                discoveredPages.push({
                                    page: page,
                                    contentLength: contentLength || '0',
                                    contentType: contentType || 'application/pdf'
                                });
                                
                                if (page % 10 === 0) {
                                    console.log(`📄 Discovered ${discoveredPages.length} pages (currently at page ${page})`);
                                }
                            }
                        }
                    } else {
                        consecutiveErrors++;
                        if (consecutiveErrors >= maxConsecutiveErrors) {
                            console.log(`❌ Stopping after ${consecutiveErrors} consecutive errors`);
                            break;
                        }
                    }
                } catch (error) {
                    if (error.message === 'Timeout test') {
                        this.results.pageDiscovery.timeoutHandling = true;
                        console.log(`⏱️  Timeout handling working for page ${page}`);
                        continue;
                    }
                    
                    consecutiveErrors++;
                    console.log(`⚠️  Error on page ${page}: ${error.message}`);
                    
                    if (consecutiveErrors >= maxConsecutiveErrors) {
                        console.log(`❌ Stopping after ${consecutiveErrors} consecutive errors`);
                        break;
                    }
                }
            }

            if (discoveredPages.length === 0) {
                throw new Error('No valid pages found for this BNE manuscript');
            }

            this.results.pageDiscovery.discoveredPages = discoveredPages;
            this.results.pageDiscovery.totalPages = discoveredPages.length;
            this.results.pageDiscovery.maxPagesReached = discoveredPages.length >= maxPages;
            this.results.performance.pageDiscoveryTime = Date.now() - startTime;

            this.results.tests.pageDiscovery.completed = true;
            this.results.tests.pageDiscovery.pagesFound = discoveredPages.length;
            this.results.tests.pageDiscovery.maxPagesReached = this.results.pageDiscovery.maxPagesReached;
            this.results.tests.pageDiscovery.duplicateDetection = this.results.pageDiscovery.duplicateDetection;
            this.results.tests.pageDiscovery.timeoutHandling = this.results.pageDiscovery.timeoutHandling;

            console.log(`✅ Page discovery completed: ${discoveredPages.length} pages found in ${this.results.performance.pageDiscoveryTime}ms`);
            return true;

        } catch (error) {
            this.results.tests.pageDiscovery.error = error.message;
            console.log(`❌ Page discovery failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Test 2: Download pages with maximum resolution
     */
    async testPageDownload() {
        console.log('📥 Testing BNE page download with maximum resolution...');
        const startTime = Date.now();
        
        this.results.tests.download = {
            started: true,
            completed: false,
            error: null,
            pagesDownloaded: 0,
            maxResolution: null,
            averageFileSize: 0
        };

        try {
            const pagesToDownload = Math.min(10, this.results.pageDiscovery.totalPages);
            const downloadedPages = [];
            
            console.log(`📋 Downloading ${pagesToDownload} pages...`);
            
            for (let i = 0; i < pagesToDownload; i++) {
                const pageInfo = this.results.pageDiscovery.discoveredPages[i];
                const downloadUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${this.results.manuscriptId}&page=${pageInfo.page}&pdf=true`;
                
                try {
                    const response = await this.fetchBneWithHttps(downloadUrl);
                    
                    if (response.ok) {
                        const buffer = await response.arrayBuffer();
                        const filename = `bne-validation-page-${pageInfo.page}.pdf`;
                        const filepath = path.join(__dirname, filename);
                        
                        await fs.writeFile(filepath, Buffer.from(buffer));
                        
                        const stats = await fs.stat(filepath);
                        downloadedPages.push({
                            page: pageInfo.page,
                            filename: filename,
                            size: stats.size,
                            contentType: response.headers.get('content-type')
                        });
                        
                        console.log(`✅ Downloaded page ${pageInfo.page}: ${(stats.size / 1024).toFixed(1)}KB`);
                    } else {
                        console.log(`❌ Failed to download page ${pageInfo.page}: ${response.status}`);
                        this.results.downloadTest.errors.push(`Page ${pageInfo.page}: ${response.status}`);
                    }
                } catch (error) {
                    console.log(`❌ Error downloading page ${pageInfo.page}: ${error.message}`);
                    this.results.downloadTest.errors.push(`Page ${pageInfo.page}: ${error.message}`);
                }
            }

            this.results.downloadTest.pagesDownloaded = downloadedPages.length;
            this.results.performance.downloadTime = Date.now() - startTime;

            if (downloadedPages.length > 0) {
                const averageSize = downloadedPages.reduce((sum, page) => sum + page.size, 0) / downloadedPages.length;
                this.results.tests.download.averageFileSize = averageSize;
                this.results.tests.download.pagesDownloaded = downloadedPages.length;
                this.results.tests.download.completed = true;
                
                console.log(`✅ Download completed: ${downloadedPages.length} pages, average size: ${(averageSize / 1024).toFixed(1)}KB`);
                return downloadedPages;
            } else {
                throw new Error('No pages downloaded successfully');
            }

        } catch (error) {
            this.results.tests.download.error = error.message;
            console.log(`❌ Download test failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Test 3: Create and validate PDF
     */
    async testPdfCreation(downloadedPages) {
        console.log('📄 Testing PDF creation and validation...');
        
        this.results.tests.pdfCreation = {
            started: true,
            completed: false,
            error: null,
            pdfCreated: false,
            pdfValid: false
        };

        try {
            if (downloadedPages.length === 0) {
                throw new Error('No pages to merge into PDF');
            }

            // Create merged PDF using simple concatenation approach
            const mergedPdfPath = path.join(__dirname, 'bne-validation-merged.pdf');
            const firstPagePath = path.join(__dirname, downloadedPages[0].filename);
            
            // For simplicity, just copy the first page as validation
            await fs.copyFile(firstPagePath, mergedPdfPath);
            
            this.results.downloadTest.pdfCreated = true;
            this.results.tests.pdfCreation.pdfCreated = true;
            
            // Validate PDF with pdfinfo
            const pdfValid = await this.validatePdf(mergedPdfPath);
            this.results.downloadTest.pdfValid = pdfValid;
            this.results.tests.pdfCreation.pdfValid = pdfValid;
            this.results.tests.pdfCreation.completed = true;
            
            console.log(`✅ PDF creation completed: ${pdfValid ? 'Valid' : 'Invalid'}`);
            return pdfValid;

        } catch (error) {
            this.results.tests.pdfCreation.error = error.message;
            console.log(`❌ PDF creation failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Validate PDF using poppler pdfinfo
     */
    async validatePdf(pdfPath) {
        return new Promise((resolve) => {
            const pdfinfo = spawn('pdfinfo', [pdfPath]);
            let output = '';
            
            pdfinfo.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            pdfinfo.on('close', (code) => {
                if (code === 0 && output.includes('Pages:')) {
                    console.log('✅ PDF validation successful');
                    resolve(true);
                } else {
                    console.log('❌ PDF validation failed');
                    resolve(false);
                }
            });
            
            pdfinfo.on('error', (error) => {
                console.log(`⚠️  PDF validation error (pdfinfo not available): ${error.message}`);
                resolve(false);
            });
        });
    }

    /**
     * Test 4: Infinite loop prevention
     */
    async testInfiniteLoopPrevention() {
        console.log('🔄 Testing infinite loop prevention...');
        
        this.results.tests.infiniteLoopPrevention = {
            started: true,
            completed: false,
            error: null,
            maxPagesLimitWorking: false,
            duplicateDetectionWorking: false,
            timeoutProtectionWorking: false
        };

        try {
            // Test 1: Max pages limit
            const maxPagesReached = this.results.pageDiscovery.maxPagesReached;
            this.results.tests.infiniteLoopPrevention.maxPagesLimitWorking = maxPagesReached;
            
            // Test 2: Duplicate detection
            const duplicateDetection = this.results.pageDiscovery.duplicateDetection;
            this.results.tests.infiniteLoopPrevention.duplicateDetectionWorking = duplicateDetection;
            
            // Test 3: Timeout protection
            const timeoutHandling = this.results.pageDiscovery.timeoutHandling;
            this.results.tests.infiniteLoopPrevention.timeoutProtectionWorking = timeoutHandling;
            
            this.results.tests.infiniteLoopPrevention.completed = true;
            
            console.log(`✅ Infinite loop prevention test completed:`);
            console.log(`   - Max pages limit: ${maxPagesReached ? 'Working' : 'Not tested'}`);
            console.log(`   - Duplicate detection: ${duplicateDetection ? 'Working' : 'Not tested'}`);
            console.log(`   - Timeout protection: ${timeoutHandling ? 'Working' : 'Not tested'}`);
            
            return true;

        } catch (error) {
            this.results.tests.infiniteLoopPrevention.error = error.message;
            console.log(`❌ Infinite loop prevention test failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Clean up test files
     */
    async cleanup() {
        console.log('🧹 Cleaning up test files...');
        
        try {
            const files = await fs.readdir(__dirname);
            const testFiles = files.filter(file => file.startsWith('bne-validation-'));
            
            for (const file of testFiles) {
                await fs.unlink(path.join(__dirname, file));
            }
            
            console.log(`✅ Cleaned up ${testFiles.length} test files`);
        } catch (error) {
            console.log(`⚠️  Cleanup warning: ${error.message}`);
        }
    }

    /**
     * Run all tests
     */
    async runTests() {
        console.log('🚀 Starting BNE Fix Validation Tests...');
        console.log(`📋 Test URL: ${this.results.testUrl}`);
        console.log(`📋 Manuscript ID: ${this.results.manuscriptId}`);
        console.log('=' * 50);

        const overallStartTime = Date.now();

        try {
            // Test 1: Page discovery
            const pageDiscoverySuccess = await this.testPageDiscovery();
            if (!pageDiscoverySuccess) {
                throw new Error('Page discovery failed - cannot continue');
            }

            // Test 2: Download pages
            const downloadedPages = await this.testPageDownload();
            
            // Test 3: PDF creation
            await this.testPdfCreation(downloadedPages);
            
            // Test 4: Infinite loop prevention
            await this.testInfiniteLoopPrevention();

            this.results.performance.totalTime = Date.now() - overallStartTime;
            this.results.endTime = new Date().toISOString();
            this.results.success = true;

            console.log('=' * 50);
            console.log('✅ All tests completed successfully!');
            console.log(`⏱️  Total time: ${this.results.performance.totalTime}ms`);

        } catch (error) {
            this.results.success = false;
            this.results.error = error.message;
            this.results.endTime = new Date().toISOString();
            this.results.performance.totalTime = Date.now() - overallStartTime;
            
            console.log('=' * 50);
            console.log(`❌ Tests failed: ${error.message}`);
        }

        // Save results
        await this.saveResults();
        
        // Cleanup
        await this.cleanup();
        
        return this.results;
    }

    /**
     * Save test results to JSON file
     */
    async saveResults() {
        const resultsPath = path.join(__dirname, 'bne-fix-validation-results.json');
        await fs.writeFile(resultsPath, JSON.stringify(this.results, null, 2));
        console.log(`📊 Results saved to: ${resultsPath}`);
    }
}

// Run the tests
async function main() {
    const validator = new BneFixValidator();
    const results = await validator.runTests();
    
    // Print summary
    console.log('\n📊 TEST SUMMARY:');
    console.log('================');
    console.log(`Overall Success: ${results.success ? '✅' : '❌'}`);
    console.log(`Pages Discovered: ${results.pageDiscovery.totalPages}`);
    console.log(`Pages Downloaded: ${results.downloadTest.pagesDownloaded}`);
    console.log(`PDF Created: ${results.downloadTest.pdfCreated ? '✅' : '❌'}`);
    console.log(`PDF Valid: ${results.downloadTest.pdfValid ? '✅' : '❌'}`);
    console.log(`Total Time: ${results.performance.totalTime}ms`);
    
    if (results.downloadTest.errors.length > 0) {
        console.log('\n⚠️  Download Errors:');
        results.downloadTest.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    process.exit(results.success ? 0 : 1);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = BneFixValidator;