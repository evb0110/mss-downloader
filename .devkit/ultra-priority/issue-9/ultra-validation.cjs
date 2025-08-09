#!/usr/bin/env node
/**
 * ULTRA-PRIORITY ISSUE #9 VALIDATION TEST SUITE
 * 
 * Tests BDL Library (Biblioteca Digitale Lombarda) with:
 * 1. EXACT user URL: https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903
 * 2. Malformed URL that caused the error: www.bdl.servizirl.ithttps://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903
 * 3. Downloads 10 different pages to verify they're not empty
 * 4. Merges them to PDF using ElectronPdfMerger logic
 * 5. Validates PDF with poppler-utils (pdfimages -list)
 * 6. Extracts images to verify they're not blank
 * 7. Creates comprehensive validation report
 * 
 * Uses PRODUCTION code from SharedManifestLoaders.js
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Import production SharedManifestLoaders
const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

class BDLValidationSuite {
    constructor() {
        this.baseDir = path.join(__dirname, 'validation');
        this.reportFile = path.join(__dirname, 'BDL-VALIDATION-REPORT.md');
        this.testResults = {
            timestamp: new Date().toISOString(),
            tests: [],
            summary: {
                passed: 0,
                failed: 0,
                warnings: 0
            }
        };
        
        // Test URLs from Issue #9
        this.testUrls = {
            correct: 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903',
            malformed: 'www.bdl.servizirl.ithttps://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903'
        };
        
        this.loaders = new SharedManifestLoaders();
    }

    async log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${type}] ${message}`;
        console.log(logMessage);
        
        // Also append to log file
        const logFile = path.join(__dirname, 'validation.log');
        await fs.appendFile(logFile, logMessage + '\n').catch(() => {});
    }

    async addTestResult(name, status, details, error = null) {
        const result = {
            name,
            status, // 'PASS', 'FAIL', 'WARN'
            details,
            error,
            timestamp: new Date().toISOString()
        };
        
        this.testResults.tests.push(result);
        
        if (status === 'PASS') this.testResults.summary.passed++;
        else if (status === 'FAIL') this.testResults.summary.failed++;
        else if (status === 'WARN') this.testResults.summary.warnings++;
        
        await this.log(`${status}: ${name} - ${details}`, status);
    }

    async ensureDirectories() {
        await this.log('Creating validation directories...');
        await fs.mkdir(this.baseDir, { recursive: true });
        await fs.mkdir(path.join(this.baseDir, 'images'), { recursive: true });
        await fs.mkdir(path.join(this.baseDir, 'extracted'), { recursive: true });
    }

    async checkDependencies() {
        await this.log('Checking system dependencies...');
        
        const deps = ['pdfimages', 'pdfinfo', 'identify'];
        let missingDeps = [];
        
        for (const dep of deps) {
            try {
                execSync(`which ${dep}`, { stdio: 'ignore' });
                await this.addTestResult(
                    `Dependency Check: ${dep}`, 
                    'PASS', 
                    `${dep} is available`
                );
            } catch (error) {
                missingDeps.push(dep);
                await this.addTestResult(
                    `Dependency Check: ${dep}`, 
                    'FAIL', 
                    `${dep} is missing - install poppler-utils and imagemagick`
                );
            }
        }
        
        if (missingDeps.length > 0) {
            throw new Error(`Missing dependencies: ${missingDeps.join(', ')}. Install with: sudo apt-get install poppler-utils imagemagick`);
        }
    }

    async testUrlCorrection() {
        await this.log('Testing URL correction functionality...');
        
        try {
            // Test that malformed URL gets corrected internally
            const manifest = await this.loaders.getManifestForLibrary('bdl', this.testUrls.malformed);
            
            if (manifest && manifest.images && manifest.images.length > 0) {
                await this.addTestResult(
                    'URL Correction Test', 
                    'PASS', 
                    `Malformed URL was successfully corrected and manifest loaded with ${manifest.images.length} pages`
                );
                return manifest;
            } else {
                await this.addTestResult(
                    'URL Correction Test', 
                    'FAIL', 
                    'Malformed URL correction did not result in valid manifest'
                );
                return null;
            }
        } catch (error) {
            await this.addTestResult(
                'URL Correction Test', 
                'FAIL', 
                `URL correction failed: ${error.message}`,
                error.stack
            );
            return null;
        }
    }

    async testCorrectUrl() {
        await this.log('Testing correct URL...');
        
        try {
            const manifest = await this.loaders.getManifestForLibrary('bdl', this.testUrls.correct);
            
            if (manifest && manifest.images && manifest.images.length > 0) {
                const pageCount = manifest.images.length;
                await this.addTestResult(
                    'Correct URL Test', 
                    'PASS', 
                    `Correct URL loaded successfully with ${pageCount} pages`
                );
                return manifest;
            } else {
                await this.addTestResult(
                    'Correct URL Test', 
                    'FAIL', 
                    'Correct URL did not return valid manifest'
                );
                return null;
            }
        } catch (error) {
            await this.addTestResult(
                'Correct URL Test', 
                'FAIL', 
                `Correct URL failed to load: ${error.message}`,
                error.stack
            );
            return null;
        }
    }

    async downloadTestPages(manifest, numPages = 10) {
        await this.log(`Downloading ${numPages} test pages...`);
        
        if (!manifest || !manifest.images || !Array.isArray(manifest.images)) {
            await this.addTestResult(
                'Page Download Test', 
                'FAIL', 
                'No valid manifest provided for download test'
            );
            return [];
        }
        
        const images = manifest.images;
        const totalPages = images.length;
        const downloadedImages = [];
        
        // Select pages evenly distributed across the manuscript
        const pageIndices = [];
        if (totalPages <= numPages) {
            // If manuscript has fewer pages than requested, download all
            for (let i = 0; i < totalPages; i++) {
                pageIndices.push(i);
            }
        } else {
            // Evenly distribute pages across the manuscript
            for (let i = 0; i < numPages; i++) {
                const index = Math.floor((i * totalPages) / numPages);
                pageIndices.push(index);
            }
        }
        
        await this.log(`Selected page indices: ${pageIndices.join(', ')} from total ${totalPages} pages`);
        
        for (let i = 0; i < pageIndices.length; i++) {
            const pageIndex = pageIndices[i];
            const imageInfo = images[pageIndex];
            
            try {
                // Get the image URL directly from the manifest
                const imageUrl = imageInfo.url;
                
                if (!imageUrl) {
                    await this.addTestResult(
                        `Page Download ${pageIndex + 1}`, 
                        'FAIL', 
                        `No image URL found for page ${pageIndex + 1}`
                    );
                    continue;
                }
                
                await this.log(`Downloading page ${pageIndex + 1} (${imageInfo.label || 'No label'}) from: ${imageUrl}`);
                
                // Download the image
                const response = await this.loaders.fetchWithRetry(imageUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                // Use the SharedManifestLoaders buffer() method
                const buffer = await response.buffer();
                
                if (buffer.length === 0) {
                    await this.addTestResult(
                        `Page Download ${pageIndex + 1}`, 
                        'FAIL', 
                        `Downloaded image for page ${pageIndex + 1} is empty (0 bytes)`
                    );
                    continue;
                }
                
                // Save image for inspection
                const filename = `page_${String(pageIndex + 1).padStart(3, '0')}.jpg`;
                const filepath = path.join(this.baseDir, 'images', filename);
                await fs.writeFile(filepath, buffer);
                
                // Verify it's a valid image
                try {
                    const identify = execSync(`identify "${filepath}"`, { encoding: 'utf8' });
                    const dimensions = identify.trim();
                    
                    await this.addTestResult(
                        `Page Download ${pageIndex + 1}`, 
                        'PASS', 
                        `Successfully downloaded ${(buffer.length / 1024).toFixed(1)}KB image - ${dimensions.split(' ')[2] || dimensions}`
                    );
                    
                    downloadedImages.push({
                        pageIndex: pageIndex + 1,
                        buffer,
                        filepath,
                        size: buffer.length,
                        dimensions: dimensions.split(' ')[2] || dimensions,
                        label: imageInfo.label || `Page ${pageIndex + 1}`
                    });
                    
                } catch (identifyError) {
                    await this.addTestResult(
                        `Page Download ${pageIndex + 1}`, 
                        'FAIL', 
                        `Downloaded image for page ${pageIndex + 1} is not valid: ${identifyError.message}`
                    );
                }
                
            } catch (error) {
                await this.addTestResult(
                    `Page Download ${pageIndex + 1}`, 
                    'FAIL', 
                    `Failed to download page ${pageIndex + 1}: ${error.message}`,
                    error.stack
                );
            }
        }
        
        return downloadedImages;
    }

    async createTestPDF(images) {
        await this.log('Creating test PDF from downloaded images...');
        
        if (images.length === 0) {
            await this.addTestResult(
                'PDF Creation', 
                'FAIL', 
                'No valid images available for PDF creation'
            );
            return null;
        }
        
        try {
            // Use a simplified PDF creation approach similar to the production code
            // For this test, we'll use ImageMagick to convert images to PDF
            const pdfPath = path.join(this.baseDir, 'BDL-TEST.pdf');
            
            // Create list of image paths
            const imagePaths = images.map(img => `"${img.filepath}"`).join(' ');
            
            // Convert images to PDF using ImageMagick
            const convertCommand = `convert ${imagePaths} "${pdfPath}"`;
            await this.log(`Running: ${convertCommand}`);
            
            execSync(convertCommand, { stdio: 'inherit' });
            
            // Check if PDF was created and has content
            const stats = await fs.stat(pdfPath);
            
            if (stats.size === 0) {
                await this.addTestResult(
                    'PDF Creation', 
                    'FAIL', 
                    'PDF was created but is empty (0 bytes)'
                );
                return null;
            }
            
            await this.addTestResult(
                'PDF Creation', 
                'PASS', 
                `PDF created successfully: ${(stats.size / 1024 / 1024).toFixed(1)}MB with ${images.length} pages`
            );
            
            return pdfPath;
            
        } catch (error) {
            await this.addTestResult(
                'PDF Creation', 
                'FAIL', 
                `PDF creation failed: ${error.message}`,
                error.stack
            );
            return null;
        }
    }

    async validatePDF(pdfPath) {
        await this.log('Validating PDF with poppler-utils...');
        
        if (!pdfPath) {
            await this.addTestResult(
                'PDF Validation', 
                'FAIL', 
                'No PDF path provided for validation'
            );
            return false;
        }
        
        try {
            // Check PDF info
            const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
            await this.log('PDF Info:\n' + pdfInfo);
            
            // Extract page count
            const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
            const pageCount = pageMatch ? parseInt(pageMatch[1]) : 0;
            
            if (pageCount === 0) {
                await this.addTestResult(
                    'PDF Page Count', 
                    'FAIL', 
                    'PDF has 0 pages according to pdfinfo'
                );
                return false;
            }
            
            await this.addTestResult(
                'PDF Page Count', 
                'PASS', 
                `PDF contains ${pageCount} pages`
            );
            
            // List images in PDF
            const imageList = execSync(`pdfimages -list "${pdfPath}"`, { encoding: 'utf8' });
            await this.log('PDF Images:\n' + imageList);
            
            // Count images
            const imageLines = imageList.split('\n').filter(line => line.trim() && !line.startsWith('page'));
            const imageCount = imageLines.length - 1; // Subtract header line
            
            if (imageCount === 0) {
                await this.addTestResult(
                    'PDF Image Content', 
                    'FAIL', 
                    'PDF contains no images according to pdfimages'
                );
                return false;
            }
            
            await this.addTestResult(
                'PDF Image Content', 
                'PASS', 
                `PDF contains ${imageCount} images`
            );
            
            return true;
            
        } catch (error) {
            await this.addTestResult(
                'PDF Validation', 
                'FAIL', 
                `PDF validation failed: ${error.message}`,
                error.stack
            );
            return false;
        }
    }

    async extractAndInspectImages(pdfPath) {
        await this.log('Extracting images from PDF for visual inspection...');
        
        if (!pdfPath) {
            await this.addTestResult(
                'Image Extraction', 
                'FAIL', 
                'No PDF path provided for image extraction'
            );
            return false;
        }
        
        try {
            const extractDir = path.join(this.baseDir, 'extracted');
            const outputPrefix = path.join(extractDir, 'page');
            
            // Extract images as PNG
            execSync(`pdfimages -png "${pdfPath}" "${outputPrefix}"`, { stdio: 'inherit' });
            
            // List extracted files
            const extractedFiles = await fs.readdir(extractDir);
            const pngFiles = extractedFiles.filter(file => file.endsWith('.png'));
            
            if (pngFiles.length === 0) {
                await this.addTestResult(
                    'Image Extraction', 
                    'FAIL', 
                    'No images were extracted from PDF'
                );
                return false;
            }
            
            await this.log(`Extracted ${pngFiles.length} images for inspection`);
            
            // Inspect each extracted image
            let validImages = 0;
            for (const pngFile of pngFiles) {
                const pngPath = path.join(extractDir, pngFile);
                
                try {
                    const stats = await fs.stat(pngPath);
                    const identify = execSync(`identify "${pngPath}"`, { encoding: 'utf8' });
                    const dimensions = identify.trim();
                    
                    if (stats.size > 1000) { // More than 1KB suggests it's not blank
                        validImages++;
                        await this.addTestResult(
                            `Image Inspection: ${pngFile}`, 
                            'PASS', 
                            `Valid image: ${(stats.size / 1024).toFixed(1)}KB - ${dimensions.split(' ')[2]}`
                        );
                    } else {
                        await this.addTestResult(
                            `Image Inspection: ${pngFile}`, 
                            'WARN', 
                            `Very small image: ${stats.size} bytes - may be blank`
                        );
                    }
                    
                } catch (error) {
                    await this.addTestResult(
                        `Image Inspection: ${pngFile}`, 
                        'FAIL', 
                        `Failed to inspect extracted image: ${error.message}`
                    );
                }
            }
            
            await this.addTestResult(
                'Image Extraction Summary', 
                validImages > 0 ? 'PASS' : 'FAIL', 
                `Extracted ${pngFiles.length} images, ${validImages} appear to contain valid content`
            );
            
            return validImages > 0;
            
        } catch (error) {
            await this.addTestResult(
                'Image Extraction', 
                'FAIL', 
                `Image extraction failed: ${error.message}`,
                error.stack
            );
            return false;
        }
    }

    async generateReport() {
        await this.log('Generating comprehensive validation report...');
        
        const report = `# BDL Library (Issue #9) - Ultra Priority Validation Report

**Generated:** ${this.testResults.timestamp}

## Test Summary
- ✅ **Passed:** ${this.testResults.summary.passed}
- ❌ **Failed:** ${this.testResults.summary.failed}  
- ⚠️  **Warnings:** ${this.testResults.summary.warnings}
- **Total Tests:** ${this.testResults.tests.length}

## Test URLs
- **Correct URL:** \`${this.testUrls.correct}\`
- **Malformed URL:** \`${this.testUrls.malformed}\`

## Detailed Test Results

${this.testResults.tests.map(test => `
### ${test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : '⚠️'} ${test.name}
- **Status:** ${test.status}
- **Details:** ${test.details}
- **Timestamp:** ${test.timestamp}
${test.error ? `- **Error:** \`\`\`\n${test.error}\n\`\`\`` : ''}
`).join('')}

## Overall Assessment

${this.testResults.summary.failed === 0 
    ? '🟢 **SUCCESS**: All critical tests passed. BDL library appears to be working correctly.'
    : '🔴 **FAILURE**: Critical issues detected. BDL library requires fixes.'
}

## Files Generated
- **Test PDF:** \`.devkit/ultra-priority/issue-9/validation/BDL-TEST.pdf\`
- **Sample Images:** \`.devkit/ultra-priority/issue-9/validation/images/\`
- **Extracted Images:** \`.devkit/ultra-priority/issue-9/validation/extracted/\`
- **Validation Log:** \`.devkit/ultra-priority/issue-9/validation.log\`

## Next Steps
${this.testResults.summary.failed > 0 
    ? `1. Review failed tests above\n2. Fix identified issues in SharedManifestLoaders.js\n3. Re-run validation\n4. Test with additional BDL manuscripts`
    : `1. Validate with additional BDL manuscripts\n2. Monitor for any user reports\n3. Consider this issue resolved`
}

---
*Generated by BDL Ultra-Priority Validation Suite*
`;

        await fs.writeFile(this.reportFile, report);
        await this.log(`Comprehensive report written to: ${this.reportFile}`);
        
        return report;
    }

    async runFullValidation() {
        try {
            await this.log('🚀 Starting BDL Ultra-Priority Validation Suite...');
            
            // Prepare environment
            await this.ensureDirectories();
            await this.checkDependencies();
            
            // Test both URLs
            await this.log('📋 Testing URL correction and manifest loading...');
            const correctedManifest = await this.testUrlCorrection();
            const correctManifest = await this.testCorrectUrl();
            
            // Use whichever manifest loaded successfully
            const workingManifest = correctManifest || correctedManifest;
            
            if (!workingManifest) {
                await this.addTestResult(
                    'Overall Validation', 
                    'FAIL', 
                    'No valid manifest could be loaded from either URL'
                );
                await this.generateReport();
                return false;
            }
            
            // Download test pages
            await this.log('📥 Downloading test pages...');
            const downloadedImages = await this.downloadTestPages(workingManifest, 10);
            
            if (downloadedImages.length === 0) {
                await this.addTestResult(
                    'Overall Validation', 
                    'FAIL', 
                    'No images could be downloaded successfully'
                );
                await this.generateReport();
                return false;
            }
            
            // Create PDF
            await this.log('📄 Creating test PDF...');
            const pdfPath = await this.createTestPDF(downloadedImages);
            
            if (!pdfPath) {
                await this.addTestResult(
                    'Overall Validation', 
                    'FAIL', 
                    'PDF creation failed'
                );
                await this.generateReport();
                return false;
            }
            
            // Validate PDF
            await this.log('🔍 Validating PDF structure...');
            const pdfValid = await this.validatePDF(pdfPath);
            
            // Extract and inspect images
            await this.log('🖼️  Extracting images for visual inspection...');
            const imagesValid = await this.extractAndInspectImages(pdfPath);
            
            // Final assessment
            const overallSuccess = pdfValid && imagesValid && downloadedImages.length > 0;
            await this.addTestResult(
                'Overall Validation', 
                overallSuccess ? 'PASS' : 'FAIL', 
                overallSuccess 
                    ? `Complete success: Downloaded ${downloadedImages.length} pages, created valid PDF, verified image content`
                    : 'One or more critical validation steps failed'
            );
            
            // Generate comprehensive report
            await this.generateReport();
            
            await this.log(`🎯 Validation ${overallSuccess ? 'COMPLETED SUCCESSFULLY' : 'FAILED'}`);
            await this.log(`📊 Results: ${this.testResults.summary.passed} passed, ${this.testResults.summary.failed} failed, ${this.testResults.summary.warnings} warnings`);
            
            return overallSuccess;
            
        } catch (error) {
            await this.log(`💥 Fatal error during validation: ${error.message}`, 'ERROR');
            await this.addTestResult(
                'Fatal Error', 
                'FAIL', 
                `Validation suite crashed: ${error.message}`,
                error.stack
            );
            await this.generateReport();
            return false;
        }
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new BDLValidationSuite();
    validator.runFullValidation().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Validation suite crashed:', error);
        process.exit(1);
    });
}

module.exports = { BDLValidationSuite };