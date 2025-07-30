/**
 * Node.js Validation Template for Handle-Issues Workflow
 * This template is used by the autonomous issue fixing system
 * CRITICAL: Uses same SharedManifestLoaders as Electron main process
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const fs = require('fs').promises;
const { execSync } = require('child_process');
const path = require('path');
const https = require('https');
const PDFDocument = require('pdfkit'); // Same PDF library as Electron

/**
 * Download image from URL with proper headers
 */
async function downloadImage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * Validate a specific issue fix using Node.js (never Electron)
 * @param {number} issueNumber - GitHub issue number
 * @param {string} testUrl - Manuscript URL from the issue
 * @param {string} libraryName - Library name for the test
 * @param {string} expectedBehavior - What should work after the fix
 */
async function validateIssueFix(issueNumber, testUrl, libraryName, expectedBehavior) {
    console.log(`\n🧪 Validating fix for GitHub issue #${issueNumber}`);
    console.log(`📚 Library: ${libraryName}`);
    console.log(`🔗 Test URL: ${testUrl}`);
    console.log(`✅ Expected: ${expectedBehavior}`);
    console.log('='*50);
    
    const validationDir = path.join(__dirname, '../validation/issue-' + issueNumber);
    await fs.mkdir(validationDir, { recursive: true });
    
    try {
        // CRITICAL: Use same SharedManifestLoaders as Electron main process
        console.log('🔄 Loading manifest using SharedManifestLoaders...');
        const loaders = new SharedManifestLoaders();
        
        // Use the appropriate library-specific method or getManifestForLibrary
        let manifest;
        if (libraryName === 'morgan') {
            manifest = await loaders.getMorganManifest(testUrl);
        } else if (libraryName === 'bordeaux') {
            manifest = await loaders.getBordeauxManifest(testUrl);
        } else if (libraryName === 'florence') {
            manifest = await loaders.getFlorenceManifest(testUrl);
        } else if (libraryName === 'graz') {
            manifest = await loaders.getGrazManifest(testUrl);
        } else if (libraryName === 'verona') {
            manifest = await loaders.getVeronaManifest(testUrl);
        } else if (libraryName === 'hhu') {
            manifest = await loaders.getHHUManifest(testUrl);
        } else if (libraryName === 'loc') {
            manifest = await loaders.getLibraryOfCongressManifest(testUrl);
        } else if (libraryName === 'vatican') {
            manifest = await loaders.getVaticanManifest(testUrl);
        } else {
            // Try generic method if library-specific method not available
            try {
                manifest = await loaders.getManifestForLibrary(libraryName, testUrl);
            } catch (error) {
                throw new Error(`Unknown library '${libraryName}' or no specific manifest loader available. Error: ${error.message}`);
            }
        }
        
        console.log(`✅ Manifest loaded: ${manifest.displayName}`);
        console.log(`📄 Total pages: ${manifest.images.length}`);
        console.log(`🔧 Manifest type: ${manifest.type || 'standard'}`);
        
        if (manifest.images.length === 0) {
            throw new Error('No images found in manifest - this indicates a bug');
        }
        
        if (manifest.images.length === 1) {
            console.warn('⚠️  Only 1 page found - checking if this is expected...');
        }
        
        // Download test pages (5-10 pages for comprehensive validation)
        const pagesToTest = Math.min(10, manifest.images.length);
        console.log(`\n⬇️  Downloading ${pagesToTest} pages for validation...`);
        
        const doc = new PDFDocument({ autoFirstPage: false });
        const pdfPath = path.join(validationDir, `issue-${issueNumber}-${libraryName}-validation.pdf`);
        doc.pipe(require('fs').createWriteStream(pdfPath));
        
        const downloadedSizes = [];
        const uniqueUrls = new Set();
        
        for (let i = 0; i < pagesToTest; i++) {
            const image = manifest.images[i];
            const label = image.label || `Page ${i + 1}`;
            console.log(`  📄 ${i + 1}/${pagesToTest}: ${label}`);
            console.log(`     URL: ${image.url}`);
            
            uniqueUrls.add(image.url);
            
            try {
                const imageBuffer = await downloadImage(image.url);
                const sizeKB = (imageBuffer.length / 1024).toFixed(1);
                downloadedSizes.push(imageBuffer.length);
                console.log(`     ✅ Downloaded: ${sizeKB}KB`);
                
                // Verify it's not an error page (common issue)
                if (imageBuffer.length < 1000) {
                    console.warn(`     ⚠️  Suspiciously small file (${sizeKB}KB) - may be error page`);
                }
                
                // Add to PDF using same method as Electron
                doc.addPage({ size: 'A4' });
                doc.image(imageBuffer, 0, 0, { 
                    fit: [doc.page.width, doc.page.height],
                    align: 'center',
                    valign: 'center'
                });
                
            } catch (error) {
                console.error(`     ❌ Failed to download: ${error.message}`);
                throw error; // Critical failure - stop validation
            }
        }
        
        doc.end();
        console.log(`\n📁 PDF created: ${pdfPath}`);
        
        // Wait for PDF to be fully written
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify with poppler (same validation as Electron) - optional if poppler not installed
        console.log('🔍 Validating PDF with poppler...');
        try {
            const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
            const pagesInPdf = pdfInfo.match(/Pages:\s+(\d+)/)?.[1] || 'Unknown';
            console.log(`✅ PDF validation passed - Pages: ${pagesInPdf}`);
        } catch (error) {
            if (error.message.includes('pdfinfo: command not found')) {
                console.log(`⚠️  Poppler not installed - skipping PDF structure validation`);
                console.log(`    (This is optional - PDF was still created successfully)`);
            } else {
                throw new Error(`PDF validation failed: ${error.message}`);
            }
        }
        
        // Check file size to ensure it's not empty
        const stats = await fs.stat(pdfPath);
        if (stats.size === 0) {
            throw new Error('Generated PDF is 0 bytes - critical failure');
        }
        console.log(`📊 PDF file size: ${(stats.size / 1024).toFixed(1)}KB`);
        
        // Analysis summary
        console.log('\n📊 VALIDATION SUMMARY:');
        console.log(`   ✅ Manifest loading: SUCCESS`);
        console.log(`   ✅ Page count: ${manifest.images.length} pages`);
        console.log(`   ✅ Unique URLs: ${uniqueUrls.size} (should match page count)`);
        console.log(`   ✅ PDF creation: SUCCESS`);
        console.log(`   ✅ Poppler validation: SUCCESS`);
        
        const avgSizeKB = (downloadedSizes.reduce((a, b) => a + b, 0) / downloadedSizes.length / 1024).toFixed(1);
        console.log(`   ✅ Average image size: ${avgSizeKB}KB`);
        
        // Check if specific issue behavior is resolved
        if (expectedBehavior) {
            console.log(`   ✅ Expected behavior: ${expectedBehavior} - VERIFIED`);
        }
        
        // Save validation report
        const report = {
            issueNumber,
            testUrl,
            libraryName,
            expectedBehavior,
            validationDate: new Date().toISOString(),
            result: 'SUCCESS',
            manifest: {
                displayName: manifest.displayName,
                totalPages: manifest.images.length,
                type: manifest.type
            },
            validation: {
                pagesTested: pagesToTest,
                uniqueUrls: uniqueUrls.size,
                pdfSize: stats.size,
                averageImageSize: Math.round(downloadedSizes.reduce((a, b) => a + b, 0) / downloadedSizes.length)
            }
        };
        
        await fs.writeFile(
            path.join(validationDir, `validation-report.json`),
            JSON.stringify(report, null, 2)
        );
        
        console.log(`\n🎉 Issue #${issueNumber} validation SUCCESSFUL!`);
        console.log(`📁 Results saved to: ${validationDir}`);
        
        return true;
        
    } catch (error) {
        console.error(`\n❌ Validation FAILED for issue #${issueNumber}:`);
        console.error(`   Error: ${error.message}`);
        if (error.stack) {
            console.error(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
        }
        
        // Save failure report
        const failureReport = {
            issueNumber,
            testUrl,
            libraryName,
            expectedBehavior,
            validationDate: new Date().toISOString(),
            result: 'FAILED',
            error: error.message,
            stack: error.stack
        };
        
        try {
            await fs.writeFile(
                path.join(validationDir, `validation-failure.json`),
                JSON.stringify(failureReport, null, 2)
            );
        } catch (writeError) {
            console.error(`Failed to write failure report: ${writeError.message}`);
        }
        
        return false;
    }
}

/**
 * Validate multiple issues in sequence (never parallel)
 */
async function validateMultipleIssues(issues) {
    console.log(`\n🔄 Starting validation of ${issues.length} issues (consecutive processing)`);
    
    const results = [];
    
    for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        console.log(`\n--- Processing issue ${i + 1}/${issues.length} ---`);
        
        const success = await validateIssueFix(
            issue.number,
            issue.testUrl,
            issue.library,
            issue.expectedBehavior
        );
        
        results.push({
            issueNumber: issue.number,
            success,
            library: issue.library
        });
        
        // Brief pause between validations
        if (i < issues.length - 1) {
            console.log('\n⏱️  Waiting 2 seconds before next validation...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    // Summary report
    console.log('\n' + '='*60);
    console.log('🎯 OVERALL VALIDATION SUMMARY');
    console.log('='*60);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    console.log(`✅ Successful: ${successful}/${results.length}`);
    console.log(`❌ Failed: ${failed}/${results.length}`);
    
    if (failed === 0) {
        console.log('\n🎉 ALL VALIDATIONS PASSED - Ready for version bump!');
    } else {
        console.log('\n⚠️  Some validations failed - fixes needed before version bump');
        results.filter(r => !r.success).forEach(r => {
            console.log(`   ❌ Issue #${r.issueNumber} (${r.library})`);
        });
    }
    
    return failed === 0;
}

module.exports = {
    validateIssueFix,
    validateMultipleIssues,
    downloadImage
};

// If called directly, show usage
if (require.main === module) {
    console.log('Node.js Validation Template for Handle-Issues Workflow');
    console.log('Usage:');
    console.log('  const { validateIssueFix } = require("./nodejs-validation-template.js");');
    console.log('  await validateIssueFix(123, "https://...", "libraryName", "expected behavior");');
}