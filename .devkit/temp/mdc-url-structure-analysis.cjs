/**
 * Agent 1: MDC Catalonia URL Structure Analysis
 * Investigates URL patterns and page identification systems
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Test URLs provided by user
const testUrls = [
  'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
  'https://mdc.csuc.cat/digital/collection/incunableBC/id/49455/rec/2', 
  'https://mdc.csuc.cat/digital/collection/incunableBC/id/14914/rec/1'
];

// Analysis results
const results = {
  timestamp: new Date().toISOString(),
  urlPatterns: [],
  pageIdSystems: [],
  apiEndpoints: [],
  errorAnalysis: [],
  findings: []
};

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      },
      timeout: 30000
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ 
        statusCode: res.statusCode,
        headers: res.headers,
        body: data,
        url: url
      }));
    }).on('error', reject).on('timeout', () => reject(new Error('Request timeout')));
  });
}

async function analyzeUrlStructure(url) {
  console.log(`\n=== Analyzing URL Structure: ${url} ===`);
  
  try {
    const response = await makeRequest(url);
    
    // Parse URL components
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    
    const analysis = {
      url: url,
      statusCode: response.statusCode,
      pathComponents: pathParts,
      queryParams: Object.fromEntries(urlObj.searchParams),
      contentType: response.headers['content-type'],
      bodyPreview: response.body.substring(0, 500),
      extractedIds: []
    };
    
    // Extract potential IDs and patterns
    const idMatches = response.body.match(/\b\d{4,7}\b/g);
    if (idMatches) {
      analysis.extractedIds = [...new Set(idMatches)];
    }
    
    // Look for API endpoints in the response
    const apiMatches = response.body.match(/\/api\/[^"'\s]+/g);
    if (apiMatches) {
      analysis.apiEndpoints = [...new Set(apiMatches)];
    }
    
    // Check for JSON data
    const jsonMatches = response.body.match(/\{[^}]*"id"[^}]*\}/g);
    if (jsonMatches) {
      analysis.jsonData = jsonMatches.slice(0, 3); // First 3 matches
    }
    
    results.urlPatterns.push(analysis);
    
    console.log(`Status: ${response.statusCode}`);
    console.log(`Path components: ${pathParts.join(' / ')}`);
    console.log(`Extracted IDs: ${analysis.extractedIds.join(', ')}`);
    console.log(`API endpoints found: ${analysis.apiEndpoints.length}`);
    
    return analysis;
    
  } catch (error) {
    console.error(`Error analyzing ${url}:`, error.message);
    results.errorAnalysis.push({
      url: url,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    return null;
  }
}

async function discoverApiEndpoints(baseUrl) {
  console.log(`\n=== Discovering API Endpoints for ${baseUrl} ===`);
  
  const urlObj = new URL(baseUrl);
  const basePath = urlObj.pathname.match(/^\/digital\/collection\/[^\/]+\/id\/\d+/)[0];
  
  // Test various API patterns
  const apiPatterns = [
    '/api/info',
    '/api/manifest',
    '/api/pages',
    '/api/metadata',
    '/manifest.json',
    '/info.json',
    '/pages.json',
    '/dmGetItemInfo',
    '/dmGetCollectionParameters',
    '/dmGetCollectionInfo'
  ];
  
  for (const pattern of apiPatterns) {
    const testUrl = `${urlObj.origin}${basePath}${pattern}`;
    console.log(`Testing: ${testUrl}`);
    
    try {
      const response = await makeRequest(testUrl);
      if (response.statusCode === 200) {
        console.log(`✓ Found API endpoint: ${testUrl}`);
        results.apiEndpoints.push({
          url: testUrl,
          statusCode: response.statusCode,
          contentType: response.headers['content-type'],
          bodyPreview: response.body.substring(0, 300)
        });
      }
    } catch (error) {
      console.log(`✗ Failed: ${testUrl} - ${error.message}`);
    }
  }
}

async function testPageIdentificationSystems() {
  console.log(`\n=== Testing Page Identification Systems ===`);
  
  const baseUrl = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331';
  
  // Test different page identification patterns
  const pagePatterns = [
    '/rec/1', '/rec/2', '/rec/3', '/rec/4', '/rec/5',
    '/page/1', '/page/2', '/page/3',
    '/p/1', '/p/2', '/p/3',
    '?page=1', '?page=2', '?page=3',
    '?p=1', '?p=2', '?p=3'
  ];
  
  for (const pattern of pagePatterns) {
    const testUrl = baseUrl + pattern;
    console.log(`Testing page pattern: ${testUrl}`);
    
    try {
      const response = await makeRequest(testUrl);
      
      const pageInfo = {
        pattern: pattern,
        url: testUrl,
        statusCode: response.statusCode,
        success: response.statusCode === 200,
        hasContent: response.body.length > 1000
      };
      
      // Check for page-specific content
      if (response.body.includes('Page ') || response.body.includes('page ')) {
        pageInfo.hasPageIndicator = true;
      }
      
      results.pageIdSystems.push(pageInfo);
      
      console.log(`${pageInfo.success ? '✓' : '✗'} ${pattern}: ${response.statusCode}`);
      
    } catch (error) {
      console.log(`✗ ${pattern}: ${error.message}`);
      results.pageIdSystems.push({
        pattern: pattern,
        url: testUrl,
        error: error.message,
        success: false
      });
    }
  }
}

async function analyzeImageUrlPatterns() {
  console.log(`\n=== Analyzing Image URL Patterns ===`);
  
  // Test different image URL construction patterns
  const imagePatterns = [
    'https://mdc.csuc.cat/digital/api/singleitem/collection/incunableBC/id/175331/rec/1',
    'https://mdc.csuc.cat/digital/iiif/incunableBC:175331/full/full/0/default.jpg',
    'https://mdc.csuc.cat/digital/iiif/incunableBC:175331/full/max/0/default.jpg',
    'https://mdc.csuc.cat/digital/iiif/incunableBC:175331/full/2000,/0/default.jpg',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1/compound_object',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1/image',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1/download'
  ];
  
  for (const imageUrl of imagePatterns) {
    console.log(`Testing image URL: ${imageUrl}`);
    
    try {
      const response = await makeRequest(imageUrl);
      
      const imageInfo = {
        url: imageUrl,
        statusCode: response.statusCode,
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length'],
        isImage: response.headers['content-type']?.includes('image'),
        bodyPreview: response.body.substring(0, 200)
      };
      
      results.findings.push({
        type: 'image_url_test',
        ...imageInfo
      });
      
      console.log(`Status: ${response.statusCode}, Type: ${response.headers['content-type']}`);
      
    } catch (error) {
      console.log(`✗ Failed: ${error.message}`);
      results.findings.push({
        type: 'image_url_test',
        url: imageUrl,
        error: error.message
      });
    }
  }
}

async function main() {
  console.log('=== MDC Catalonia URL Structure Analysis ===');
  
  // Analyze each test URL
  for (const url of testUrls) {
    await analyzeUrlStructure(url);
    await discoverApiEndpoints(url);
  }
  
  // Test page identification systems
  await testPageIdentificationSystems();
  
  // Analyze image URL patterns
  await analyzeImageUrlPatterns();
  
  // Save results
  const reportPath = path.join(__dirname, '../reports/mdc-url-structure-analysis.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  
  console.log('\n=== Analysis Complete ===');
  console.log(`Report saved to: ${reportPath}`);
  console.log(`Total URL patterns analyzed: ${results.urlPatterns.length}`);
  console.log(`API endpoints discovered: ${results.apiEndpoints.length}`);
  console.log(`Page ID systems tested: ${results.pageIdSystems.length}`);
  console.log(`Image URL patterns tested: ${results.findings.filter(f => f.type === 'image_url_test').length}`);
}

main().catch(console.error);