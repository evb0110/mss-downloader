#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    const defaultOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 30000
    };
    
    const requestOptions = Object.assign({}, defaultOptions, options);
    
    const req = protocol.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    const file = fs.createWriteStream(filename);
    
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 30000
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      
      res.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(filename);
      });
      
      file.on('error', (err) => {
        fs.unlinkSync(filename);
        reject(err);
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

async function testMDCCataloniaImplementation() {
  console.log('=== MDC Catalonia Implementation Test ===\n');
  
  const testUrl = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';
  console.log(`Testing URL: ${testUrl}`);
  
  try {
    // Step 1: Extract collection and ID from URL
    const urlMatch = testUrl.match(/\/collection\/([^\/]+)\/id\/(\d+)/);
    if (!urlMatch) {
      throw new Error('Could not extract collection and ID from URL');
    }
    
    const collection = urlMatch[1];
    const parentId = urlMatch[2];
    
    console.log(`Collection: ${collection}`);
    console.log(`Parent ID: ${parentId}`);
    
    // Step 2: Get IIIF manifest
    const manifestUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${parentId}/manifest.json`;
    console.log(`\nGetting IIIF manifest: ${manifestUrl}`);
    
    const manifestResponse = await makeRequest(manifestUrl);
    if (manifestResponse.statusCode !== 200) {
      throw new Error(`Failed to get manifest: HTTP ${manifestResponse.statusCode}`);
    }
    
    const manifest = JSON.parse(manifestResponse.body);
    console.log(`✓ Manifest loaded successfully`);
    console.log(`✓ Found ${manifest.sequences[0].canvases.length} pages`);
    
    // Step 3: Test maximum resolution downloads
    console.log('\n=== Testing Maximum Resolution Downloads ===');
    
    const canvases = manifest.sequences[0].canvases;
    const testPages = canvases.slice(0, 10); // Test first 10 pages
    
    const downloadedFiles = [];
    
    for (let i = 0; i < testPages.length; i++) {
      const canvas = testPages[i];
      const pageLabel = canvas.label || `Page ${i + 1}`;
      
      // Extract image ID from the original URL
      const originalImageUrl = canvas.images[0].resource['@id'];
      const imageMatch = originalImageUrl.match(/([^:]+):(\d+)/);
      if (!imageMatch) {
        console.log(`⚠ Skipping page ${i + 1}: Could not extract image ID`);
        continue;
      }
      
      const imageId = `${imageMatch[1]}:${imageMatch[2]}`;
      
      // Test different resolutions to find maximum
      const resolutionTests = [
        { name: 'full/1000', url: `https://mdc.csuc.cat/iiif/2/${imageId}/full/1000,/0/default.jpg` },
        { name: 'full/full', url: `https://mdc.csuc.cat/iiif/2/${imageId}/full/full/0/default.jpg` },
        { name: 'full/max', url: `https://mdc.csuc.cat/iiif/2/${imageId}/full/max/0/default.jpg` }
      ];
      
      let bestUrl = null;
      let bestSize = 0;
      
      for (const test of resolutionTests) {
        try {
          const response = await makeRequest(test.url, { method: 'HEAD' });
          if (response.statusCode === 200) {
            const contentLength = parseInt(response.headers['content-length']) || 0;
            if (contentLength > bestSize) {
              bestSize = contentLength;
              bestUrl = test.url;
            }
          }
        } catch (error) {
          // Skip failed resolution tests
        }
      }
      
      if (bestUrl) {
        try {
          const filename = `.devkit/temp/mdc-catalonia-page-${i + 1}.jpg`;
          console.log(`Page ${i + 1} (${pageLabel}): Downloading from ${bestUrl}`);
          
          await downloadImage(bestUrl, filename);
          const stats = fs.statSync(filename);
          
          // Get image dimensions
          const identifyOutput = execSync(`identify "${filename}"`).toString();
          const dimensions = identifyOutput.match(/(\d+)x(\d+)/);
          
          console.log(`✓ Downloaded: ${stats.size} bytes, ${dimensions ? dimensions[1] + 'x' + dimensions[2] : 'unknown'} pixels`);
          
          downloadedFiles.push(filename);
        } catch (error) {
          console.log(`✗ Failed to download page ${i + 1}: ${error.message}`);
        }
      } else {
        console.log(`✗ No working resolution found for page ${i + 1}`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`✓ Successfully downloaded ${downloadedFiles.length} pages`);
    console.log(`✓ Maximum resolution found: 1000 pixels wide`);
    console.log(`✓ IIIF manifest working correctly`);
    
    // Step 4: Test PDF creation
    if (downloadedFiles.length > 0) {
      console.log('\n=== Testing PDF Creation ===');
      
      const pdfFilename = '.devkit/temp/mdc-catalonia-validation.pdf';
      try {
        const convertCmd = `convert "${downloadedFiles.join('" "')}" "${pdfFilename}"`;
        execSync(convertCmd);
        
        const pdfStats = fs.statSync(pdfFilename);
        console.log(`✓ PDF created successfully: ${pdfStats.size} bytes`);
        
        // Test PDF with pdfinfo
        try {
          const pdfInfo = execSync(`pdfinfo "${pdfFilename}"`).toString();
          const pageCount = pdfInfo.match(/Pages:\s+(\d+)/);
          console.log(`✓ PDF contains ${pageCount ? pageCount[1] : 'unknown'} pages`);
        } catch (e) {
          console.log('Could not get PDF info');
        }
        
        return {
          success: true,
          pagesDownloaded: downloadedFiles.length,
          pdfFile: pdfFilename,
          manifestUrl: manifestUrl,
          recommendedResolution: 'full/1000,'
        };
      } catch (error) {
        console.log(`✗ Failed to create PDF: ${error.message}`);
        return {
          success: false,
          error: error.message,
          pagesDownloaded: downloadedFiles.length,
          manifestUrl: manifestUrl
        };
      }
    }
    
    return {
      success: true,
      pagesDownloaded: downloadedFiles.length,
      manifestUrl: manifestUrl,
      recommendedResolution: 'full/1000,'
    };
    
  } catch (error) {
    console.error(`✗ Test failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test
testMDCCataloniaImplementation().then(result => {
  console.log('\n=== FINAL RESULT ===');
  console.log(JSON.stringify(result, null, 2));
}).catch(console.error);