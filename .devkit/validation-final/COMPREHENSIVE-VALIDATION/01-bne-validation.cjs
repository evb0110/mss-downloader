const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BNE_TEST_URLS = [
  'https://bdh.bne.es/bnesearch/detalle/007619',
  'https://bdh.bne.es/bnesearch/detalle/004677',
  'https://bdh.bne.es/bnesearch/detalle/006003'
];

const VALIDATION_DIR = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/validation-final/COMPREHENSIVE-VALIDATION/BNE';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function testBNELibrary() {
  console.log('=== BNE LIBRARY COMPREHENSIVE VALIDATION ===');
  console.log('Testing: Spanish National Library - hanging calculation fix');
  
  ensureDir(VALIDATION_DIR);
  
  const results = {
    library: 'BNE',
    description: 'Spanish National Library - hanging calculation fix',
    testUrls: BNE_TEST_URLS,
    timestamp: new Date().toISOString(),
    tests: [],
    overallStatus: 'testing',
    maxResolutionFound: null,
    pdfsCreated: [],
    errors: []
  };
  
  for (let i = 0; i < BNE_TEST_URLS.length; i++) {
    const url = BNE_TEST_URLS[i];
    const testName = `BNE-Test-${i + 1}`;
    console.log(`\nTesting URL ${i + 1}/${BNE_TEST_URLS.length}: ${url}`);
    
    const testResult = {
      testName,
      url,
      status: 'testing',
      pdfPath: null,
      pageCount: 0,
      fileSize: 0,
      resolutionTested: [],
      errors: []
    };
    
    try {
      const electronScript = `
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  try {
    const { EnhancedManuscriptDownloaderService } = await import('${path.resolve(__dirname, '../../src/main/services/EnhancedManuscriptDownloaderService.js')}');
    const { EnhancedPdfMerger } = await import('${path.resolve(__dirname, '../../src/main/services/EnhancedPdfMerger.js')}');
    const { ElectronImageCache } = await import('${path.resolve(__dirname, '../../src/main/services/ElectronImageCache.js')}');
    
    const downloader = new EnhancedManuscriptDownloaderService();
    const pdfMerger = new EnhancedPdfMerger();
    const imageCache = new ElectronImageCache();
    
    console.log('Loading manifest for: ${url}');
    const manifest = await downloader.loadManifest('${url}');
    
    if (!manifest || !manifest.pages || manifest.pages.length === 0) {
      throw new Error('No pages found in manifest');
    }
    
    console.log(\`Found \${manifest.pages.length} pages\`);
    
    // Test maximum resolution for first few pages
    const testPages = manifest.pages.slice(0, Math.min(10, manifest.pages.length));
    const resolutions = ['full/full', 'full/max', 'full/4000,', 'full/2000,', 'full/1000,'];
    let bestResolution = 'full/full';
    let maxFileSize = 0;
    
    for (const resolution of resolutions) {
      try {
        const testUrl = manifest.pages[0].imageUrl.replace(/\\/full\\/[^/]+\\//, \`/full/\${resolution}/\`);
        console.log(\`Testing resolution: \${resolution}\`);
        
        const response = await fetch(testUrl);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          if (buffer.byteLength > maxFileSize) {
            maxFileSize = buffer.byteLength;
            bestResolution = resolution;
          }
          console.log(\`Resolution \${resolution}: \${buffer.byteLength} bytes\`);
        }
      } catch (error) {
        console.log(\`Resolution \${resolution} failed: \${error.message}\`);
      }
    }
    
    console.log(\`Best resolution found: \${bestResolution} (\${maxFileSize} bytes)\`);
    
    // Download pages with best resolution
    const downloadedImages = [];
    for (let i = 0; i < testPages.length; i++) {
      const page = testPages[i];
      const imageUrl = page.imageUrl.replace(/\\/full\\/[^/]+\\//, \`/full/\${bestResolution}/\`);
      
      console.log(\`Downloading page \${i + 1}/\${testPages.length}\`);
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(\`Failed to download page \${i + 1}: \${response.statusText}\`);
      }
      
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength < 1024) {
        throw new Error(\`Page \${i + 1} too small: \${buffer.byteLength} bytes\`);
      }
      
      const imagePath = path.join('${VALIDATION_DIR}', \`\${testName}-page-\${i + 1}.jpg\`);
      require('fs').writeFileSync(imagePath, Buffer.from(buffer));
      downloadedImages.push(imagePath);
    }
    
    // Create PDF
    const pdfPath = path.join('${VALIDATION_DIR}', \`\${testName}-VALIDATION.pdf\`);
    await pdfMerger.mergeImagesToPdf(downloadedImages, pdfPath, {
      title: \`BNE Validation - \${manifest.title || 'Unknown'}\`,
      metadata: {
        subject: 'BNE Library Validation Test',
        creator: 'MSS Downloader Validation Protocol'
      }
    });
    
    // Get PDF stats
    const pdfStats = require('fs').statSync(pdfPath);
    
    console.log(JSON.stringify({
      success: true,
      testName: '${testName}',
      pdfPath,
      pageCount: testPages.length,
      fileSize: pdfStats.size,
      maxResolution: bestResolution,
      maxFileSize
    }));
    
    app.quit();
    
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }));
    app.quit(1);
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
`;
      
      const tempScript = path.join(VALIDATION_DIR, `${testName}-test.js`);
      fs.writeFileSync(tempScript, electronScript);
      
      console.log('Running Electron test...');
      const result = execSync(`cd /Users/e.barsky/Desktop/Personal/Electron/mss-downloader && npx electron ${tempScript}`, {
        encoding: 'utf8',
        timeout: 300000 // 5 minutes
      });
      
      const output = result.trim().split('\n').pop();
      const testData = JSON.parse(output);
      
      if (testData.success) {
        testResult.status = 'completed';
        testResult.pdfPath = testData.pdfPath;
        testResult.pageCount = testData.pageCount;
        testResult.fileSize = testData.fileSize;
        testResult.resolutionTested.push({
          resolution: testData.maxResolution,
          maxFileSize: testData.maxFileSize
        });
        
        results.pdfsCreated.push(testData.pdfPath);
        if (!results.maxResolutionFound || testData.maxFileSize > results.maxResolutionFound.fileSize) {
          results.maxResolutionFound = {
            resolution: testData.maxResolution,
            fileSize: testData.maxFileSize
          };
        }
        
        console.log(`✅ Test completed: ${testData.pageCount} pages, ${testData.fileSize} bytes`);
      } else {
        throw new Error(testData.error);
      }
      
      fs.unlinkSync(tempScript);
      
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      testResult.status = 'failed';
      testResult.errors.push(error.message);
      results.errors.push(`${testName}: ${error.message}`);
    }
    
    results.tests.push(testResult);
  }
  
  results.overallStatus = results.errors.length === 0 ? 'passed' : 'failed';
  
  const reportPath = path.join(VALIDATION_DIR, 'BNE-VALIDATION-REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  
  console.log(`\n=== BNE VALIDATION COMPLETE ===`);
  console.log(`Status: ${results.overallStatus}`);
  console.log(`PDFs created: ${results.pdfsCreated.length}`);
  console.log(`Errors: ${results.errors.length}`);
  console.log(`Report: ${reportPath}`);
  
  return results;
}

if (require.main === module) {
  testBNELibrary().catch(console.error);
}

module.exports = { testBNELibrary };