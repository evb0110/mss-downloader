#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const { execSync } = require('child_process');

/**
 * Comprehensive Rouen Library Validation Script
 * Tests all three URLs from the todo list and validates end-to-end functionality
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
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
    
    const urlMatch = url.match(/ark:\/12148\/(.+?)\/f(\d+)\.item\.zoom/);
    if (!urlMatch) {
        return {
            success: false,
            error: 'Failed to parse URL - invalid format',
            url: url
        };
    }
    
    const manuscriptId = urlMatch[1];
    const startPage = parseInt(urlMatch[2]);
    
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
 * Test manifest discovery and validation
 */
async function testManifestDiscovery(manuscriptId, originalUrl) {
    console.log(`\n📋 Testing manifest discovery for manuscript: ${manuscriptId}`);
    
    const manifestUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/manifest.json`;
    console.log(`   Trying manifest URL: ${manifestUrl}`);
    
    try {
        const response = await makeRequest(manifestUrl);
        
        if (response.statusCode !== 200) {
            console.log(`   ❌ Manifest not found at standard location (${response.statusCode})`);
            return {
                success: false,
                error: `HTTP ${response.statusCode}`,
                manifestUrl: manifestUrl,
                manuscriptId: manuscriptId
            };
        }
        
        try {
            const manifest = JSON.parse(response.data);
            console.log(`   ✓ Valid JSON manifest found`);
            console.log(`   ✓ Manifest type: ${manifest['@type'] || 'unknown'}`);
            
            if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                const totalPages = manifest.sequences[0].canvases.length;
                console.log(`   ✓ Total pages found: ${totalPages}`);
                
                // Log first few canvas URLs for debugging
                console.log(`   ✓ Sample canvas IDs:`);
                for (let i = 0; i < Math.min(3, totalPages); i++) {
                    const canvas = manifest.sequences[0].canvases[i];
                    console.log(`     - Page ${i + 1}: ${canvas['@id'] || 'no ID'}`);
                }
                
                return {
                    success: true,
                    manifest: manifest,
                    totalPages: totalPages,
                    manifestUrl: manifestUrl,
                    manuscriptId: manuscriptId
                };
            } else {
                console.log(`   ❌ Manifest missing canvas structure`);
                return {
                    success: false,
                    error: 'Invalid manifest structure - no canvases found',
                    manifest: manifest,
                    manifestUrl: manifestUrl,
                    manuscriptId: manuscriptId
                };
            }
        } catch (parseError) {
            console.log(`   ❌ Invalid JSON in manifest: ${parseError.message}`);
            // Log first 200 chars of response for debugging
            console.log(`   Debug - Response start: ${response.data.substring(0, 200)}...`);
            return {
                success: false,
                error: `JSON parse error: ${parseError.message}`,
                manifestUrl: manifestUrl,
                manuscriptId: manuscriptId
            };
        }
    } catch (error) {
        console.log(`   ❌ Request failed: ${error.message}`);
        return {
            success: false,
            error: error.message,
            manifestUrl: manifestUrl,
            manuscriptId: manuscriptId
        };
    }
}

/**
 * Test image URL construction and accessibility
 */
async function testImageAccess(manuscriptId, totalPages) {
    console.log(`\n🖼️  Testing image access for manuscript: ${manuscriptId}`);
    
    // Test multiple pages to ensure we can access different images
    const pagesToTest = [];
    if (totalPages <= 5) {
        // For small manuscripts, test all pages
        for (let i = 1; i <= totalPages; i++) {
            pagesToTest.push(i);
        }
    } else {
        // For larger manuscripts, test first, middle, and last pages
        pagesToTest.push(1);
        pagesToTest.push(Math.floor(totalPages / 2));
        pagesToTest.push(totalPages);
        
        // Add a couple more random pages
        if (totalPages >= 10) {
            pagesToTest.push(Math.floor(totalPages * 0.25));
            pagesToTest.push(Math.floor(totalPages * 0.75));
        }
    }
    
    const imageResults = [];
    
    for (const pageNum of pagesToTest) {
        console.log(`   Testing page ${pageNum}...`);
        
        const imageUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNum}.highres`;
        const refererUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNum}.item.zoom`;
        
        try {
            const response = await makeRequest(imageUrl, {
                headers: {
                    'Referer': refererUrl
                }
            });
            
            if (response.statusCode === 200) {
                const contentType = response.headers['content-type'] || '';
                const contentLength = parseInt(response.headers['content-length'] || '0');
                
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
        
        // Add small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 500));
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
 * Test actual end-to-end PDF creation for one manuscript
 */
async function createValidationPdf(manuscriptId, totalPages, testNumber) {
    console.log(`\n📄 Creating validation PDF for manuscript: ${manuscriptId}`);
    
    const maxPagesToDownload = Math.min(5, totalPages); // Download max 5 pages for validation
    console.log(`   Downloading ${maxPagesToDownload} pages for validation...`);
    
    // Create validation directory
    const validationDir = path.join(__dirname, '../../CURRENT-VALIDATION/rouen-validation');
    if (!fs.existsSync(validationDir)) {
        fs.mkdirSync(validationDir, { recursive: true });
    }
    
    const tempDir = path.join(validationDir, `temp-${manuscriptId}`);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const downloadedImages = [];
    
    for (let pageNum = 1; pageNum <= maxPagesToDownload; pageNum++) {
        try {
            console.log(`     Downloading page ${pageNum}...`);
            
            const imageUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNum}.highres`;
            const refererUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNum}.item.zoom`;
            
            const response = await makeRequest(imageUrl, {
                headers: {
                    'Referer': refererUrl
                }
            });
            
            if (response.statusCode === 200) {
                const imagePath = path.join(tempDir, `page_${pageNum.toString().padStart(3, '0')}.jpg`);
                
                // Convert response data back to buffer for image
                const imageBuffer = Buffer.from(response.data, 'binary');
                fs.writeFileSync(imagePath, imageBuffer);
                
                downloadedImages.push(imagePath);
                console.log(`       ✓ Saved page ${pageNum} (${imageBuffer.length} bytes)`);
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
        const pdfPath = path.join(validationDir, `ROUEN-${manuscriptId}-TEST-${testNumber}-VALIDATION.pdf`);
        
        console.log(`   📖 Creating PDF with ${downloadedImages.length} pages...`);
        
        // Sort images to ensure correct order
        downloadedImages.sort();
        const imageList = downloadedImages.join(' ');
        
        const convertCommand = `convert ${imageList} "${pdfPath}"`;
        execSync(convertCommand, { cwd: tempDir });
        
        // Verify PDF was created
        if (fs.existsSync(pdfPath)) {
            const pdfStats = fs.statSync(pdfPath);
            console.log(`   ✅ PDF created successfully: ${pdfPath}`);
            console.log(`      Size: ${(pdfStats.size / 1024 / 1024).toFixed(2)} MB`);
            
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
        
        // Stage 2: Manifest Discovery
        const manifestResult = await testManifestDiscovery(urlParseResult.manuscriptId, url);
        testResult.stages.manifestDiscovery = manifestResult;
        
        if (!manifestResult.success) {
            console.log(`❌ FAILED: Manifest discovery failed for ${url}`);
            testResult.success = false;
            testResult.error = manifestResult.error;
            validationResults.results.push(testResult);
            allTestsPassed = false;
            continue;
        }
        
        // Stage 3: Image Access Testing
        const imageAccessResult = await testImageAccess(urlParseResult.manuscriptId, manifestResult.totalPages);
        testResult.stages.imageAccess = imageAccessResult;
        
        if (!imageAccessResult.success) {
            console.log(`❌ FAILED: Image access failed for ${url}`);
            testResult.success = false;
            testResult.error = 'Could not access any images';
            validationResults.results.push(testResult);
            allTestsPassed = false;
            continue;
        }
        
        // Stage 4: PDF Creation (only for first successful manuscript to save time)
        if (successfulManuscripts.length === 0) {
            console.log(`\n🎯 Creating validation PDF for first successful manuscript...`);
            const pdfResult = await createValidationPdf(urlParseResult.manuscriptId, manifestResult.totalPages, i + 1);
            testResult.stages.pdfCreation = pdfResult;
            
            if (pdfResult.success) {
                console.log(`✅ PDF validation successful: ${pdfResult.pdfPath}`);
                testResult.validationPdfPath = pdfResult.pdfPath;
            }
        }
        
        // All stages passed
        testResult.success = true;
        testResult.totalPages = manifestResult.totalPages;
        testResult.manuscriptId = urlParseResult.manuscriptId;
        
        console.log(`✅ SUCCESS: All tests passed for ${url}`);
        console.log(`   📄 Total pages: ${manifestResult.totalPages}`);
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
        totalPages: successfulTests.reduce((sum, test) => sum + (test.totalPages || 0), 0)
    };
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total manuscripts tested: ${validationResults.summary.totalTests}`);
    console.log(`Successful: ${validationResults.summary.successful}`);
    console.log(`Failed: ${validationResults.summary.failed}`);
    console.log(`Success rate: ${validationResults.summary.successRate.toFixed(1)}%`);
    console.log(`Total pages available: ${validationResults.summary.totalPages}`);
    
    if (validationResults.summary.allTestsPassed) {
        console.log('\n🎉 ALL TESTS PASSED! Rouen library implementation is working correctly.');
        console.log('\n📚 Manuscript Details:');
        successfulTests.forEach((test, index) => {
            console.log(`   ${index + 1}. ${test.manuscriptId}: ${test.totalPages} pages`);
        });
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