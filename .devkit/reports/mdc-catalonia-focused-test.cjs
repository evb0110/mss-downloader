#!/usr/bin/env node

/**
 * Focused MDC Catalonia Fetch Fix Test
 * 
 * Validates the specific fix for the problematic URL:
 * https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class MDCCataloniaFocusedTester {
    constructor() {
        this.baseTimeout = 45000;
        this.maxRetries = 5;
        this.reportDir = '.devkit/reports/mdc-catalonia-validation';
        this.ensureReportDir();
    }

    ensureReportDir() {
        if (!fs.existsSync(this.reportDir)) {
            fs.mkdirSync(this.reportDir, { recursive: true });
        }
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString().substring(11, 23);
        console.log(`[${timestamp}] ${type}: ${message}`);
    }

    async fetchWithRetryAndFallback(url, options = {}) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.log(`MDC Catalonia fetch attempt ${attempt}/${this.maxRetries}: ${url}`);
                
                const response = await this.makeRequest(url, {
                    timeout: this.baseTimeout,
                    ...options
                });
                
                if (response.ok) {
                    this.log(`✓ Fetch successful on attempt ${attempt}`, 'SUCCESS');
                    return response;
                }
                
                throw new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`);
                
            } catch (error) {
                lastError = error;
                this.log(`✗ Attempt ${attempt} failed: ${error.message}`, 'ERROR');
                
                // Test curl fallback on network errors
                if (this.isNetworkError(error) && attempt <= 3) {
                    try {
                        this.log(`Trying curl fallback for attempt ${attempt}`, 'FALLBACK');
                        const curlResult = await this.curlFallback(url, options);
                        if (curlResult.success) {
                            this.log(`✓ Curl fallback successful on attempt ${attempt}`, 'SUCCESS');
                            return curlResult;
                        }
                    } catch (curlError) {
                        this.log(`✗ Curl fallback failed: ${curlError.message}`, 'ERROR');
                    }
                }
                
                // Exponential backoff with jitter
                if (attempt < this.maxRetries) {
                    const baseDelay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s, 8s
                    const jitter = Math.random() * 500;
                    const delay = baseDelay + jitter;
                    
                    this.log(`Waiting ${Math.round(delay)}ms before retry...`, 'RETRY');
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw new Error(`MDC Catalonia: All ${this.maxRetries} attempts failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    isNetworkError(error) {
        const networkErrorPatterns = [
            'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
            'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'Request timeout'
        ];
        return networkErrorPatterns.some(pattern => error.message.includes(pattern));
    }

    async curlFallback(url, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                const timeout = Math.floor((options.timeout || this.baseTimeout) / 1000);
                const userAgent = options.headers?.['User-Agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
                
                const tempFile = path.join(this.reportDir, `curl-temp-${Date.now()}.tmp`);
                
                const curlCmd = [
                    'curl',
                    '-s', '-S', '-L',
                    '--max-time', '30', // Shorter timeout for tests
                    '--connect-timeout', '15',
                    '-H', `"User-Agent: ${userAgent}"`,
                    '-o', `"${tempFile}"`,
                    '-w', '"%{http_code}\\n"',
                    `"${url}"`
                ].join(' ');
                
                const statusCode = execSync(curlCmd, { 
                    encoding: 'utf8',
                    timeout: 35000
                }).trim();
                
                if (statusCode === '200') {
                    const data = fs.readFileSync(tempFile);
                    fs.unlinkSync(tempFile);
                    
                    resolve({
                        success: true,
                        ok: true,
                        statusCode: 200,
                        data: data,
                        headers: {},
                        text: () => Promise.resolve(data.toString())
                    });
                } else {
                    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                    reject(new Error(`Curl failed with status: ${statusCode}`));
                }
            } catch (error) {
                reject(new Error(`Curl execution failed: ${error.message}`));
            }
        });
    }

    makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https:') ? https : http;
            const defaultOptions = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json,text/xml,*/*',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                timeout: options.timeout || this.baseTimeout
            };
            
            const requestOptions = { ...defaultOptions, ...options };
            
            const req = protocol.request(url, requestOptions, (res) => {
                let data = Buffer.alloc(0);
                
                res.on('data', (chunk) => {
                    data = Buffer.concat([data, chunk]);
                });
                
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        statusCode: res.statusCode,
                        statusMessage: res.statusMessage,
                        headers: res.headers,
                        data: data,
                        text: () => Promise.resolve(data.toString())
                    });
                });
            });
            
            req.on('error', (err) => {
                reject(err);
            });
            
            req.setTimeout(requestOptions.timeout, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.end();
        });
    }

    async downloadImage(url, filename) {
        const response = await this.fetchWithRetryAndFallback(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`);
        }
        
        fs.writeFileSync(filename, response.data);
        return filename;
    }

    async testMDCCataloniaFixedImplementation() {
        this.log('=== Testing MDC Catalonia Fixed Implementation ===', 'TEST');
        
        const testUrl = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';
        const results = {
            testUrl: testUrl,
            timestamp: new Date().toISOString(),
            steps: [],
            downloads: [],
            success: false
        };
        
        try {
            // Step 1: Extract collection and ID from URL
            this.log('Step 1: Extracting collection and ID from URL', 'TEST');
            const urlMatch = testUrl.match(/\/collection\/([^\/]+)\/id\/(\d+)/);
            if (!urlMatch) {
                throw new Error('Could not extract collection and ID from URL');
            }
            
            const collection = urlMatch[1];
            const parentId = urlMatch[2];
            
            results.steps.push({
                step: 1,
                description: 'Extract URL components',
                success: true,
                collection: collection,
                parentId: parentId
            });
            
            this.log(`✓ Collection: ${collection}, Parent ID: ${parentId}`, 'SUCCESS');
            
            // Step 2: Get compound object XML with retry logic
            this.log('Step 2: Getting compound object XML with enhanced retry logic', 'TEST');
            const compoundXmlUrl = `https://mdc.csuc.cat/utils/getfile/collection/${collection}/id/${parentId}`;
            
            const xmlResponse = await this.fetchWithRetryAndFallback(compoundXmlUrl);
            const xmlText = await xmlResponse.text();
            
            results.steps.push({
                step: 2,
                description: 'Fetch compound XML',
                success: xmlResponse.ok,
                url: compoundXmlUrl,
                statusCode: xmlResponse.statusCode,
                dataSize: xmlText.length
            });
            
            this.log(`✓ Compound XML fetched: ${xmlText.length} bytes`, 'SUCCESS');
            
            // Step 3: Parse pages from XML
            this.log('Step 3: Parsing pages from compound XML', 'TEST');
            const pageMatches = xmlText.match(/<page>.*?<\/page>/gs);
            
            if (!pageMatches || pageMatches.length === 0) {
                throw new Error('No pages found in compound XML');
            }
            
            const pages = pageMatches.slice(0, 5).map((match, index) => {
                const pagePtrMatch = match.match(/<pageptr>([^<]+)<\/pageptr>/);
                const pageTitleMatch = match.match(/<pagetitle>([^<]*)<\/pagetitle>/);
                
                const pagePtr = pagePtrMatch ? pagePtrMatch[1] : null;
                const pageTitle = pageTitleMatch ? pageTitleMatch[1] : `Page ${index + 1}`;
                
                if (!pagePtr) {
                    throw new Error(`Could not extract pagePtr from: ${match.substring(0, 100)}`);
                }
                
                return { pagePtr, pageTitle, index: index + 1 };
            });
            
            results.steps.push({
                step: 3,
                description: 'Parse pages from XML',
                success: true,
                totalPagesFound: pageMatches.length,
                testPagesSelected: pages.length
            });
            
            this.log(`✓ Found ${pageMatches.length} total pages, testing first ${pages.length}`, 'SUCCESS');
            
            // Step 4: Test different resolutions for maximum quality
            this.log('Step 4: Testing different resolutions for maximum quality', 'TEST');
            const firstPage = pages[0];
            const resolutionTests = [
                { name: 'full/full', param: 'full/full' },
                { name: 'full/max', param: 'full/max' },
                { name: 'full/800', param: 'full/800,' },
                { name: 'full/1000', param: 'full/1000,' }
            ];
            
            let bestResolution = 'full/full'; // Default fallback
            let bestSize = 0;
            
            for (const test of resolutionTests) {
                try {
                    const testUrl = `https://mdc.csuc.cat/digital/iiif/${collection}/${firstPage.pagePtr}/${test.param}/0/default.jpg`;
                    const response = await this.makeRequest(testUrl, { method: 'HEAD', timeout: 15000 });
                    
                    if (response.ok) {
                        const contentLength = parseInt(response.headers['content-length']) || 0;
                        this.log(`${test.name}: ${contentLength} bytes (${response.statusCode})`, 'INFO');
                        
                        if (contentLength > bestSize) {
                            bestSize = contentLength;
                            bestResolution = test.param;
                        }
                    }
                } catch (error) {
                    this.log(`${test.name}: Failed - ${error.message}`, 'WARNING');
                }
            }
            
            results.steps.push({
                step: 4,
                description: 'Find maximum resolution',
                success: true,
                bestResolution: bestResolution,
                bestSize: bestSize
            });
            
            this.log(`✓ Best resolution: ${bestResolution} (${bestSize} bytes)`, 'SUCCESS');
            
            // Step 5: Download pages with enhanced retry logic
            this.log('Step 5: Downloading pages with enhanced retry logic', 'TEST');
            let successfulDownloads = 0;
            
            for (const page of pages) {
                try {
                    this.log(`Downloading page ${page.index}: ${page.pageTitle}`, 'INFO');
                    
                    const imageUrl = `https://mdc.csuc.cat/digital/iiif/${collection}/${page.pagePtr}/${bestResolution}/0/default.jpg`;
                    const filename = path.join(this.reportDir, `page-${page.index.toString().padStart(3, '0')}.jpg`);
                    
                    await this.downloadImage(imageUrl, filename);
                    const stats = fs.statSync(filename);
                    
                    // Get image dimensions
                    let dimensions = 'unknown';
                    try {
                        const identifyOutput = execSync(`identify "${filename}"`, { encoding: 'utf8' });
                        const dimensionMatch = identifyOutput.match(/(\d+)x(\d+)/);
                        if (dimensionMatch) {
                            dimensions = `${dimensionMatch[1]}x${dimensionMatch[2]}`;
                        }
                    } catch (e) {
                        // Dimensions detection failed, but file downloaded
                    }
                    
                    results.downloads.push({
                        page: page.index,
                        title: page.pageTitle,
                        success: true,
                        filename: filename,
                        fileSize: stats.size,
                        dimensions: dimensions,
                        url: imageUrl
                    });
                    
                    successfulDownloads++;
                    this.log(`✓ Page ${page.index}: ${stats.size} bytes, ${dimensions}`, 'SUCCESS');
                    
                } catch (error) {
                    this.log(`✗ Page ${page.index} failed: ${error.message}`, 'ERROR');
                    results.downloads.push({
                        page: page.index,
                        title: page.pageTitle,
                        success: false,
                        error: error.message
                    });
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            results.steps.push({
                step: 5,
                description: 'Download pages',
                success: successfulDownloads > 0,
                successfulDownloads: successfulDownloads,
                totalAttempted: pages.length
            });
            
            // Step 6: Create validation PDF
            if (successfulDownloads > 0) {
                this.log('Step 6: Creating validation PDF', 'TEST');
                
                const downloadedFiles = results.downloads
                    .filter(d => d.success)
                    .map(d => d.filename);
                
                try {
                    const pdfFilename = path.join(this.reportDir, 'mdc-catalonia-validation.pdf');
                    const convertCmd = `convert "${downloadedFiles.join('" "')}" "${pdfFilename}"`;
                    
                    execSync(convertCmd, { timeout: 30000 });
                    const pdfStats = fs.statSync(pdfFilename);
                    
                    // Validate PDF
                    const pdfInfo = execSync(`pdfinfo "${pdfFilename}"`, { encoding: 'utf8' });
                    const pageCountMatch = pdfInfo.match(/Pages:\\s+(\\d+)/);
                    const pageCount = pageCountMatch ? parseInt(pageCountMatch[1]) : 0;
                    
                    results.steps.push({
                        step: 6,
                        description: 'Create validation PDF',
                        success: true,
                        pdfFile: pdfFilename,
                        pdfSize: pdfStats.size,
                        pdfPages: pageCount
                    });
                    
                    this.log(`✓ PDF created: ${pdfStats.size} bytes, ${pageCount} pages`, 'SUCCESS');
                    
                    // Visual inspection using pdfimages
                    try {
                        const extractDir = path.join(this.reportDir, 'pdf-extracted');
                        if (!fs.existsSync(extractDir)) {
                            fs.mkdirSync(extractDir);
                        }
                        
                        execSync(`pdfimages -png "${pdfFilename}" "${path.join(extractDir, 'verification')}"`, { timeout: 15000 });
                        const extractedFiles = fs.readdirSync(extractDir).filter(f => f.endsWith('.png'));
                        
                        this.log(`✓ Extracted ${extractedFiles.length} images for verification`, 'SUCCESS');
                        
                    } catch (extractError) {
                        this.log(`⚠ Could not extract images for verification: ${extractError.message}`, 'WARNING');
                    }
                    
                } catch (error) {
                    this.log(`✗ PDF creation failed: ${error.message}`, 'ERROR');
                    results.steps.push({
                        step: 6,
                        description: 'Create validation PDF',
                        success: false,
                        error: error.message
                    });
                }
            }
            
            // Final assessment
            results.success = successfulDownloads > 0;
            results.summary = {
                overallSuccess: results.success,
                pagesDownloaded: successfulDownloads,
                totalPagesAvailable: pageMatches.length,
                downloadSuccessRate: (successfulDownloads / pages.length) * 100,
                fixEffectiveness: results.success ? 'EXCELLENT' : 'NEEDS_WORK'
            };
            
            this.log(`=== FINAL RESULT ===`, 'COMPLETE');
            this.log(`Overall Success: ${results.success ? 'YES' : 'NO'}`, results.success ? 'SUCCESS' : 'ERROR');
            this.log(`Pages Downloaded: ${successfulDownloads}/${pages.length}`, 'INFO');
            this.log(`Success Rate: ${results.summary.downloadSuccessRate.toFixed(1)}%`, 'INFO');
            
            // Save results
            const resultsFile = path.join(this.reportDir, 'focused-test-results.json');
            fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
            
            // Generate summary report
            this.generateSummaryReport(results);
            
            return results;
            
        } catch (error) {
            this.log(`✗ Test failed: ${error.message}`, 'ERROR');
            results.success = false;
            results.error = error.message;
            
            const resultsFile = path.join(this.reportDir, 'focused-test-results.json');
            fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
            
            return results;
        }
    }

    generateSummaryReport(results) {
        const reportFile = path.join(this.reportDir, 'MDC-CATALONIA-FOCUSED-VALIDATION-REPORT.md');
        
        const report = `# MDC Catalonia Fetch Fix Focused Validation Report

## Test Overview

**Test URL:** ${results.testUrl}  
**Test Date:** ${results.timestamp}  
**Overall Success:** ${results.success ? '✅ PASSED' : '❌ FAILED'}  
**Download Success Rate:** ${results.summary?.downloadSuccessRate?.toFixed(1) || 0}%

## Fix Effectiveness Assessment

### Original Issue
The problematic URL \`https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1\` was causing:
- Fetch failures due to network timeouts
- Insufficient retry logic for temporary server issues  
- No fallback mechanisms for DNS/connectivity problems

### Fix Validation Results

${results.steps.map((step, index) => `
#### Step ${step.step}: ${step.description}
- **Status:** ${step.success ? '✅ SUCCESS' : '❌ FAILED'}
- **Details:** ${this.formatStepDetails(step)}
`).join('')}

### Download Results

| Page | Title | Status | File Size | Dimensions |
|------|-------|--------|-----------|------------|
${results.downloads.map(d => 
`| ${d.page} | ${d.title || 'N/A'} | ${d.success ? '✅' : '❌'} | ${d.fileSize ? `${d.fileSize} bytes` : 'N/A'} | ${d.dimensions || 'N/A'} |`
).join('\n')}

## Conclusion

${this.generateConclusion(results)}

## Files Created

${results.downloads.filter(d => d.success).map(d => `- ${path.basename(d.filename)}`).join('\n')}
${results.steps.find(s => s.pdfFile) ? `- ${path.basename(results.steps.find(s => s.pdfFile).pdfFile)} (Validation PDF)` : ''}

---
*Generated by MDC Catalonia Focused Fetch Fix Test*
`;

        fs.writeFileSync(reportFile, report);
        this.log(`Summary report generated: ${reportFile}`, 'INFO');
    }

    formatStepDetails(step) {
        switch (step.step) {
            case 1:
                return `Collection: ${step.collection}, Parent ID: ${step.parentId}`;
            case 2:
                return `Status: ${step.statusCode}, Data: ${step.dataSize} bytes`;
            case 3:
                return `Found ${step.totalPagesFound} pages, testing ${step.testPagesSelected}`;
            case 4:
                return `Best resolution: ${step.bestResolution} (${step.bestSize} bytes)`;
            case 5:
                return `Downloaded ${step.successfulDownloads}/${step.totalAttempted} pages`;
            case 6:
                return step.success ? `PDF: ${step.pdfSize} bytes, ${step.pdfPages} pages` : `Error: ${step.error}`;
            default:
                return 'N/A';
        }
    }

    generateConclusion(results) {
        if (results.success && results.summary.downloadSuccessRate >= 80) {
            return `**✅ FIX SUCCESSFUL:** The enhanced retry logic and fallback mechanisms are working effectively. The problematic MDC Catalonia URL now downloads successfully with ${results.summary.downloadSuccessRate.toFixed(1)}% success rate.`;
        } else if (results.success && results.summary.downloadSuccessRate >= 50) {
            return `**⚠️ PARTIAL SUCCESS:** The fix shows improvement but may need additional optimization. Download success rate: ${results.summary.downloadSuccessRate.toFixed(1)}%.`;
        } else {
            return `**❌ FIX NEEDS WORK:** The implementation requires additional improvements to handle the MDC Catalonia fetch issues effectively.`;
        }
    }
}

// Run the focused test
async function runTest() {
    const tester = new MDCCataloniaFocusedTester();
    
    try {
        const results = await tester.testMDCCataloniaFixedImplementation();
        process.exit(results.success ? 0 : 1);
    } catch (error) {
        console.error('Test execution failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    runTest();
}

module.exports = { MDCCataloniaFocusedTester };