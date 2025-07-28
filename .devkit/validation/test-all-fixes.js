const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Import shared manifest loaders
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders');
const manifestLoader = new SharedManifestLoaders();

// Test configurations for all 5 fixed issues
const testConfigs = [
    {
        name: 'Florence - Timeout Handling Fix',
        library: 'florence',
        url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
        issue: 'Timeout errors when loading manuscripts',
        fix: 'Added extended timeout (120s) and better error handling',
        expectedPages: 10
    },
    {
        name: 'Morgan - ImagesByPriority Fix',
        library: 'morgan',
        url: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        issue: 'Only extracting 1 page instead of all pages',
        fix: 'Fixed imagesByPriority parsing to extract all pages correctly',
        expectedPages: 10
    },
    {
        name: 'Verona - Timeout Handling Fix',
        library: 'verona',
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
        issue: 'Connection timeout errors',
        fix: 'Added extended timeout (120s) and retry logic',
        expectedPages: 10
    },
    {
        name: 'Graz - Manifest Parsing Fix',
        library: 'graz',
        url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
        issue: 'Large manifest parsing timeouts',
        fix: 'Added streaming JSON parsing and memory management',
        expectedPages: 10
    },
    {
        name: 'HHU Düsseldorf - JSON Parsing Fix',
        library: 'hhu',
        url: 'https://digital.ulb.hhu.de/ms/content/titleinfo/7674176',
        issue: 'Invalid JSON responses causing parse errors',
        fix: 'Added robust JSON parsing with HTML detection',
        expectedPages: 10
    }
];

// Create validation directory
const validationDir = path.join(__dirname, 'validation-results-' + new Date().toISOString().split('T')[0]);
if (!fs.existsSync(validationDir)) {
    fs.mkdirSync(validationDir, { recursive: true });
}

// Test results
const results = [];

async function testLibrary(config) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${config.name}`);
    console.log(`URL: ${config.url}`);
    console.log(`Issue: ${config.issue}`);
    console.log(`Fix: ${config.fix}`);
    console.log(`${'='.repeat(80)}\n`);

    const result = {
        library: config.library,
        name: config.name,
        status: 'pending',
        error: null,
        manifest: null,
        pdfPath: null,
        pdfSize: 0,
        pageCount: 0,
        timeElapsed: 0
    };

    const startTime = Date.now();

    try {
        // Step 1: Load manifest
        console.log('Step 1: Loading manifest...');
        const manifest = await manifestLoader.getManifestForLibrary(config.library, config.url);
        
        if (!manifest || !manifest.images || manifest.images.length === 0) {
            throw new Error('No images found in manifest');
        }

        console.log(`✓ Manifest loaded successfully: ${manifest.title || 'Untitled'}`);
        console.log(`✓ Found ${manifest.images.length} pages`);
        result.manifest = {
            title: manifest.title,
            totalPages: manifest.images.length
        };

        // Step 2: Download sample pages (up to 10)
        const pagesToDownload = Math.min(config.expectedPages, manifest.images.length);
        console.log(`\nStep 2: Downloading ${pagesToDownload} sample pages...`);

        const imageDir = path.join(validationDir, `${config.library}-images`);
        if (!fs.existsSync(imageDir)) {
            fs.mkdirSync(imageDir);
        }

        const downloadedImages = [];
        for (let i = 0; i < pagesToDownload; i++) {
            const image = manifest.images[i];
            const imagePath = path.join(imageDir, `page-${String(i + 1).padStart(3, '0')}.jpg`);
            
            try {
                console.log(`  Downloading page ${i + 1}/${pagesToDownload}...`);
                
                // Use curl to download image with extended timeout
                const curlCmd = `curl -s -L -o "${imagePath}" --max-time 60 --retry 3 "${image.url}"`;
                execSync(curlCmd, { stdio: 'pipe' });
                
                // Verify file was downloaded
                if (fs.existsSync(imagePath) && fs.statSync(imagePath).size > 0) {
                    downloadedImages.push(imagePath);
                    console.log(`  ✓ Page ${i + 1} downloaded (${(fs.statSync(imagePath).size / 1024).toFixed(1)} KB)`);
                } else {
                    console.log(`  ✗ Page ${i + 1} failed to download`);
                }
            } catch (err) {
                console.log(`  ✗ Page ${i + 1} download error: ${err.message}`);
            }
        }

        if (downloadedImages.length === 0) {
            throw new Error('Failed to download any pages');
        }

        console.log(`\n✓ Downloaded ${downloadedImages.length} pages successfully`);

        // Step 3: Create PDF
        console.log('\nStep 3: Creating PDF...');
        const pdfPath = path.join(validationDir, `${config.library}-manuscript.pdf`);
        
        // Use ImageMagick to create PDF
        const convertCmd = `convert ${downloadedImages.map(p => `"${p}"`).join(' ')} "${pdfPath}"`;
        execSync(convertCmd, { stdio: 'pipe' });

        if (!fs.existsSync(pdfPath)) {
            throw new Error('PDF creation failed');
        }

        const pdfSize = fs.statSync(pdfPath).size;
        console.log(`✓ PDF created successfully: ${(pdfSize / 1024 / 1024).toFixed(2)} MB`);

        // Step 4: Validate PDF with poppler
        console.log('\nStep 4: Validating PDF with poppler...');
        try {
            const pdfInfoOutput = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
            const pageMatch = pdfInfoOutput.match(/Pages:\s+(\d+)/);
            const pageCount = pageMatch ? parseInt(pageMatch[1]) : 0;
            
            if (pageCount !== downloadedImages.length) {
                throw new Error(`PDF page count mismatch: expected ${downloadedImages.length}, got ${pageCount}`);
            }
            
            console.log(`✓ PDF validation passed: ${pageCount} pages`);
            result.pageCount = pageCount;
        } catch (err) {
            throw new Error(`PDF validation failed: ${err.message}`);
        }

        // Success
        result.status = 'success';
        result.pdfPath = pdfPath;
        result.pdfSize = pdfSize;
        result.timeElapsed = Date.now() - startTime;

        console.log(`\n✅ ${config.name} - TEST PASSED`);
        console.log(`   Time: ${(result.timeElapsed / 1000).toFixed(1)}s`);
        console.log(`   PDF: ${path.basename(pdfPath)} (${(pdfSize / 1024 / 1024).toFixed(2)} MB)`);

    } catch (error) {
        result.status = 'failed';
        result.error = error.message;
        result.timeElapsed = Date.now() - startTime;
        
        console.error(`\n❌ ${config.name} - TEST FAILED`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Time: ${(result.timeElapsed / 1000).toFixed(1)}s`);
    }

    results.push(result);
    return result;
}

async function runAllTests() {
    console.log('Starting comprehensive validation tests for all 5 fixed issues...\n');
    console.log(`Results will be saved to: ${validationDir}\n`);

    // Run tests sequentially to avoid overwhelming servers
    for (const config of testConfigs) {
        await testLibrary(config);
        
        // Add delay between tests to be respectful to servers
        if (testConfigs.indexOf(config) < testConfigs.length - 1) {
            console.log('\nWaiting 5 seconds before next test...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    // Generate summary report
    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(80));

    const successCount = results.filter(r => r.status === 'success').length;
    const failCount = results.filter(r => r.status === 'failed').length;

    console.log(`\nTotal Tests: ${results.length}`);
    console.log(`✅ Passed: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);

    console.log('\nDetailed Results:');
    results.forEach(result => {
        const status = result.status === 'success' ? '✅' : '❌';
        console.log(`\n${status} ${result.name}`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Time: ${(result.timeElapsed / 1000).toFixed(1)}s`);
        
        if (result.status === 'success') {
            console.log(`   Pages: ${result.pageCount}`);
            console.log(`   PDF Size: ${(result.pdfSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`   PDF Path: ${path.basename(result.pdfPath)}`);
        } else {
            console.log(`   Error: ${result.error}`);
        }
    });

    // Save JSON report
    const reportPath = path.join(validationDir, 'validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nValidation report saved to: ${reportPath}`);

    // Generate HTML report
    const htmlReport = generateHTMLReport(results);
    const htmlPath = path.join(validationDir, 'validation-report.html');
    fs.writeFileSync(htmlPath, htmlReport);
    console.log(`HTML report saved to: ${htmlPath}`);

    console.log(`\nAll validation files saved to: ${validationDir}`);
    
    return {
        totalTests: results.length,
        passed: successCount,
        failed: failCount,
        resultsDir: validationDir
    };
}

function generateHTMLReport(results) {
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>MSS Downloader Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .summary { background: #f0f0f0; padding: 10px; border-radius: 5px; margin: 20px 0; }
        .success { color: #28a745; }
        .failed { color: #dc3545; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
    </style>
</head>
<body>
    <h1>MSS Downloader Validation Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <div class="summary">
        <h2>Summary</h2>
        <p>Total Tests: ${results.length}</p>
        <p class="success">✅ Passed: ${results.filter(r => r.status === 'success').length}</p>
        <p class="failed">❌ Failed: ${results.filter(r => r.status === 'failed').length}</p>
    </div>
    
    <h2>Test Results</h2>
    <table>
        <tr>
            <th>Library</th>
            <th>Status</th>
            <th>Time (s)</th>
            <th>Pages</th>
            <th>PDF Size (MB)</th>
            <th>Error</th>
        </tr>
        ${results.map(r => `
        <tr>
            <td>${r.name}</td>
            <td class="${r.status}">${r.status === 'success' ? '✅ Pass' : '❌ Fail'}</td>
            <td>${(r.timeElapsed / 1000).toFixed(1)}</td>
            <td>${r.status === 'success' ? r.pageCount : '-'}</td>
            <td>${r.status === 'success' ? (r.pdfSize / 1024 / 1024).toFixed(2) : '-'}</td>
            <td>${r.error || '-'}</td>
        </tr>
        `).join('')}
    </table>
</body>
</html>`;
    return html;
}

// Run the tests
runAllTests().then(summary => {
    console.log('\n✨ All tests completed!');
    process.exit(summary.failed > 0 ? 1 : 0);
}).catch(error => {
    console.error('\n💥 Test runner failed:', error);
    process.exit(1);
});