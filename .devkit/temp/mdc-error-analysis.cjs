/**
 * Agent 4: MDC Catalonia Error Analysis
 * Identifies causes of 501 errors and prevention methods
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const results = {
  timestamp: new Date().toISOString(),
  errorTests: [],
  headerAnalysis: [],
  statusCodeAnalysis: [],
  preventionMethods: [],
  findings: []
};

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const defaultOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Referer': 'https://mdc.csuc.cat/'
      },
      timeout: 30000,
      ...options
    };

    https.get(url, defaultOptions, (res) => {
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

async function testErrorConditions() {
  console.log(`\n=== Testing Error Conditions ===`);
  
  const testCases = [
    {
      name: 'Missing User-Agent',
      url: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
      options: { headers: {} }
    },
    {
      name: 'Wrong User-Agent',
      url: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
      options: { headers: { 'User-Agent': 'Bot/1.0' } }
    },
    {
      name: 'Missing Referer',
      url: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
      options: { headers: { 'User-Agent': 'Mozilla/5.0' } }
    },
    {
      name: 'Invalid Collection',
      url: 'https://mdc.csuc.cat/digital/collection/invalid/id/175331/rec/1',
      options: {}
    },
    {
      name: 'Invalid ID',
      url: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/999999/rec/1',
      options: {}
    },
    {
      name: 'Invalid Page',
      url: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/999',
      options: {}
    },
    {
      name: 'Direct Image Access',
      url: 'https://mdc.csuc.cat/digital/iiif/incunableBC:175331/full/full/0/default.jpg',
      options: { headers: {} }
    },
    {
      name: 'API Without Headers',
      url: 'https://mdc.csuc.cat/digital/api/singleitem/collection/incunableBC/id/175331/rec/1',
      options: { headers: {} }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    
    try {
      const response = await makeRequest(testCase.url, testCase.options);
      
      const analysis = {
        testName: testCase.name,
        url: testCase.url,
        options: testCase.options,
        statusCode: response.statusCode,
        headers: response.headers,
        bodySize: response.body.length,
        isError: response.statusCode >= 400,
        errorType: getErrorType(response.statusCode),
        bodyPreview: response.body.substring(0, 500)
      };
      
      // Check for specific error indicators
      if (response.body.includes('501') || response.statusCode === 501) {
        analysis.has501Error = true;
      }
      
      if (response.body.includes('Not Implemented') || response.body.includes('not implemented')) {
        analysis.hasNotImplementedError = true;
      }
      
      if (response.body.includes('Forbidden') || response.statusCode === 403) {
        analysis.hasForbiddenError = true;
      }
      
      results.errorTests.push(analysis);
      
      console.log(`Status: ${response.statusCode} - ${analysis.errorType}`);
      
    } catch (error) {
      console.error(`Error in ${testCase.name}:`, error.message);
      results.errorTests.push({
        testName: testCase.name,
        url: testCase.url,
        options: testCase.options,
        error: error.message,
        isError: true,
        errorType: 'request_failed'
      });
    }
  }
}

function getErrorType(statusCode) {
  if (statusCode >= 200 && statusCode < 300) return 'success';
  if (statusCode >= 300 && statusCode < 400) return 'redirect';
  if (statusCode === 400) return 'bad_request';
  if (statusCode === 401) return 'unauthorized';
  if (statusCode === 403) return 'forbidden';
  if (statusCode === 404) return 'not_found';
  if (statusCode === 500) return 'internal_server_error';
  if (statusCode === 501) return 'not_implemented';
  if (statusCode === 502) return 'bad_gateway';
  if (statusCode === 503) return 'service_unavailable';
  if (statusCode >= 400 && statusCode < 500) return 'client_error';
  if (statusCode >= 500) return 'server_error';
  return 'unknown';
}

async function analyzeHeaders() {
  console.log(`\n=== Analyzing Headers ===`);
  
  const testUrl = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';
  
  const headerTests = [
    {
      name: 'Minimal Headers',
      headers: {}
    },
    {
      name: 'Browser Headers',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      }
    },
    {
      name: 'With Referer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://mdc.csuc.cat/'
      }
    },
    {
      name: 'With Authorization',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Authorization': 'Bearer token'
      }
    },
    {
      name: 'Image Accept',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    },
    {
      name: 'JSON Accept',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json,text/plain,*/*'
      }
    }
  ];
  
  for (const test of headerTests) {
    console.log(`Testing headers: ${test.name}`);
    
    try {
      const response = await makeRequest(testUrl, { headers: test.headers });
      
      const analysis = {
        testName: test.name,
        requestHeaders: test.headers,
        statusCode: response.statusCode,
        responseHeaders: response.headers,
        success: response.statusCode === 200,
        contentType: response.headers['content-type'],
        bodySize: response.body.length
      };
      
      results.headerAnalysis.push(analysis);
      
      console.log(`Status: ${response.statusCode}, Content-Type: ${response.headers['content-type']}`);
      
    } catch (error) {
      console.error(`Error with ${test.name}:`, error.message);
      results.headerAnalysis.push({
        testName: test.name,
        requestHeaders: test.headers,
        error: error.message,
        success: false
      });
    }
  }
}

async function testStatusCodePatterns() {
  console.log(`\n=== Testing Status Code Patterns ===`);
  
  const testUrls = [
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/2',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/3',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/49455/rec/1',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/49455/rec/2',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/14914/rec/1',
    'https://mdc.csuc.cat/digital/collection/invalidcollection/id/175331/rec/1',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/999999/rec/1',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/999'
  ];
  
  for (const url of testUrls) {
    console.log(`Testing URL: ${url}`);
    
    try {
      const response = await makeRequest(url);
      
      const analysis = {
        url: url,
        statusCode: response.statusCode,
        errorType: getErrorType(response.statusCode),
        contentType: response.headers['content-type'],
        bodySize: response.body.length,
        hasErrorContent: response.body.includes('error') || response.body.includes('Error'),
        has501Content: response.body.includes('501') || response.body.includes('Not Implemented')
      };
      
      // Extract error messages
      const errorMatch = response.body.match(/<div[^>]*class="error"[^>]*>(.*?)<\/div>/s);
      if (errorMatch) {
        analysis.errorMessage = errorMatch[1].replace(/<[^>]*>/g, '').trim();
      }
      
      results.statusCodeAnalysis.push(analysis);
      
      console.log(`Status: ${response.statusCode} - ${analysis.errorType}`);
      
    } catch (error) {
      console.error(`Error with ${url}:`, error.message);
      results.statusCodeAnalysis.push({
        url: url,
        error: error.message,
        errorType: 'request_failed'
      });
    }
  }
}

async function identifyPreventionMethods() {
  console.log(`\n=== Identifying Prevention Methods ===`);
  
  // Test successful patterns
  const successfulPatterns = [
    {
      name: 'Standard Browser Request',
      url: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Referer': 'https://mdc.csuc.cat/'
      }
    },
    {
      name: 'Image Request with Referer',
      url: 'https://mdc.csuc.cat/digital/iiif/incunableBC:175331/full/full/0/default.jpg',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1'
      }
    },
    {
      name: 'API Request with JSON Accept',
      url: 'https://mdc.csuc.cat/digital/api/singleitem/collection/incunableBC/id/175331/rec/1',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json,text/plain,*/*',
        'Referer': 'https://mdc.csuc.cat/'
      }
    }
  ];
  
  for (const pattern of successfulPatterns) {
    console.log(`Testing prevention method: ${pattern.name}`);
    
    try {
      const response = await makeRequest(pattern.url, { headers: pattern.headers });
      
      const method = {
        name: pattern.name,
        url: pattern.url,
        headers: pattern.headers,
        statusCode: response.statusCode,
        success: response.statusCode === 200,
        contentType: response.headers['content-type'],
        bodySize: response.body.length,
        prevents501: response.statusCode !== 501 && !response.body.includes('501')
      };
      
      results.preventionMethods.push(method);
      
      console.log(`Success: ${method.success}, Prevents 501: ${method.prevents501}`);
      
    } catch (error) {
      console.error(`Error with ${pattern.name}:`, error.message);
      results.preventionMethods.push({
        name: pattern.name,
        url: pattern.url,
        headers: pattern.headers,
        error: error.message,
        success: false,
        prevents501: false
      });
    }
  }
}

async function main() {
  console.log('=== MDC Catalonia Error Analysis ===');
  
  // Test error conditions
  await testErrorConditions();
  
  // Analyze headers
  await analyzeHeaders();
  
  // Test status code patterns
  await testStatusCodePatterns();
  
  // Identify prevention methods
  await identifyPreventionMethods();
  
  // Analyze results
  const errorTests = results.errorTests.filter(test => test.isError);
  const successfulTests = results.errorTests.filter(test => !test.isError);
  const prevention501 = results.preventionMethods.filter(method => method.prevents501);
  
  results.findings = [
    {
      type: 'error_summary',
      totalTests: results.errorTests.length,
      errorTests: errorTests.length,
      successfulTests: successfulTests.length,
      most_common_error: errorTests.reduce((acc, test) => {
        acc[test.errorType] = (acc[test.errorType] || 0) + 1;
        return acc;
      }, {})
    },
    {
      type: 'prevention_summary',
      totalPreventionMethods: results.preventionMethods.length,
      successful501Prevention: prevention501.length,
      recommendedHeaders: prevention501.length > 0 ? prevention501[0].headers : null
    }
  ];
  
  // Save results
  const reportPath = path.join(__dirname, '../reports/mdc-error-analysis.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  
  console.log('\n=== Analysis Complete ===');
  console.log(`Report saved to: ${reportPath}`);
  console.log(`Error tests: ${results.errorTests.length}`);
  console.log(`Header analysis: ${results.headerAnalysis.length}`);
  console.log(`Status code analysis: ${results.statusCodeAnalysis.length}`);
  console.log(`Prevention methods: ${results.preventionMethods.length}`);
  console.log(`501 prevention methods: ${prevention501.length}`);
}

main().catch(console.error);