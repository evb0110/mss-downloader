#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const { execSync } = require('child_process');

/**
 * Rouen Library Validation Script - Testing Actual Implementation
 * Tests the real implementation approach that looks for totalNumberPage in viewer HTML
 */

// Test URLs from the todo list
const testUrls = [
    'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.item.zoom',
    'https://www.rotomagus.fr/ark:/12148/btv1b10052441h/f1.item.zoom', 
    'https://www.rotomagus.fr/ark:/12148/btv1b100508259/f3.item.zoom'
];

// Validation results storage
const validationResults = {
    testStartTime: new Date().toISOString(),
    testUrls: testUrls,
    results: [],
    summary: {}
};

/**
 * Helper function to make HTTP requests with proper decompression
 */
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.rotomagus.fr/',
                ...options.headers
            },
            timeout: 30000
        }, (res) => {
            const chunks = [];
            
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                let buffer = Buffer.concat(chunks);
                
                // Handle compression
                const encoding = res.headers['content-encoding'];
                if (encoding === 'gzip') {
                    buffer = zlib.gunzipSync(buffer);
                } else if (encoding === 'deflate') {
                    buffer = zlib.inflateSync(buffer);
                } else if (encoding === 'br') {
                    buffer = zlib.brotliDecompressSync(buffer);
                }
                
                const data = buffer.toString('utf8');
                
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data,
                    url: url,
                    dataLength: buffer.length
                });
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => reject(new Error('Request timeout')));
        req.end();
    });
}

/**
 * Helper function to make binary requests for images
 */
function makeBinaryRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://www.rotomagus.fr/',
                ...options.headers
            },
            timeout: 30000
        }, (res) => {
            const chunks = [];
            
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    buffer: buffer,
                    url: url
                });
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => reject(new Error('Request timeout')));
        req.end();
    });
}

/**
 * Test Rouen URL pattern parsing
 */
function testUrlParsing(url) {
    console.log(`\n🔍 Testing URL parsing for: ${url}`);
    
    const arkMatch = url.match(/ark:\/12148\/([^/?\s]+)/);
    const pageMatch = url.match(/f(\d+)\.item\.zoom/);
    
    if (!arkMatch) {
        return {
            success: false,
            error: 'Failed to parse URL - no ARK ID found',
            url: url
        };
    }
    
    const manuscriptId = arkMatch[1];
    const startPage = pageMatch ? parseInt(pageMatch[1]) : 1;
    
    console.log(`   ✓ Manuscript ID: ${manuscriptId}`);
    console.log(`   ✓ Start page: ${startPage}`);
    
    return {
        success: true,
        manuscriptId: manuscriptId,
        startPage: startPage,
        url: url
    };
}

/**
 * Test page count discovery using the actual implementation approach
 */
async function testPageCountDiscovery(manuscriptId, originalUrl) {
    console.log(`\n📋 Testing page count discovery for manuscript: ${manuscriptId}`);
    
    let totalPages = 0;
    let displayName = `Rouen Manuscript ${manuscriptId}`;
    let discoveryMethod = 'none';
    
    // First try: Get page count from manifest JSON (as implementation does)
    console.log(`   Trying manifest JSON approach...`);
    const manifestUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/manifest.json`;
    
    try {
        const manifestResponse = await makeRequest(manifestUrl, {
            headers: {
                'Referer': originalUrl
            }
        });
        
        if (manifestResponse.statusCode === 200) {
            try {
                const manifestData = JSON.parse(manifestResponse.data);
                
                if (manifestData.totalNumberPage && typeof manifestData.totalNumberPage === 'number') {
                    totalPages = manifestData.totalNumberPage;
                    discoveryMethod = 'manifest-json';
                    console.log(`     ✓ Found page count in manifest JSON: ${totalPages}`);
                    
                    // Extract title if available
                    if (manifestData.title) {
                        displayName = manifestData.title;
                    } else if (manifestData.label) {
                        displayName = manifestData.label;
                    }
                } else {
                    console.log(`     ❌ No totalNumberPage found in manifest JSON`);
                }
            } catch (parseError) {
                console.log(`     ❌ Failed to parse manifest JSON: ${parseError.message}`);
            }
        } else {
            console.log(`     ❌ Manifest JSON request failed: HTTP ${manifestResponse.statusCode}`);
        }
    } catch (error) {
        console.log(`     ❌ Manifest JSON request error: ${error.message}`);
    }
    
    // Second try: Get page count from viewer page HTML (as implementation does)
    if (totalPages === 0) {
        console.log(`   Trying viewer page HTML approach...`);
        const viewerUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f1.item.zoom`;
        
        try {
            const viewerResponse = await makeRequest(viewerUrl);
            
            if (viewerResponse.statusCode === 200) {
                const viewerHtml = viewerResponse.data;
                
                // Look for page count patterns in the HTML/JavaScript (same as implementation)
                const patterns = [
                    /"totalNumberPage"\s*:\s*(\d+)/,
                    /"totalVues"\s*:\s*(\d+)/,
                    /"nbTotalVues"\s*:\s*(\d+)/,
                    /totalNumberPage["']?\s*:\s*(\d+)/
                ];
                
                for (const pattern of patterns) {
                    const match = viewerHtml.match(pattern);
                    if (match && match[1]) {
                        totalPages = parseInt(match[1], 10);
                        discoveryMethod = 'viewer-html';
                        console.log(`     ✓ Found page count via viewer HTML pattern: ${totalPages}`);
                        break;
                    }
                }
                
                if (totalPages === 0) {
                    console.log(`     ❌ No page count patterns found in viewer HTML`);
                    
                    // Log some sample content for debugging
                    console.log(`     Debug - HTML length: ${viewerHtml.length} chars`);
                    
                    // Look for any numbers that might be page counts
                    const numberMatches = viewerHtml.match(/\b(\d{1,4})\b/g);
                    if (numberMatches) {
                        const uniqueNumbers = [...new Set(numberMatches.map(n => parseInt(n)).filter(n => n > 0 && n < 10000))];
                        console.log(`     Debug - Found numbers in HTML: ${uniqueNumbers.slice(0, 20).join(', ')}${uniqueNumbers.length > 20 ? '...' : ''}`);
                    }
                }
            } else {
                console.log(`     ❌ Viewer page request failed: HTTP ${viewerResponse.statusCode}`);
            }
        } catch (error) {
            console.log(`     ❌ Viewer page request error: ${error.message}`);
        }
    }
    
    return {
        success: totalPages > 0,
        totalPages: totalPages,
        displayName: displayName,
        discoveryMethod: discoveryMethod,
        manuscriptId: manuscriptId,
        error: totalPages === 0 ? 'Could not determine page count' : null
    };
}

/**
 * Test image URL construction and accessibility
 */
async function testImageAccess(manuscriptId, totalPages) {
    console.log(`\n🖼️  Testing image access for manuscript: ${manuscriptId}`);
    
    // Test first few pages to ensure we can access images
    const pagesToTest = [];
    const maxPagesToTest = Math.min(5, totalPages);
    
    for (let i = 1; i <= maxPagesToTest; i++) {
        pagesToTest.push(i);
    }
    
    const imageResults = [];
    
    for (const pageNum of pagesToTest) {
        console.log(`   Testing page ${pageNum}...`);
        
        const imageUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNum}.highres`;
        const refererUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNum}.item.zoom`;
        
        try {
            const response = await makeBinaryRequest(imageUrl, {
                headers: {
                    'Referer': refererUrl
                }
            });
            
            if (response.statusCode === 200) {
                const contentType = response.headers['content-type'] || '';
                const contentLength = response.buffer.length;
                
                console.log(`     ✓ Page ${pageNum}: ${contentType}, ${contentLength} bytes`);
                
                imageResults.push({
                    pageNumber: pageNum,
                    success: true,
                    imageUrl: imageUrl,
                    contentType: contentType,
                    contentLength: contentLength,
                    statusCode: response.statusCode
                });
            } else {
                console.log(`     ❌ Page ${pageNum}: HTTP ${response.statusCode}`);
                imageResults.push({
                    pageNumber: pageNum,
                    success: false,
                    imageUrl: imageUrl,
                    statusCode: response.statusCode,
                    error: `HTTP ${response.statusCode}`
                });
            }
        } catch (error) {
            console.log(`     ❌ Page ${pageNum}: ${error.message}`);
            imageResults.push({
                pageNumber: pageNum,
                success: false,
                imageUrl: imageUrl,
                error: error.message
            });
        }
        
        // Add small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const successfulImages = imageResults.filter(r => r.success);
    console.log(`   📊 Successfully accessed ${successfulImages.length}/${imageResults.length} test images`);
    
    return {
        success: successfulImages.length > 0,
        imageResults: imageResults,
        successfulImages: successfulImages.length,
        totalTested: imageResults.length,
        manuscriptId: manuscriptId
    };
}

/**
 * Create validation PDF with real Rouen manuscript pages
 */
async function createValidationPdf(manuscriptId, totalPages, testNumber) {
    console.log(`\n📄 Creating validation PDF for manuscript: ${manuscriptId}`);
    
    const maxPagesToDownload = Math.min(5, totalPages); // Download max 5 pages for validation
    console.log(`   Downloading ${maxPagesToDownload} pages for validation...`);
    
    // Create validation directory
    const validationDir = path.join(__dirname, '../../CURRENT-VALIDATION');
    if (!fs.existsSync(validationDir)) {
        fs.mkdirSync(validationDir, { recursive: true });
    }
    
    const tempDir = path.join(validationDir, `temp-rouen-${manuscriptId}`);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const downloadedImages = [];
    
    for (let pageNum = 1; pageNum <= maxPagesToDownload; pageNum++) {
        try {
            console.log(`     Downloading page ${pageNum}...`);
            
            const imageUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNum}.highres`;
            const refererUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNum}.item.zoom`;
            
            const response = await makeBinaryRequest(imageUrl, {
                headers: {
                    'Referer': refererUrl
                }
            });
            
            if (response.statusCode === 200) {
                const imagePath = path.join(tempDir, `page_${pageNum.toString().padStart(3, '0')}.jpg`);
                
                fs.writeFileSync(imagePath, response.buffer);
                
                downloadedImages.push(imagePath);
                console.log(`       ✓ Saved page ${pageNum} (${response.buffer.length} bytes)`);
            } else {
                console.log(`       ❌ Failed to download page ${pageNum}: HTTP ${response.statusCode}`);
            }
        } catch (error) {
            console.log(`       ❌ Error downloading page ${pageNum}: ${error.message}`);
        }
        
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (downloadedImages.length === 0) {
        console.log(`   ❌ No images downloaded for PDF creation`);
        return {
            success: false,
            error: 'No images downloaded',
            manuscriptId: manuscriptId
        };
    }
    
    // Create PDF using ImageMagick convert
    try {
        const pdfPath = path.join(validationDir, `ROUEN-${manuscriptId}-VALIDATION.pdf`);
        
        console.log(`   📖 Creating PDF with ${downloadedImages.length} pages...`);
        
        // Sort images to ensure correct order
        downloadedImages.sort();
        const imageList = downloadedImages.map(img => `"${img}"`).join(' ');
        
        const convertCommand = `convert ${imageList} "${pdfPath}"`;
        execSync(convertCommand, { stdio: 'inherit' });
        
        // Verify PDF was created
        if (fs.existsSync(pdfPath)) {
            const pdfStats = fs.statSync(pdfPath);
            console.log(`   ✅ PDF created successfully: ${pdfPath}`);
            console.log(`      Size: ${(pdfStats.size / 1024 / 1024).toFixed(2)} MB`);
            console.log(`      Pages: ${downloadedImages.length}`);
            
            // Clean up temp images
            downloadedImages.forEach(imgPath => {
                try {
                    fs.unlinkSync(imgPath);
                } catch (e) {
                    // Ignore cleanup errors
                }
            });
            
            try {
                fs.rmdirSync(tempDir);
            } catch (e) {
                // Ignore cleanup errors
            }
            
            return {
                success: true,
                pdfPath: pdfPath,
                pdfSize: pdfStats.size,
                pageCount: downloadedImages.length,
                manuscriptId: manuscriptId
            };
        } else {
            console.log(`   ❌ PDF was not created`);
            return {
                success: false,
                error: 'PDF file not found after conversion',
                manuscriptId: manuscriptId
            };
        }
    } catch (error) {
        console.log(`   ❌ PDF creation failed: ${error.message}`);
        return {
            success: false,
            error: error.message,
            manuscriptId: manuscriptId
        };
    }
}

/**
 * Main validation function
 */
async function validateRouenImplementation() {
    console.log('🚀 Starting Rouen Library Implementation Validation');
    console.log('Testing Real Implementation Approach');
    console.log('=' .repeat(60));
    
    let allTestsPassed = true;
    const successfulManuscripts = [];
    
    for (let i = 0; i < testUrls.length; i++) {
        const url = testUrls[i];
        console.log(`\n📖 TESTING MANUSCRIPT ${i + 1}/${testUrls.length}`);
        console.log('─'.repeat(50));
        
        const testResult = {
            url: url,
            testNumber: i + 1,
            stages: {}
        };
        
        // Stage 1: URL Parsing
        const urlParseResult = testUrlParsing(url);
        testResult.stages.urlParsing = urlParseResult;
        
        if (!urlParseResult.success) {
            console.log(`❌ FAILED: URL parsing failed for ${url}`);
            testResult.success = false;
            testResult.error = urlParseResult.error;
            validationResults.results.push(testResult);
            allTestsPassed = false;
            continue;
        }
        
        // Stage 2: Page Count Discovery
        const pageCountResult = await testPageCountDiscovery(urlParseResult.manuscriptId, url);
        testResult.stages.pageCountDiscovery = pageCountResult;
        
        if (!pageCountResult.success) {
            console.log(`❌ FAILED: Page count discovery failed for ${url}`);
            testResult.success = false;
            testResult.error = pageCountResult.error;
            validationResults.results.push(testResult);
            allTestsPassed = false;
            continue;
        }
        
        // Stage 3: Image Access Testing
        const imageAccessResult = await testImageAccess(urlParseResult.manuscriptId, pageCountResult.totalPages);
        testResult.stages.imageAccess = imageAccessResult;
        
        if (!imageAccessResult.success) {
            console.log(`❌ FAILED: Image access failed for ${url}`);
            testResult.success = false;
            testResult.error = 'Could not access any images';
            validationResults.results.push(testResult);
            allTestsPassed = false;
            continue;
        }
        
        // Stage 4: PDF Creation (for first successful manuscript to validate end-to-end)
        if (successfulManuscripts.length === 0) {
            console.log(`\n🎯 Creating validation PDF for first successful manuscript...`);
            const pdfResult = await createValidationPdf(urlParseResult.manuscriptId, pageCountResult.totalPages, i + 1);
            testResult.stages.pdfCreation = pdfResult;
            
            if (pdfResult.success) {
                console.log(`✅ PDF validation successful: ${pdfResult.pdfPath}`);
                testResult.validationPdfPath = pdfResult.pdfPath;
            }
        }
        
        // All stages passed
        testResult.success = true;
        testResult.totalPages = pageCountResult.totalPages;
        testResult.manuscriptId = urlParseResult.manuscriptId;
        testResult.displayName = pageCountResult.displayName;
        testResult.discoveryMethod = pageCountResult.discoveryMethod;
        
        console.log(`✅ SUCCESS: All tests passed for ${url}`);
        console.log(`   📄 Total pages: ${pageCountResult.totalPages} (via ${pageCountResult.discoveryMethod})`);
        console.log(`   📚 Title: ${pageCountResult.displayName}`);
        console.log(`   🖼️  Accessible images: ${imageAccessResult.successfulImages}/${imageAccessResult.totalTested}`);
        
        successfulManuscripts.push(testResult);
        validationResults.results.push(testResult);
    }
    
    // Generate summary
    const successfulTests = validationResults.results.filter(r => r.success);
    const failedTests = validationResults.results.filter(r => !r.success);
    
    validationResults.summary = {
        totalTests: testUrls.length,
        successful: successfulTests.length,
        failed: failedTests.length,
        successRate: (successfulTests.length / testUrls.length) * 100,
        allTestsPassed: successfulTests.length === testUrls.length,
        totalPages: successfulTests.reduce((sum, test) => sum + (test.totalPages || 0), 0),
        discoveryMethods: successfulTests.map(test => test.discoveryMethod).filter(Boolean)
    };
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total manuscripts tested: ${validationResults.summary.totalTests}`);
    console.log(`Successful: ${validationResults.summary.successful}`);
    console.log(`Failed: ${validationResults.summary.failed}`);
    console.log(`Success rate: ${validationResults.summary.successRate.toFixed(1)}%`);
    console.log(`Total pages available: ${validationResults.summary.totalPages}`);
    console.log(`Discovery methods used: ${[...new Set(validationResults.summary.discoveryMethods)].join(', ')}`);
    
    if (validationResults.summary.allTestsPassed) {
        console.log('\n🎉 ALL TESTS PASSED! Rouen library implementation is working correctly.');
        console.log('\n📚 Manuscript Details:');
        successfulTests.forEach((test, index) => {
            console.log(`   ${index + 1}. ${test.manuscriptId}: ${test.totalPages} pages - "${test.displayName}"`);
        });
        
        if (successfulTests.some(test => test.validationPdfPath)) {
            console.log('\n📁 Validation PDFs created in CURRENT-VALIDATION folder');
        }
    } else {
        console.log('\n⚠️  SOME TESTS FAILED. Please review the errors above.');
    }
    
    // Save detailed results
    const resultsPath = path.join(__dirname, '../reports/rouen-validation-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(validationResults, null, 2));
    console.log(`\n📁 Detailed results saved to: ${resultsPath}`);
    
    return validationResults.summary.allTestsPassed;
}

// Run validation if called directly
if (require.main === module) {
    validateRouenImplementation()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Validation script failed:', error);
            process.exit(1);
        });
}

module.exports = { validateRouenImplementation };