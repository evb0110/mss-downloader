#!/usr/bin/env node

/**
 * Validation script v2 for all fixed GitHub issues #1-5
 * Uses direct manifest loading and better error handling
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Import the downloader service
const { EnhancedManuscriptDownloaderService } = require('../../src/main/services/EnhancedManuscriptDownloaderService');

// Test URLs from the issues
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

// Initialize results
const results = {
    passed: 0,
    failed: 0,
    details: []
};

/**
 * Test a single URL
 */
async function testUrl(issue, url) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing Issue #${issue.issue} - ${issue.name}`);
    console.log(`URL: ${url}`);
    console.log(`${'='.repeat(60)}`);
    
    const testResult = {
        issue: issue.issue,
        name: issue.name,
        url: url,
        success: false,
        error: null,
        manuscriptFound: false,
        imagesExtracted: 0,
        pdfCreated: false
    };
    
    const testDir = path.join(__dirname, 'test-results', `issue-${issue.issue}`);
    await fs.mkdir(testDir, { recursive: true });
    
    try {
        // Create downloader service instance
        const downloader = new EnhancedManuscriptDownloaderService();
        
        // Test manuscript extraction
        console.log('Extracting manuscript data...');
        const manuscript = await downloader.extractManuscript(url);
        
        if (!manuscript || !manuscript.images || manuscript.images.length === 0) {
            throw new Error('No images extracted from manuscript');
        }
        
        testResult.manuscriptFound = true;
        testResult.imagesExtracted = manuscript.images.length;
        console.log(`✓ Found ${manuscript.images.length} images`);
        console.log(`✓ Title: ${manuscript.title || 'Unknown'}`);
        
        // Download first 3 images to verify they work
        console.log('\nTesting image downloads...');
        const testImages = manuscript.images.slice(0, 3);
        let downloadedCount = 0;
        
        for (let i = 0; i < testImages.length; i++) {
            const img = testImages[i];
            try {
                console.log(`  Downloading image ${i + 1}/${testImages.length}...`);
                const imageData = await downloader.downloadImage(img.url);
                
                if (imageData && imageData.length > 1000) {
                    downloadedCount++;
                    console.log(`  ✓ Downloaded ${(imageData.length / 1024).toFixed(1)} KB`);
                    
                    // Save image for verification
                    const imagePath = path.join(testDir, `page-${i + 1}.jpg`);
                    await fs.writeFile(imagePath, imageData);
                } else {
                    console.log(`  ✗ Image too small or invalid`);
                }
            } catch (error) {
                console.log(`  ✗ Download failed: ${error.message}`);
            }
        }
        
        if (downloadedCount > 0) {
            console.log(`✓ Successfully downloaded ${downloadedCount}/${testImages.length} test images`);
            
            // Try to create a simple test PDF
            try {
                const pdfPath = path.join(testDir, 'test.pdf');
                const imageFiles = [];
                for (let i = 1; i <= downloadedCount; i++) {
                    imageFiles.push(path.join(testDir, `page-${i}.jpg`));
                }
                
                execSync(`img2pdf ${imageFiles.join(' ')} -o "${pdfPath}"`, { stdio: 'pipe' });
                
                // Verify PDF
                const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
                if (pdfInfo.includes('Pages:')) {
                    testResult.pdfCreated = true;
                    console.log('✓ Test PDF created successfully');
                }
            } catch (error) {
                console.log('✗ PDF creation failed (non-critical)');
            }
        }
        
        testResult.success = testResult.manuscriptFound && testResult.imagesExtracted > 0;
        
    } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}`);
        testResult.error = error.message;
    }
    
    results.details.push(testResult);
    if (testResult.success) {
        results.passed++;
    } else {
        results.failed++;
    }
    
    return testResult;
}

/**
 * Generate summary report
 */
function generateSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    const issueGroups = {};
    for (const result of results.details) {
        if (!issueGroups[result.issue]) {
            issueGroups[result.issue] = [];
        }
        issueGroups[result.issue].push(result);
    }
    
    for (const issueNum in issueGroups) {
        const issueResults = issueGroups[issueNum];
        const issue = ISSUE_TESTS.find(i => i.issue === parseInt(issueNum));
        const passed = issueResults.filter(r => r.success).length;
        const total = issueResults.length;
        
        console.log(`\nIssue #${issueNum} - ${issue.name}: ${passed}/${total} passed`);
        console.log(`Problem: ${issue.description}`);
        
        for (const result of issueResults) {
            const status = result.success ? '✅' : '❌';
            console.log(`  ${status} ${result.url}`);
            if (result.success) {
                console.log(`     - Extracted ${result.imagesExtracted} images`);
            } else {
                console.log(`     - Error: ${result.error || 'Unknown'}`);
            }
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`OVERALL: ${results.passed}/${results.passed + results.failed} tests passed`);
    console.log(`Success rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));
}

/**
 * Main function
 */
async function main() {
    console.log('MSS Downloader - Issue Validation v2');
    console.log('Testing fixed issues #1-5');
    console.log('='.repeat(60));
    
    // Clean up test results directory
    const resultsDir = path.join(__dirname, 'test-results');
    try {
        await fs.rm(resultsDir, { recursive: true, force: true });
    } catch (error) {
        // Ignore if doesn't exist
    }
    await fs.mkdir(resultsDir, { recursive: true });
    
    // Test each issue URL
    for (const issue of ISSUE_TESTS) {
        for (const url of issue.urls) {
            await testUrl(issue, url);
        }
    }
    
    // Generate summary
    generateSummary();
    
    // Save detailed results
    const reportPath = path.join(resultsDir, 'validation-report.json');
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nDetailed report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
}

// Run the validation
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});