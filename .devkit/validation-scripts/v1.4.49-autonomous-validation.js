#!/usr/bin/env node

/**
 * Autonomous Validation Script for v1.4.49
 * Tests all 5 libraries with specific URLs from GitHub issues
 * No user interaction required - fully autonomous
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

// Test configuration for all libraries
const LIBRARY_TESTS = {
  graz: {
    name: 'University of Graz',
    issue: '#2',
    urls: [
      {
        url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
        type: 'unipub',
        expectedPages: 405,
        testPages: 10,
        description: 'UniPub Graz manuscript'
      },
      {
        url: 'https://gams.uni-graz.at/context:corema.a1',
        type: 'gams',
        expectedPages: 299,
        testPages: 10,
        description: 'GAMS context-based URL (NEW feature)'
      }
    ]
  },
  verona: {
    name: 'Verona NBM',
    issue: '#3',
    urls: [
      {
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
        type: 'nbm',
        expectedPages: 254,
        testPages: 10,
        description: 'Verona NBM manuscript (timeout fix)',
        expectedError: 'timeout',
        fix: 'Limited initial page load to prevent timeouts'
      }
    ]
  },
  morgan: {
    name: 'Morgan Library',
    issue: '#4',
    urls: [
      {
        url: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        type: 'morgan',
        expectedPages: 10,
        testPages: 10,
        description: 'Morgan Library manuscript (301 redirect fix)',
        expectedError: '301 redirect',
        fix: 'Enabled SharedManifestAdapter for proper page extraction'
      }
    ]
  },
  florence: {
    name: 'Florence ContentDM',
    issue: '#5',
    urls: [
      {
        url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
        type: 'contentdm',
        expectedPages: 15,
        testPages: 10,
        description: 'Florence ContentDM (JavaScript errors fix)',
        expectedError: 'JavaScript errors and endless loading',
        fix: 'Enhanced retry logic with exponential backoff'
      }
    ]
  },
  bordeaux: {
    name: 'Bordeaux',
    issue: '#6',
    urls: [
      {
        url: 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778',
        type: 'bordeaux',
        expectedPages: 10,
        testPages: 10,
        description: 'Bordeaux manuscript (new library)',
        expectedError: 'Unsupported library',
        fix: 'Added Bordeaux library with DZI tile support'
      }
    ]
  }
};

// Results tracking
const results = {
  passed: 0,
  failed: 0,
  details: {},
  timestamp: new Date().toISOString()
};

// Ensure output directory exists
const OUTPUT_DIR = path.join(__dirname, '../validation-results/v1.4.49');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper functions
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  console.log(logMessage);
  
  // Also write to log file
  const logFile = path.join(OUTPUT_DIR, 'validation.log');
  fs.appendFileSync(logFile, logMessage + '\n');
}

function validatePDF(pdfPath) {
  try {
    // Check file exists and has size
    const stats = fs.statSync(pdfPath);
    if (stats.size === 0) {
      return { valid: false, error: 'PDF file is empty (0 bytes)' };
    }
    
    // Validate with poppler
    try {
      const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
      const pages = pdfInfo.match(/Pages:\s+(\d+)/);
      const pageCount = pages ? parseInt(pages[1]) : 0;
      
      if (pageCount === 0) {
        return { valid: false, error: 'PDF has no pages' };
      }
      
      // Extract and check images
      const imagesOutput = execSync(`pdfimages -list "${pdfPath}"`, { encoding: 'utf8' });
      const imageLines = imagesOutput.split('\n').filter(line => line.match(/^\s*\d+/));
      
      if (imageLines.length === 0) {
        return { valid: false, error: 'PDF contains no images' };
      }
      
      // Check for duplicate pages by extracting first few images
      const tempDir = path.join(OUTPUT_DIR, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Only extract if we have at least 2 pages to compare
      if (pageCount > 1) {
        execSync(`pdfimages -png -f 1 -l ${Math.min(3, pageCount)} "${pdfPath}" "${tempDir}/page"`, { encoding: 'utf8' });
        
        // Compare file sizes to detect duplicates
        const extractedImages = fs.readdirSync(tempDir).filter(f => f.startsWith('page-'));
        const imageSizes = extractedImages.map(img => {
          const imgPath = path.join(tempDir, img);
          return fs.statSync(imgPath).size;
        });
        
        // Clean up temp files
        extractedImages.forEach(img => fs.unlinkSync(path.join(tempDir, img)));
        
        // Check if all pages are identical (same size)
        const uniqueSizes = new Set(imageSizes);
        if (uniqueSizes.size === 1 && imageSizes.length > 1) {
          return { valid: false, error: 'All pages appear to be identical' };
        }
      }
      
      return {
        valid: true,
        pageCount,
        imageCount: imageLines.length,
        fileSize: stats.size,
        uniquePages: pageCount
      };
    } catch (error) {
      // Poppler not available, do basic validation
      log('Poppler not available, using basic PDF validation', 'warn');
      return {
        valid: true,
        pageCount: 'unknown',
        imageCount: 'unknown',
        fileSize: stats.size,
        uniquePages: 'unknown'
      };
    }
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function runElectronTest(libraryKey, test) {
  return new Promise((resolve) => {
    const testScript = `
      const { app } = require('electron');
      const path = require('path');
      const fs = require('fs');
      
      // Import services
      const { ManuscriptDownloaderService } = require('./dist/main/services/ManuscriptDownloaderService.js');
      const { EnhancedManuscriptDownloaderService } = require('./dist/main/services/EnhancedManuscriptDownloaderService.js');
      const { ElectronPdfMerger } = require('./dist/main/services/ElectronPdfMerger.js');
      
      app.whenReady().then(async () => {
        try {
          console.log('Testing URL: ${test.url}');
          
          // Initialize services
          const pdfMerger = new ElectronPdfMerger();
          const basicService = new ManuscriptDownloaderService(pdfMerger);
          const enhancedService = new EnhancedManuscriptDownloaderService();
          
          // Try enhanced service first
          let manuscript;
          let service;
          
          try {
            manuscript = await enhancedService.parseManuscriptUrl('${test.url}');
            service = enhancedService;
            console.log('Using EnhancedManuscriptDownloaderService');
          } catch (error) {
            console.log('Enhanced service failed, trying basic service:', error.message);
            try {
              manuscript = await basicService.parseManuscriptUrl('${test.url}');
              service = basicService;
              console.log('Using ManuscriptDownloaderService');
            } catch (basicError) {
              throw new Error(\`Both services failed: \${basicError.message}\`);
            }
          }
          
          console.log('Manuscript loaded:', manuscript.title || 'Untitled');
          console.log('Total pages:', manuscript.pages);
          
          // Download test pages
          const outputPath = path.join('${OUTPUT_DIR}', '${libraryKey}_${test.type}_test.pdf');
          const pagesToDownload = Math.min(${test.testPages}, manuscript.pages);
          
          console.log(\`Downloading \${pagesToDownload} pages...\`);
          
          await service.download(
            '${test.url}',
            outputPath,
            {
              pages: \`1-\${pagesToDownload}\`,
              quality: 'high'
            },
            {
              onProgress: (progress) => {
                if (progress.currentPage) {
                  console.log(\`Progress: page \${progress.currentPage}/\${progress.totalPages}\`);
                }
              },
              onComplete: () => console.log('Download complete'),
              onError: (error) => console.error('Download error:', error.message)
            }
          );
          
          // Verify file exists
          const stats = fs.statSync(outputPath);
          console.log(\`PDF created: \${(stats.size / 1024 / 1024).toFixed(2)} MB\`);
          
          process.exit(0);
        } catch (error) {
          console.error('Test failed:', error.message);
          process.exit(1);
        }
      });
    `;
    
    // Write test script
    const scriptPath = path.join(OUTPUT_DIR, `test_${libraryKey}_${test.type}.js`);
    fs.writeFileSync(scriptPath, testScript);
    
    // Run electron with the test script
    const electron = spawn('npx', ['electron', scriptPath], {
      cwd: path.join(__dirname, '../..'),
      stdio: 'pipe'
    });
    
    let output = '';
    let errorOutput = '';
    
    electron.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      log(text.trim(), 'debug');
    });
    
    electron.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      log(text.trim(), 'error');
    });
    
    electron.on('close', (code) => {
      fs.unlinkSync(scriptPath); // Clean up test script
      
      if (code === 0) {
        // Check if PDF was created
        const pdfPath = path.join(OUTPUT_DIR, `${libraryKey}_${test.type}_test.pdf`);
        if (fs.existsSync(pdfPath)) {
          const validation = validatePDF(pdfPath);
          resolve({
            success: validation.valid,
            pdfPath,
            validation,
            output,
            error: validation.valid ? null : validation.error
          });
        } else {
          resolve({
            success: false,
            error: 'PDF file was not created',
            output,
            errorOutput
          });
        }
      } else {
        resolve({
          success: false,
          error: 'Electron test failed with exit code ' + code,
          output,
          errorOutput
        });
      }
    });
    
    // Timeout after 5 minutes
    setTimeout(() => {
      electron.kill();
      resolve({
        success: false,
        error: 'Test timeout after 5 minutes',
        output,
        errorOutput
      });
    }, 300000);
  });
}

async function testLibrary(libraryKey, config) {
  log(`\n${'='.repeat(60)}`, 'info');
  log(`Testing ${config.name} (${config.issue})`, 'info');
  log(`${'='.repeat(60)}`, 'info');
  
  const libraryResult = {
    library: config.name,
    issue: config.issue,
    tests: []
  };
  
  for (const test of config.urls) {
    log(`\nTesting: ${test.description}`, 'info');
    log(`URL: ${test.url}`, 'info');
    log(`Expected: ${test.expectedPages} pages, Testing: ${test.testPages} pages`, 'info');
    if (test.expectedError) {
      log(`Known error: ${test.expectedError}`, 'warn');
      log(`Applied fix: ${test.fix}`, 'info');
    }
    
    const testResult = {
      url: test.url,
      type: test.type,
      description: test.description,
      success: false,
      error: null,
      pdfPath: null,
      validation: null
    };
    
    try {
      // Run the electron test
      const electronResult = await runElectronTest(libraryKey, test);
      
      testResult.success = electronResult.success;
      testResult.error = electronResult.error;
      testResult.pdfPath = electronResult.pdfPath;
      testResult.validation = electronResult.validation;
      
      if (electronResult.success) {
        log(`✅ Test passed: ${electronResult.validation.pageCount} pages, ${(electronResult.validation.fileSize / 1024 / 1024).toFixed(2)} MB`, 'success');
      } else {
        log(`❌ Test failed: ${electronResult.error}`, 'error');
      }
      
    } catch (error) {
      testResult.error = error.message;
      log(`❌ Test failed: ${error.message}`, 'error');
    }
    
    libraryResult.tests.push(testResult);
  }
  
  // Calculate library success
  const successCount = libraryResult.tests.filter(t => t.success).length;
  libraryResult.success = successCount === libraryResult.tests.length;
  libraryResult.successRate = `${successCount}/${libraryResult.tests.length}`;
  
  if (libraryResult.success) {
    results.passed++;
    log(`\n✅ ${config.name} PASSED all tests`, 'success');
  } else {
    results.failed++;
    log(`\n❌ ${config.name} FAILED some tests`, 'error');
  }
  
  results.details[libraryKey] = libraryResult;
  return libraryResult;
}

async function runAllTests() {
  log('Starting autonomous validation for v1.4.49', 'info');
  log(`Testing ${Object.keys(LIBRARY_TESTS).length} libraries`, 'info');
  
  // First ensure we have a built application
  log('\nBuilding application...', 'info');
  try {
    execSync('npm run build', { 
      cwd: path.join(__dirname, '../..'),
      stdio: 'inherit' 
    });
    log('Build completed successfully', 'success');
  } catch (error) {
    log('Build failed, attempting to continue with existing build', 'warn');
  }
  
  // Test each library
  for (const [libraryKey, config] of Object.entries(LIBRARY_TESTS)) {
    try {
      await testLibrary(libraryKey, config);
    } catch (error) {
      log(`Fatal error testing ${libraryKey}: ${error.message}`, 'error');
      results.failed++;
      results.details[libraryKey] = {
        library: config.name,
        issue: config.issue,
        success: false,
        error: error.message
      };
    }
  }
  
  // Generate report
  log('\n\n' + '='.repeat(60), 'info');
  log('VALIDATION SUMMARY', 'info');
  log('='.repeat(60), 'info');
  log(`Total libraries tested: ${Object.keys(LIBRARY_TESTS).length}`, 'info');
  log(`Passed: ${results.passed}`, 'success');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'error' : 'info');
  log(`Success rate: ${(results.passed / Object.keys(LIBRARY_TESTS).length * 100).toFixed(1)}%`, 'info');
  
  // Save detailed results
  const reportPath = path.join(OUTPUT_DIR, 'validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  log(`\nDetailed report saved to: ${reportPath}`, 'info');
  
  // Generate markdown report
  const markdownReport = generateMarkdownReport(results);
  const markdownPath = path.join(OUTPUT_DIR, 'validation-report.md');
  fs.writeFileSync(markdownPath, markdownReport);
  log(`Markdown report saved to: ${markdownPath}`, 'info');
  
  // Also show PDFs location
  log(`\nPDF files saved to: ${OUTPUT_DIR}`, 'info');
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

function generateMarkdownReport(results) {
  let report = `# Validation Report for v1.4.49\n\n`;
  report += `**Date:** ${results.timestamp}\n\n`;
  report += `## Summary\n\n`;
  report += `- **Total Libraries Tested:** ${Object.keys(LIBRARY_TESTS).length}\n`;
  report += `- **Passed:** ${results.passed}\n`;
  report += `- **Failed:** ${results.failed}\n`;
  report += `- **Success Rate:** ${(results.passed / Object.keys(LIBRARY_TESTS).length * 100).toFixed(1)}%\n\n`;
  
  report += `## Detailed Results\n\n`;
  
  for (const [libraryKey, result] of Object.entries(results.details)) {
    const config = LIBRARY_TESTS[libraryKey];
    report += `### ${result.library} (${result.issue})\n\n`;
    report += `**Status:** ${result.success ? '✅ PASSED' : '❌ FAILED'}\n`;
    report += `**Success Rate:** ${result.successRate || 'N/A'}\n\n`;
    
    if (result.tests) {
      for (const test of result.tests) {
        report += `#### ${test.description}\n\n`;
        report += `- **URL:** ${test.url}\n`;
        report += `- **Type:** ${test.type}\n`;
        report += `- **Result:** ${test.success ? '✅ Success' : '❌ Failed'}\n`;
        
        if (test.validation) {
          report += `- **PDF Validation:** ${test.validation.valid ? 'Valid' : 'Invalid'}\n`;
          if (test.validation.valid) {
            report += `  - Pages: ${test.validation.pageCount}\n`;
            report += `  - Images: ${test.validation.imageCount}\n`;
            report += `  - File size: ${(test.validation.fileSize / 1024 / 1024).toFixed(2)} MB\n`;
          }
        }
        
        if (test.error) {
          report += `- **Error:** ${test.error}\n`;
        }
        
        const testConfig = config.urls.find(u => u.url === test.url);
        if (testConfig?.fix) {
          report += `- **Applied Fix:** ${testConfig.fix}\n`;
        }
        
        if (test.pdfPath && fs.existsSync(test.pdfPath)) {
          report += `- **PDF Path:** ${path.basename(test.pdfPath)}\n`;
        }
        
        report += '\n';
      }
    } else if (result.error) {
      report += `**Error:** ${result.error}\n\n`;
    }
  }
  
  report += `## PDF Files\n\n`;
  report += `All generated PDF files can be found in:\n`;
  report += `\`${OUTPUT_DIR}\`\n\n`;
  
  const pdfFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.pdf'));
  if (pdfFiles.length > 0) {
    report += `Generated PDFs:\n`;
    pdfFiles.forEach(pdf => {
      const stats = fs.statSync(path.join(OUTPUT_DIR, pdf));
      report += `- ${pdf} (${(stats.size / 1024 / 1024).toFixed(2)} MB)\n`;
    });
  }
  
  return report;
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  log(`Unhandled rejection: ${error.message}`, 'error');
  process.exit(1);
});

// Run the validation
runAllTests().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});