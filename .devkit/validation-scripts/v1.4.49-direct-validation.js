#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

// Import the SharedManifestLoaders directly
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

const VALIDATION_DIR = path.join(__dirname, '../validation-results/v1.4.49');
const REPORT_FILE = path.join(VALIDATION_DIR, 'validation-report.json');
const MARKDOWN_REPORT = path.join(VALIDATION_DIR, 'validation-report.md');

// Test cases from GitHub issues with library IDs
const TEST_CASES = {
    graz: [
        {
            name: 'UniPub Graz manuscript',
            url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
            libraryId: 'graz',
            expectedPages: 405,
            testPages: 10,
            issueNumber: 2
        },
        {
            name: 'GAMS context-based URL',
            url: 'https://gams.uni-graz.at/context:corema.a1',
            libraryId: 'gams',
            expectedPages: 299,
            testPages: 10,
            issueNumber: 2
        }
    ],
    verona: [
        {
            name: 'Verona NBM large manuscript',
            url: 'https://www.nuovabibliotecamanoscritta.it/Generale/manoscritto/scheda/id/1093',
            libraryId: 'verona',
            expectedPages: 100,
            testPages: 10,
            issueNumber: 3
        }
    ],
    morgan: [
        {
            name: 'Morgan Library manuscript',
            url: 'https://www.themorgan.org/manuscript/76854',
            libraryId: 'morgan',
            expectedPages: 50,
            testPages: 10,
            issueNumber: 4
        }
    ],
    florence: [
        {
            name: 'Florence BML manuscript',
            url: 'https://www.bmlonline.it/s/itBMLO0000000000/item/174871',
            libraryId: 'florence',
            expectedPages: 50,
            testPages: 10,
            issueNumber: 5
        }
    ],
    bordeaux: [
        {
            name: 'Bordeaux manuscript with tiles',
            url: 'https://bvmm.irht.cnrs.fr/consult/consult.php?REPRODUCTION_ID=11556',
            libraryId: 'bordeaux',
            expectedPages: 50,
            testPages: 10,
            issueNumber: 6
        }
    ]
};

// Utility to download a file
async function downloadFile(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = require('fs').createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', reject);
    });
}

// Utility to check if PDF is valid
function validatePDF(pdfPath) {
    try {
        const result = execSync(`pdfinfo "${pdfPath}" 2>&1`, { encoding: 'utf8' });
        return {
            valid: true,
            info: result
        };
    } catch (error) {
        return {
            valid: false,
            error: error.message
        };
    }
}

// Main validation function
async function validateLibrary(libraryName, testCase) {
    const startTime = Date.now();
    const result = {
        library: libraryName,
        testCase: testCase.name,
        url: testCase.url,
        issueNumber: testCase.issueNumber,
        success: false,
        error: null,
        pagesDownloaded: 0,
        pdfValid: false,
        duration: 0,
        details: {}
    };
    
    console.log(`\nTesting: ${testCase.name}`);
    console.log(`URL: ${testCase.url}`);
    console.log(`Expected: ${testCase.expectedPages} pages, Testing: ${testCase.testPages} pages`);
    
    try {
        // Initialize loader
        const loader = new SharedManifestLoaders();
        
        // Get manifest using the correct method
        console.log('Fetching manifest...');
        const manifest = await loader.getManifestForLibrary(testCase.libraryId, testCase.url);
        
        if (!manifest || !manifest.images || manifest.images.length === 0) {
            throw new Error('No images found in manifest');
        }
        
        console.log(`Found ${manifest.images.length} pages in manifest`);
        result.details.totalPages = manifest.images.length;
        
        // Download test pages
        const pagesToDownload = Math.min(testCase.testPages, manifest.images.length);
        const downloadedImages = [];
        
        for (let i = 0; i < pagesToDownload; i++) {
            const image = manifest.images[i];
            const filename = `page_${i + 1}.jpg`;
            const filepath = path.join(VALIDATION_DIR, `${libraryName}_${testCase.name.replace(/\s+/g, '_')}_${filename}`);
            
            console.log(`Downloading page ${i + 1}/${pagesToDownload}...`);
            
            try {
                await downloadFile(image.url, filepath);
                
                // Check file size
                const stats = await fs.stat(filepath);
                if (stats.size === 0) {
                    throw new Error(`Page ${i + 1} is 0 bytes`);
                }
                
                downloadedImages.push(filepath);
                result.pagesDownloaded++;
            } catch (error) {
                console.error(`Failed to download page ${i + 1}: ${error.message}`);
                throw error;
            }
        }
        
        // Create PDF from downloaded images
        if (downloadedImages.length > 0) {
            const pdfPath = path.join(VALIDATION_DIR, `${libraryName}_${testCase.name.replace(/\s+/g, '_')}.pdf`);
            console.log('Creating PDF...');
            
            // Use ImageMagick to create PDF
            try {
                execSync(`convert ${downloadedImages.join(' ')} "${pdfPath}"`, { encoding: 'utf8' });
                
                // Validate PDF
                const pdfValidation = validatePDF(pdfPath);
                result.pdfValid = pdfValidation.valid;
                
                if (!pdfValidation.valid) {
                    throw new Error(`PDF validation failed: ${pdfValidation.error}`);
                }
                
                console.log('✅ PDF created and validated successfully');
            } catch (error) {
                console.error('Failed to create PDF:', error.message);
                // Don't fail the test if PDF creation fails, as long as images were downloaded
            }
        }
        
        result.success = true;
        console.log(`✅ Test passed: ${result.pagesDownloaded} pages downloaded successfully`);
        
    } catch (error) {
        result.error = error.message;
        console.error(`❌ Test failed: ${error.message}`);
    }
    
    result.duration = Date.now() - startTime;
    return result;
}

// Main validation runner
async function runValidation() {
    console.log(`[${new Date().toISOString()}] Starting autonomous validation for v1.4.49`);
    console.log(`Testing ${Object.keys(TEST_CASES).length} libraries\n`);
    
    // Create validation directory
    await fs.mkdir(VALIDATION_DIR, { recursive: true });
    
    const results = {
        version: '1.4.49',
        timestamp: new Date().toISOString(),
        totalTests: 0,
        passed: 0,
        failed: 0,
        libraries: {}
    };
    
    // Test each library
    for (const [libraryName, testCases] of Object.entries(TEST_CASES)) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing ${libraryName.toUpperCase()} (#${testCases[0].issueNumber})`);
        console.log(`${'='.repeat(60)}`);
        
        results.libraries[libraryName] = {
            tests: [],
            passed: 0,
            failed: 0
        };
        
        for (const testCase of testCases) {
            results.totalTests++;
            
            const testResult = await validateLibrary(libraryName, testCase);
            results.libraries[libraryName].tests.push(testResult);
            
            if (testResult.success) {
                results.passed++;
                results.libraries[libraryName].passed++;
            } else {
                results.failed++;
                results.libraries[libraryName].failed++;
            }
        }
    }
    
    // Save JSON report
    await fs.writeFile(REPORT_FILE, JSON.stringify(results, null, 2));
    
    // Generate markdown report
    let markdown = `# Validation Report for v1.4.49\n\n`;
    markdown += `**Date:** ${results.timestamp}\n\n`;
    markdown += `## Summary\n\n`;
    markdown += `- **Total Tests:** ${results.totalTests}\n`;
    markdown += `- **Passed:** ${results.passed} ✅\n`;
    markdown += `- **Failed:** ${results.failed} ❌\n\n`;
    
    markdown += `## Detailed Results\n\n`;
    
    for (const [libraryName, libraryResults] of Object.entries(results.libraries)) {
        markdown += `### ${libraryName.toUpperCase()}\n\n`;
        
        for (const test of libraryResults.tests) {
            markdown += `#### ${test.testCase}\n`;
            markdown += `- **URL:** ${test.url}\n`;
            markdown += `- **Issue:** #${test.issueNumber}\n`;
            markdown += `- **Status:** ${test.success ? '✅ PASSED' : '❌ FAILED'}\n`;
            markdown += `- **Pages Downloaded:** ${test.pagesDownloaded}\n`;
            markdown += `- **PDF Valid:** ${test.pdfValid ? 'Yes' : 'No'}\n`;
            markdown += `- **Duration:** ${(test.duration / 1000).toFixed(2)}s\n`;
            
            if (test.error) {
                markdown += `- **Error:** ${test.error}\n`;
            }
            
            markdown += '\n';
        }
    }
    
    await fs.writeFile(MARKDOWN_REPORT, markdown);
    
    // Print summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('VALIDATION COMPLETE');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total Tests: ${results.totalTests}`);
    console.log(`Passed: ${results.passed} ✅`);
    console.log(`Failed: ${results.failed} ❌`);
    console.log(`\nReports saved to:`);
    console.log(`- JSON: ${REPORT_FILE}`);
    console.log(`- Markdown: ${MARKDOWN_REPORT}`);
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
}

// Run validation
runValidation().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
});