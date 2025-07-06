/**
 * Agent 3: MDC Catalonia Image URL Construction Analysis
 * Determines correct image URL building patterns and resolution testing
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const results = {
  timestamp: new Date().toISOString(),
  imageUrlPatterns: [],
  resolutionTests: [],
  iiifTests: [],
  downloadTests: [],
  findings: []
};

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Referer': 'https://mdc.csuc.cat/'
      },
      timeout: 30000
    };

    https.get(url, options, (res) => {
      let data = Buffer.alloc(0);
      res.on('data', chunk => data = Buffer.concat([data, chunk]));
      res.on('end', () => resolve({ 
        statusCode: res.statusCode,
        headers: res.headers,
        body: data,
        url: url
      }));
    }).on('error', reject).on('timeout', () => reject(new Error('Request timeout')));
  });
}

async function testImageUrlPattern(pattern, testId, pageNum = 1) {
  console.log(`\n=== Testing Image URL Pattern: ${pattern} ===`);
  
  // Replace placeholders
  const url = pattern
    .replace('{collection}', 'incunableBC')
    .replace('{id}', testId)
    .replace('{page}', pageNum.toString())
    .replace('{rec}', pageNum.toString());
  
  console.log(`Testing URL: ${url}`);
  
  try {
    const response = await makeRequest(url);
    
    const analysis = {
      pattern: pattern,
      testId: testId,
      pageNum: pageNum,
      url: url,
      statusCode: response.statusCode,
      contentType: response.headers['content-type'],
      contentLength: parseInt(response.headers['content-length']) || response.body.length,
      isImage: false,
      imageFormat: null,
      imageSize: null,
      success: false
    };
    
    // Check if it's an image
    if (response.headers['content-type']?.includes('image')) {
      analysis.isImage = true;
      analysis.imageFormat = response.headers['content-type'];
      analysis.success = true;
      
      // Try to determine image dimensions from first few bytes
      if (response.body.length > 100) {
        analysis.imageSize = analyzeImageSize(response.body);
      }
    }
    
    // Check for JSON response with image info
    if (response.headers['content-type']?.includes('json')) {
      try {
        const jsonData = JSON.parse(response.body.toString());
        if (jsonData.image || jsonData.thumbnail || jsonData.fullsize) {
          analysis.hasImageInfo = true;
          analysis.imageInfo = {
            image: jsonData.image,
            thumbnail: jsonData.thumbnail,
            fullsize: jsonData.fullsize
          };
        }
      } catch (e) {
        // Not valid JSON
      }
    }
    
    results.imageUrlPatterns.push(analysis);
    
    console.log(`Status: ${response.statusCode}`);
    console.log(`Content-Type: ${response.headers['content-type']}`);
    console.log(`Content-Length: ${analysis.contentLength}`);
    console.log(`Is Image: ${analysis.isImage}`);
    console.log(`Success: ${analysis.success}`);
    
    return analysis;
    
  } catch (error) {
    console.error(`Error testing ${url}:`, error.message);
    results.imageUrlPatterns.push({
      pattern: pattern,
      testId: testId,
      pageNum: pageNum,
      url: url,
      error: error.message,
      success: false
    });
    return null;
  }
}

function analyzeImageSize(buffer) {
  try {
    // Simple image size detection for common formats
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      // JPEG
      return { format: 'JPEG', detected: true };
    } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      // PNG
      return { format: 'PNG', detected: true };
    } else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      // GIF
      return { format: 'GIF', detected: true };
    }
    return { format: 'unknown', detected: false };
  } catch (e) {
    return { format: 'error', detected: false };
  }
}

async function testIIIFPatterns() {
  console.log(`\n=== Testing IIIF Patterns ===`);
  
  const testId = '175331';
  const collection = 'incunableBC';
  
  // Test various IIIF patterns
  const iiifPatterns = [
    `https://mdc.csuc.cat/digital/iiif/{collection}:{id}/full/full/0/default.jpg`,
    `https://mdc.csuc.cat/digital/iiif/{collection}:{id}/full/max/0/default.jpg`,
    `https://mdc.csuc.cat/digital/iiif/{collection}:{id}/full/2000,/0/default.jpg`,
    `https://mdc.csuc.cat/digital/iiif/{collection}:{id}/full/1000,/0/default.jpg`,
    `https://mdc.csuc.cat/digital/iiif/{collection}:{id}/full/500,/0/default.jpg`,
    `https://mdc.csuc.cat/digital/iiif/{collection}:{id}/full/,2000/0/default.jpg`,
    `https://mdc.csuc.cat/digital/iiif/{collection}:{id}/full/,1000/0/default.jpg`,
    `https://mdc.csuc.cat/digital/iiif/{collection}_{id}/full/full/0/default.jpg`,
    `https://mdc.csuc.cat/digital/iiif/{collection}_{id}/full/max/0/default.jpg`,
    `https://mdc.csuc.cat/digital/iiif/{id}/full/full/0/default.jpg`,
    `https://mdc.csuc.cat/digital/iiif/{id}/full/max/0/default.jpg`,
    `https://mdc.csuc.cat/iiif/{collection}:{id}/full/full/0/default.jpg`,
    `https://mdc.csuc.cat/iiif/{collection}:{id}/full/max/0/default.jpg`
  ];
  
  for (const pattern of iiifPatterns) {
    const analysis = await testImageUrlPattern(pattern, testId);
    if (analysis) {
      results.iiifTests.push(analysis);
    }
  }
}

async function testResolutionVariations() {
  console.log(`\n=== Testing Resolution Variations ===`);
  
  const testId = '175331';
  const collection = 'incunableBC';
  
  // Test different resolution parameters
  const resolutionTests = [
    { size: 'full', expected: 'Maximum resolution' },
    { size: 'max', expected: 'Maximum resolution' },
    { size: '4000,', expected: 'Width 4000px' },
    { size: '3000,', expected: 'Width 3000px' },
    { size: '2000,', expected: 'Width 2000px' },
    { size: '1500,', expected: 'Width 1500px' },
    { size: '1000,', expected: 'Width 1000px' },
    { size: '800,', expected: 'Width 800px' },
    { size: '600,', expected: 'Width 600px' },
    { size: '400,', expected: 'Width 400px' },
    { size: ',4000', expected: 'Height 4000px' },
    { size: ',3000', expected: 'Height 3000px' },
    { size: ',2000', expected: 'Height 2000px' },
    { size: ',1500', expected: 'Height 1500px' },
    { size: ',1000', expected: 'Height 1000px' },
    { size: '400,400', expected: '400x400px' },
    { size: '800,800', expected: '800x800px' },
    { size: '1200,1200', expected: '1200x1200px' }
  ];
  
  // Test with base IIIF pattern
  const basePattern = `https://mdc.csuc.cat/digital/iiif/{collection}:{id}/full/{size}/0/default.jpg`;
  
  for (const test of resolutionTests) {
    const pattern = basePattern.replace('{size}', test.size);
    
    console.log(`Testing resolution: ${test.size} (${test.expected})`);
    
    const analysis = await testImageUrlPattern(pattern, testId);
    if (analysis) {
      analysis.resolutionTest = test;
      results.resolutionTests.push(analysis);
    }
  }
}

async function testDownloadEndpoints() {
  console.log(`\n=== Testing Download Endpoints ===`);
  
  const testId = '175331';
  const collection = 'incunableBC';
  
  // Test various download endpoints
  const downloadPatterns = [
    `https://mdc.csuc.cat/digital/collection/{collection}/id/{id}/rec/{page}/download`,
    `https://mdc.csuc.cat/digital/collection/{collection}/id/{id}/rec/{page}/image`,
    `https://mdc.csuc.cat/digital/collection/{collection}/id/{id}/rec/{page}/fullsize`,
    `https://mdc.csuc.cat/digital/collection/{collection}/id/{id}/rec/{page}/thumbnail`,
    `https://mdc.csuc.cat/digital/api/singleitem/collection/{collection}/id/{id}/rec/{page}`,
    `https://mdc.csuc.cat/digital/api/collection/{collection}/id/{id}/rec/{page}/download`,
    `https://mdc.csuc.cat/digital/api/collection/{collection}/id/{id}/rec/{page}/image`,
    `https://mdc.csuc.cat/digital/download/{collection}/{id}/{page}`,
    `https://mdc.csuc.cat/digital/image/{collection}/{id}/{page}`,
    `https://mdc.csuc.cat/utils/getfile/collection/{collection}/id/{id}/filename/{id}.jpg`,
    `https://mdc.csuc.cat/utils/getstream/collection/{collection}/id/{id}/filename/{id}.jpg`
  ];
  
  for (const pattern of downloadPatterns) {
    const analysis = await testImageUrlPattern(pattern, testId, 1);
    if (analysis) {
      results.downloadTests.push(analysis);
    }
  }
}

async function testMultipleIds() {
  console.log(`\n=== Testing Multiple IDs ===`);
  
  const testIds = ['175331', '49455', '14914'];
  
  // Test the most promising patterns with multiple IDs
  const promisingPatterns = [
    `https://mdc.csuc.cat/digital/iiif/{collection}:{id}/full/full/0/default.jpg`,
    `https://mdc.csuc.cat/digital/iiif/{collection}:{id}/full/max/0/default.jpg`,
    `https://mdc.csuc.cat/digital/collection/{collection}/id/{id}/rec/{page}/download`,
    `https://mdc.csuc.cat/digital/api/singleitem/collection/{collection}/id/{id}/rec/{page}`
  ];
  
  for (const testId of testIds) {
    console.log(`Testing ID: ${testId}`);
    
    for (const pattern of promisingPatterns) {
      const analysis = await testImageUrlPattern(pattern, testId, 1);
      if (analysis && analysis.success) {
        results.findings.push({
          type: 'successful_pattern',
          pattern: pattern,
          testId: testId,
          analysis: analysis
        });
      }
    }
  }
}

async function main() {
  console.log('=== MDC Catalonia Image URL Construction Analysis ===');
  
  // Test IIIF patterns
  await testIIIFPatterns();
  
  // Test resolution variations
  await testResolutionVariations();
  
  // Test download endpoints
  await testDownloadEndpoints();
  
  // Test multiple IDs
  await testMultipleIds();
  
  // Save results
  const reportPath = path.join(__dirname, '../reports/mdc-image-url-construction.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  
  console.log('\n=== Analysis Complete ===');
  console.log(`Report saved to: ${reportPath}`);
  console.log(`Image URL patterns tested: ${results.imageUrlPatterns.length}`);
  console.log(`IIIF tests: ${results.iiifTests.length}`);
  console.log(`Resolution tests: ${results.resolutionTests.length}`);
  console.log(`Download tests: ${results.downloadTests.length}`);
  console.log(`Successful patterns found: ${results.findings.filter(f => f.type === 'successful_pattern').length}`);
}

main().catch(console.error);