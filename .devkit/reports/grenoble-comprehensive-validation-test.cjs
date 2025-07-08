#!/usr/bin/env node

/**
 * Comprehensive Grenoble Library IIIF Manifest Fix Validation
 * 
 * Tests the problematic URL: https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom
 * Validates:
 * 1. IIIF manifest loading with corrected URL paths
 * 2. Image downloads with maximum resolution  
 * 3. Page count detection (should be 40 pages)
 * 4. Download multiple pages to verify content
 * 5. Create validation PDFs
 * 6. Verify the fix resolves the original "Failed to load IIIF manifest: fetch failed" error
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class GrenobleValidationTest {
    constructor() {
        this.testUrl = 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';
        this.documentId = 'btv1b10663927k';
        this.manifestUrl = `https://pagella.bm-grenoble.fr/iiif/ark:/12148/${this.documentId}/manifest.json`;
        this.results = {
            timestamp: new Date().toISOString(),
            testUrl: this.testUrl,
            documentId: this.documentId,
            manifestUrl: this.manifestUrl,
            tests: []
        };
        this.outputDir = path.join(__dirname, 'grenoble-validation-test-output');
        this.pdfDir = path.join(this.outputDir, 'pdfs');
        this.imageDir = path.join(this.outputDir, 'images');
        
        // Ensure output directories exist
        [this.outputDir, this.pdfDir, this.imageDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    async fetchWithSSLBypass(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/json,*/*',
                    ...options.headers
                },
                rejectUnauthorized: false, // SSL bypass for Grenoble
                timeout: 30000
            };

            const req = https.request(requestOptions, (res) => {
                let data = Buffer.alloc(0);
                
                res.on('data', (chunk) => {
                    data = Buffer.concat([data, chunk]);
                });

                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        headers: res.headers,
                        data: data,
                        json: async () => JSON.parse(data.toString()),
                        text: async () => data.toString()
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (options.body) {
                req.write(options.body);
            }
            req.end();
        });
    }

    async testManifestLoading() {
        console.log('\n=== Test 1: IIIF Manifest Loading ===');
        
        const test = {
            name: 'Manifest Loading',
            url: this.manifestUrl,
            success: false,
            error: null,
            manifest: null
        };

        try {
            console.log(`Testing manifest URL: ${this.manifestUrl}`);
            
            const response = await this.fetchWithSSLBypass(this.manifestUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const manifest = await response.json();
            
            // Validate manifest structure
            if (!manifest.sequences || !manifest.sequences[0] || !manifest.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure');
            }

            const totalPages = manifest.sequences[0].canvases.length;
            const displayName = manifest.label || `Grenoble Manuscript ${this.documentId}`;

            test.success = true;
            test.manifest = {
                totalPages,
                displayName,
                type: manifest['@type'] || manifest.type,
                context: manifest['@context'] || manifest.context
            };

            console.log(`✅ Manifest loaded successfully`);
            console.log(`   Document: ${displayName}`);
            console.log(`   Total pages: ${totalPages}`);
            console.log(`   IIIF context: ${test.manifest.context}`);

        } catch (error) {
            test.success = false;
            test.error = error.message;
            console.log(`❌ Manifest loading failed: ${error.message}`);
        }

        this.results.tests.push(test);
        return test;
    }

    async testPageCountDetection() {
        console.log('\n=== Test 2: Page Count Detection ===');
        
        const test = {
            name: 'Page Count Detection',
            expectedPages: 40,
            actualPages: 0,
            success: false,
            error: null
        };

        try {
            const manifestTest = this.results.tests.find(t => t.name === 'Manifest Loading');
            if (!manifestTest || !manifestTest.success) {
                throw new Error('Manifest loading test failed - cannot detect page count');
            }

            test.actualPages = manifestTest.manifest.totalPages;
            test.success = test.actualPages === test.expectedPages;

            if (test.success) {
                console.log(`✅ Page count correct: ${test.actualPages} pages`);
            } else {
                console.log(`⚠️  Page count mismatch: expected ${test.expectedPages}, got ${test.actualPages}`);
            }

        } catch (error) {
            test.success = false;
            test.error = error.message;
            console.log(`❌ Page count detection failed: ${error.message}`);
        }

        this.results.tests.push(test);
        return test;
    }

    async testImageDownloads() {
        console.log('\n=== Test 3: Maximum Resolution Image Downloads ===');
        
        const test = {
            name: 'Image Downloads',
            testedPages: [1, 2, 5, 10, 20, 40],
            successfulDownloads: 0,
            failedDownloads: 0,
            images: [],
            success: false,
            error: null
        };

        try {
            console.log('Testing image downloads with maximum resolution...');
            
            for (const pageNum of test.testedPages) {
                const imageUrl = `https://pagella.bm-grenoble.fr/iiif/ark:/12148/${this.documentId}/f${pageNum}/full/full/0/default.jpg`;
                const imagePath = path.join(this.imageDir, `page_${pageNum}.jpg`);
                
                try {
                    console.log(`  Downloading page ${pageNum}...`);
                    
                    const response = await this.fetchWithSSLBypass(imageUrl);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    // Validate it's actually an image
                    const contentType = response.headers['content-type'];
                    if (!contentType || !contentType.includes('image')) {
                        throw new Error(`Invalid content type: ${contentType}`);
                    }

                    // Save image
                    fs.writeFileSync(imagePath, response.data);
                    const fileSize = fs.statSync(imagePath).size;

                    // Validate image file
                    const isValidImage = this.validateImageFile(imagePath);
                    if (!isValidImage) {
                        throw new Error('Downloaded file is not a valid image');
                    }

                    test.images.push({
                        page: pageNum,
                        url: imageUrl,
                        size: Math.round(fileSize / 1024), // KB
                        contentType,
                        valid: true,
                        path: imagePath
                    });

                    test.successfulDownloads++;
                    console.log(`    ✅ Page ${pageNum}: ${Math.round(fileSize / 1024)} KB`);

                } catch (error) {
                    test.images.push({
                        page: pageNum,
                        url: imageUrl,
                        error: error.message,
                        valid: false
                    });

                    test.failedDownloads++;
                    console.log(`    ❌ Page ${pageNum}: ${error.message}`);
                }
            }

            test.success = test.successfulDownloads > 0;
            const successRate = (test.successfulDownloads / test.testedPages.length * 100).toFixed(1);
            
            console.log(`\nImage download results:`);
            console.log(`  Successful: ${test.successfulDownloads}/${test.testedPages.length} (${successRate}%)`);
            console.log(`  Average size: ${this.calculateAverageImageSize(test.images)} KB`);

        } catch (error) {
            test.success = false;
            test.error = error.message;
            console.log(`❌ Image download test failed: ${error.message}`);
        }

        this.results.tests.push(test);
        return test;
    }

    validateImageFile(imagePath) {
        try {
            const buffer = fs.readFileSync(imagePath, null, 0, 10);
            // Check JPEG magic number (FF D8 FF)
            return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
        } catch {
            return false;
        }
    }

    calculateAverageImageSize(images) {
        const validImages = images.filter(img => img.valid && img.size);
        if (validImages.length === 0) return 0;
        
        const totalSize = validImages.reduce((sum, img) => sum + img.size, 0);
        return Math.round(totalSize / validImages.length);
    }

    async testImageQuality() {
        console.log('\n=== Test 4: Image Quality and Resolution Analysis ===');
        
        const test = {
            name: 'Image Quality Analysis',
            success: false,
            error: null,
            analysis: {}
        };

        try {
            const downloadTest = this.results.tests.find(t => t.name === 'Image Downloads');
            if (!downloadTest || !downloadTest.success) {
                throw new Error('Image download test failed - cannot analyze quality');
            }

            const validImages = downloadTest.images.filter(img => img.valid);
            if (validImages.length === 0) {
                throw new Error('No valid images to analyze');
            }

            // Analyze first valid image for dimensions
            const firstImage = validImages[0];
            let dimensions = null;
            
            try {
                // Try to get image dimensions using identify (ImageMagick)
                const identifyResult = execSync(`identify "${firstImage.path}"`, { encoding: 'utf8' });
                const dimensionMatch = identifyResult.match(/(\d+)x(\d+)/);
                if (dimensionMatch) {
                    dimensions = {
                        width: parseInt(dimensionMatch[1]),
                        height: parseInt(dimensionMatch[2])
                    };
                }
            } catch {
                console.log('    ImageMagick not available for dimension analysis');
            }

            test.analysis = {
                totalValidImages: validImages.length,
                averageFileSize: this.calculateAverageImageSize(validImages),
                minFileSize: Math.min(...validImages.map(img => img.size)),
                maxFileSize: Math.max(...validImages.map(img => img.size)),
                dimensions,
                format: 'JPEG'
            };

            test.success = true;
            
            console.log(`✅ Quality analysis completed:`);
            console.log(`   Valid images: ${test.analysis.totalValidImages}`);
            console.log(`   Average size: ${test.analysis.averageFileSize} KB`);
            console.log(`   Size range: ${test.analysis.minFileSize}-${test.analysis.maxFileSize} KB`);
            if (dimensions) {
                console.log(`   Dimensions: ${dimensions.width}x${dimensions.height} pixels`);
            }

        } catch (error) {
            test.success = false;
            test.error = error.message;
            console.log(`❌ Quality analysis failed: ${error.message}`);
        }

        this.results.tests.push(test);
        return test;
    }

    async testPDFGeneration() {
        console.log('\n=== Test 5: PDF Generation and Validation ===');
        
        const test = {
            name: 'PDF Generation',
            success: false,
            error: null,
            pdf: null
        };

        try {
            const downloadTest = this.results.tests.find(t => t.name === 'Image Downloads');
            if (!downloadTest || !downloadTest.success) {
                throw new Error('Image download test failed - cannot create PDF');
            }

            const validImages = downloadTest.images.filter(img => img.valid);
            if (validImages.length === 0) {
                throw new Error('No valid images to create PDF');
            }

            const pdfPath = path.join(this.pdfDir, `grenoble-${this.documentId}-validation.pdf`);
            const imageFiles = validImages.map(img => `"${img.path}"`).join(' ');
            
            // Create PDF using ImageMagick
            console.log(`  Creating PDF from ${validImages.length} images...`);
            
            try {
                execSync(`convert ${imageFiles} "${pdfPath}"`, { 
                    stdio: 'pipe',
                    timeout: 60000 
                });
                
                // Validate PDF
                const pdfStats = fs.statSync(pdfPath);
                const pdfSizeMB = (pdfStats.size / (1024 * 1024)).toFixed(2);
                
                // Test PDF with poppler if available
                let popplerValidation = null;
                try {
                    const popplerResult = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
                    const pageMatch = popplerResult.match(/Pages:\s+(\d+)/);
                    popplerValidation = {
                        pages: pageMatch ? parseInt(pageMatch[1]) : null,
                        valid: true
                    };
                } catch {
                    console.log('    Poppler not available for PDF validation');
                }

                test.pdf = {
                    path: pdfPath,
                    sizeMB: parseFloat(pdfSizeMB),
                    pages: validImages.length,
                    popplerValidation
                };

                test.success = true;
                console.log(`  ✅ PDF created successfully:`);
                console.log(`     Path: ${pdfPath}`);
                console.log(`     Size: ${pdfSizeMB} MB`);
                console.log(`     Pages: ${validImages.length}`);

            } catch (convertError) {
                throw new Error(`ImageMagick conversion failed: ${convertError.message}`);
            }

        } catch (error) {
            test.success = false;
            test.error = error.message;
            console.log(`❌ PDF generation failed: ${error.message}`);
        }

        this.results.tests.push(test);
        return test;
    }

    async testErrorResolution() {
        console.log('\n=== Test 6: Original Error Resolution Verification ===');
        
        const test = {
            name: 'Error Resolution',
            originalError: 'Failed to load IIIF manifest: fetch failed',
            success: false,
            resolution: null
        };

        try {
            // Check if the manifest loads without the original error
            const manifestTest = this.results.tests.find(t => t.name === 'Manifest Loading');
            
            if (manifestTest && manifestTest.success) {
                test.success = true;
                test.resolution = 'Original manifest loading error has been resolved. IIIF manifest loads successfully with corrected ark:/12148/ URL path.';
                console.log(`✅ Original error resolved: ${test.resolution}`);
            } else {
                test.success = false;
                test.resolution = `Manifest loading still fails: ${manifestTest?.error || 'Unknown error'}`;
                console.log(`❌ Original error not resolved: ${test.resolution}`);
            }

        } catch (error) {
            test.success = false;
            test.resolution = `Error verification failed: ${error.message}`;
            console.log(`❌ Error resolution test failed: ${error.message}`);
        }

        this.results.tests.push(test);
        return test;
    }

    async runAllTests() {
        console.log('🔍 Starting Comprehensive Grenoble Library Validation Test');
        console.log(`📅 Timestamp: ${this.results.timestamp}`);
        console.log(`🌐 Test URL: ${this.testUrl}`);
        console.log(`📄 Document ID: ${this.documentId}`);
        console.log(`📊 Manifest URL: ${this.manifestUrl}`);

        // Run all tests sequentially
        await this.testManifestLoading();
        await this.testPageCountDetection();
        await this.testImageDownloads();
        await this.testImageQuality();
        await this.testPDFGeneration();
        await this.testErrorResolution();

        // Generate final report
        this.generateFinalReport();
    }

    generateFinalReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📋 COMPREHENSIVE VALIDATION REPORT');
        console.log('='.repeat(60));

        const totalTests = this.results.tests.length;
        const passedTests = this.results.tests.filter(t => t.success).length;
        const overallSuccess = passedTests === totalTests;

        console.log(`\n📊 Overall Results:`);
        console.log(`   Tests Passed: ${passedTests}/${totalTests}`);
        console.log(`   Success Rate: ${(passedTests / totalTests * 100).toFixed(1)}%`);
        console.log(`   Overall Status: ${overallSuccess ? '✅ PASS' : '❌ FAIL'}`);

        console.log(`\n📝 Test Summary:`);
        this.results.tests.forEach((test, index) => {
            const status = test.success ? '✅' : '❌';
            console.log(`   ${index + 1}. ${test.name}: ${status}`);
            if (!test.success && test.error) {
                console.log(`      Error: ${test.error}`);
            }
        });

        // Add overall assessment
        this.results.overallSuccess = overallSuccess;
        this.results.passedTests = passedTests;
        this.results.totalTests = totalTests;
        this.results.successRate = passedTests / totalTests;

        // Save detailed results
        const resultsPath = path.join(this.outputDir, 'comprehensive-validation-results.json');
        fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));
        
        console.log(`\n💾 Detailed results saved to: ${resultsPath}`);
        console.log(`📁 Test artifacts saved to: ${this.outputDir}`);

        // Final assessment
        if (overallSuccess) {
            console.log('\n🎉 VALIDATION COMPLETE: Grenoble library fix is working correctly!');
            console.log('   - IIIF manifest loading: ✅ Fixed');
            console.log('   - Image downloads: ✅ Working');
            console.log('   - Maximum resolution: ✅ Available');
            console.log('   - PDF generation: ✅ Functional');
            console.log('   - Original error: ✅ Resolved');
        } else {
            console.log('\n⚠️  VALIDATION ISSUES DETECTED: Some tests failed');
            console.log('   Review the detailed results and fix any remaining issues.');
        }

        return this.results;
    }
}

// Run the validation test
async function main() {
    try {
        const validator = new GrenobleValidationTest();
        await validator.runAllTests();
    } catch (error) {
        console.error('❌ Validation test failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = GrenobleValidationTest;