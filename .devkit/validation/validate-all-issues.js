#!/usr/bin/env node

/**
 * Validation script for all fixed GitHub issues #1-5
 * Tests that all previously reported library issues are still working
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Import shared manifest loaders (production code)
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders');

// Issue URLs from bug reports
const ISSUE_TESTS = [
    {
        issue: 1,
        name: 'Düsseldorf (HHU)',
        description: 'JSON parsing errors',
        urls: [
            'https://digital.ub.uni-duesseldorf.de/content/titleinfo/7938251',
            'https://digital.ub.uni-duesseldorf.de/hs/content/titleinfo/259994'
        ]
    },
    {
        issue: 2,
        name: 'University of Graz',
        description: 'Timeout errors',
        urls: [
            'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
            'https://unipub.uni-graz.at/obvugrscript/content/pageview/8191388'
        ]
    },
    {
        issue: 3,
        name: 'Verona NBM',
        description: 'Large manuscript timeouts',
        urls: [
            'https://www.nuovabibliotecamanoscritta.it/catalogo/item/padova-biblioteca-universitaria-ms-550',
            'https://nuovabibliotecamanoscritta.it/catalogo/item/verona-biblioteca-civica-ms-1945'
        ]
    },
    {
        issue: 4,
        name: 'Morgan Library',
        description: 'Single page extraction',
        urls: [
            'https://www.themorgan.org/collection/treasures-of-islamic-manuscript-painting/1',
            'https://ica.themorgan.org/manuscript/thumbs/142852'
        ]
    },
    {
        issue: 5,
        name: 'Florence ContentDM',
        description: 'JavaScript errors and loading',
        urls: [
            'https://teca.bmlonline.it/digital/collection/plutei/id/272',
            'https://teca.bmlonline.it/digital/collection/plutei/id/26925'
        ]
    }
];

// Test result tracking
const results = {
    passed: [],
    failed: [],
    details: {}
};

/**
 * Download manuscript pages and create test PDF
 */
async function testLibrary(issue, url) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing Issue #${issue.issue} - ${issue.name}`);
    console.log(`URL: ${url}`);
    console.log(`${'='.repeat(60)}`);
    
    const testDir = path.join(__dirname, `issue-${issue.issue}-test`);
    await fs.mkdir(testDir, { recursive: true });
    
    const result = {
        issue: issue.issue,
        name: issue.name,
        url: url,
        success: false,
        error: null,
        pagesDownloaded: 0,
        pdfCreated: false,
        pdfValid: false
    };
    
    try {
        // Initialize manifest loader
        const loader = new SharedManifestLoaders();
        
        // Determine library type
        let libraryType = '';
        if (url.includes('digital.ub.uni-duesseldorf.de')) {
            libraryType = 'hhu';
        } else if (url.includes('unipub.uni-graz.at')) {
            libraryType = 'graz';
        } else if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) {
            libraryType = 'verona';
        } else if (url.includes('themorgan.org')) {
            libraryType = 'morgan';
        } else if (url.includes('cdm21059.contentdm.oclc.org') || url.includes('teca.bmlonline.it')) {
            libraryType = 'florence';
        }
        
        console.log(`Library type: ${libraryType}`);
        
        // Get manifest
        const manifest = await loader.getManifestForLibrary(libraryType, url);
        console.log(`Found ${manifest.images.length} images`);
        
        // Download first 5 pages for testing (or all if fewer)
        const pagesToTest = Math.min(manifest.images.length, 5);
        const downloadedImages = [];
        
        for (let i = 0; i < pagesToTest; i++) {
            const image = manifest.images[i];
            console.log(`Downloading page ${i + 1}/${pagesToTest}: ${image.label}`);
            
            try {
                const response = await loader.fetchWithRetry(image.url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const buffer = await response.buffer();
                const filename = path.join(testDir, `page-${String(i + 1).padStart(3, '0')}.jpg`);
                await fs.writeFile(filename, buffer);
                downloadedImages.push(filename);
                
                // Check file size
                const stats = await fs.stat(filename);
                if (stats.size < 1000) {
                    throw new Error('Downloaded image is too small (likely an error page)');
                }
                
                console.log(`✓ Downloaded page ${i + 1} (${(stats.size / 1024).toFixed(1)} KB)`);
            } catch (error) {
                console.error(`✗ Failed to download page ${i + 1}: ${error.message}`);
            }
        }
        
        result.pagesDownloaded = downloadedImages.length;
        
        if (downloadedImages.length === 0) {
            throw new Error('No pages could be downloaded');
        }
        
        // Create PDF
        console.log('\nCreating PDF...');
        const pdfPath = path.join(testDir, `issue-${issue.issue}-test.pdf`);
        
        try {
            // Use img2pdf for PDF creation
            const img2pdfCmd = `img2pdf ${downloadedImages.join(' ')} -o "${pdfPath}"`;
            execSync(img2pdfCmd, { stdio: 'pipe' });
            result.pdfCreated = true;
            console.log('✓ PDF created successfully');
            
            // Validate PDF with poppler
            console.log('\nValidating PDF...');
            const pdfInfoOutput = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
            
            if (pdfInfoOutput.includes('Pages:')) {
                const pagesMatch = pdfInfoOutput.match(/Pages:\s+(\d+)/);
                if (pagesMatch && parseInt(pagesMatch[1]) === downloadedImages.length) {
                    result.pdfValid = true;
                    console.log(`✓ PDF is valid with ${pagesMatch[1]} pages`);
                } else {
                    throw new Error('PDF page count mismatch');
                }
            }
            
            // Check PDF file size
            const pdfStats = await fs.stat(pdfPath);
            console.log(`✓ PDF size: ${(pdfStats.size / 1024 / 1024).toFixed(2)} MB`);
            
        } catch (error) {
            console.error(`✗ PDF validation failed: ${error.message}`);
            result.error = error.message;
        }
        
        result.success = result.pagesDownloaded > 0 && result.pdfCreated && result.pdfValid;
        
    } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}`);
        result.error = error.message;
    }
    
    // Store result
    if (!results.details[issue.issue]) {
        results.details[issue.issue] = {
            issue: issue,
            urls: []
        };
    }
    results.details[issue.issue].urls.push(result);
    
    return result;
}

/**
 * Main validation function
 */
async function validateAllIssues() {
    console.log('MSS Downloader - Validation of Fixed Issues #1-5');
    console.log('='.repeat(60));
    console.log(`Date: ${new Date().toISOString()}`);
    console.log('='.repeat(60));
    
    // Create main validation directory
    const mainDir = path.join(__dirname, 'validation-results');
    await fs.mkdir(mainDir, { recursive: true });
    
    // Test each issue
    for (const issue of ISSUE_TESTS) {
        for (const url of issue.urls) {
            await testLibrary(issue, url);
        }
    }
    
    // Generate summary report
    console.log('\n' + '='.repeat(60));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    let totalTests = 0;
    let totalPassed = 0;
    
    for (const issueNum in results.details) {
        const issueData = results.details[issueNum];
        const urlResults = issueData.urls;
        
        console.log(`\nIssue #${issueNum} - ${issueData.issue.name}:`);
        console.log(`Description: ${issueData.issue.description}`);
        
        for (const result of urlResults) {
            totalTests++;
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            console.log(`  ${status} - ${result.url}`);
            
            if (result.success) {
                totalPassed++;
                console.log(`    - Downloaded: ${result.pagesDownloaded} pages`);
                console.log(`    - PDF: Created and validated`);
            } else {
                console.log(`    - Error: ${result.error || 'Unknown error'}`);
                console.log(`    - Pages downloaded: ${result.pagesDownloaded}`);
                console.log(`    - PDF created: ${result.pdfCreated}`);
                console.log(`    - PDF valid: ${result.pdfValid}`);
            }
        }
    }
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log(`OVERALL RESULTS: ${totalPassed}/${totalTests} tests passed`);
    console.log(`Success rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));
    
    // Write JSON report
    const reportPath = path.join(mainDir, 'validation-report.json');
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nDetailed report saved to: ${reportPath}`);
    
    // Create summary markdown
    const summaryMd = generateMarkdownSummary(results, totalTests, totalPassed);
    const summaryPath = path.join(mainDir, 'validation-summary.md');
    await fs.writeFile(summaryPath, summaryMd);
    console.log(`Summary report saved to: ${summaryPath}`);
    
    return totalPassed === totalTests;
}

/**
 * Generate markdown summary report
 */
function generateMarkdownSummary(results, totalTests, totalPassed) {
    let md = `# MSS Downloader - Issue Validation Report\n\n`;
    md += `**Date:** ${new Date().toISOString()}\n\n`;
    md += `**Overall Result:** ${totalPassed}/${totalTests} tests passed (${((totalPassed / totalTests) * 100).toFixed(1)}%)\n\n`;
    
    md += `## Summary by Issue\n\n`;
    
    for (const issueNum in results.details) {
        const issueData = results.details[issueNum];
        const urlResults = issueData.urls;
        const passed = urlResults.filter(r => r.success).length;
        
        md += `### Issue #${issueNum} - ${issueData.issue.name}\n\n`;
        md += `**Status:** ${passed === urlResults.length ? '✅ FIXED' : '❌ FAILING'}\n\n`;
        md += `**Original Problem:** ${issueData.issue.description}\n\n`;
        md += `**Test Results:**\n\n`;
        
        for (const result of urlResults) {
            md += `- ${result.success ? '✅' : '❌'} ${result.url}\n`;
            if (!result.success) {
                md += `  - Error: ${result.error || 'Unknown'}\n`;
            }
        }
        md += '\n';
    }
    
    return md;
}

// Run validation
validateAllIssues()
    .then(success => {
        console.log('\n' + (success ? '✅ All tests passed!' : '❌ Some tests failed'));
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('\n❌ Validation script error:', error);
        process.exit(1);
    });