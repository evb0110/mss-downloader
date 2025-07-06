/**
 * Agent 2: MDC Catalonia API Response Parser
 * Deep analysis of JSON responses and page structure
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const results = {
  timestamp: new Date().toISOString(),
  apiResponses: [],
  pageStructures: [],
  metadataAnalysis: [],
  navigationPatterns: [],
  findings: []
};

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Referer': 'https://mdc.csuc.cat/'
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

async function parseApiResponse(url) {
  console.log(`\n=== Parsing API Response: ${url} ===`);
  
  try {
    const response = await makeRequest(url);
    
    let jsonData = null;
    let htmlData = null;
    
    // Try to parse as JSON first
    try {
      jsonData = JSON.parse(response.body);
    } catch (e) {
      // If not JSON, parse as HTML
      htmlData = response.body;
    }
    
    const analysis = {
      url: url,
      statusCode: response.statusCode,
      contentType: response.headers['content-type'],
      isJson: jsonData !== null,
      isHtml: htmlData !== null,
      bodySize: response.body.length
    };
    
    if (jsonData) {
      analysis.jsonStructure = analyzeJsonStructure(jsonData);
    }
    
    if (htmlData) {
      analysis.htmlStructure = analyzeHtmlStructure(htmlData);
    }
    
    results.apiResponses.push(analysis);
    
    console.log(`Status: ${response.statusCode}`);
    console.log(`Content-Type: ${response.headers['content-type']}`);
    console.log(`Is JSON: ${analysis.isJson}`);
    console.log(`Body size: ${analysis.bodySize} bytes`);
    
    return analysis;
    
  } catch (error) {
    console.error(`Error parsing ${url}:`, error.message);
    results.apiResponses.push({
      url: url,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    return null;
  }
}

function analyzeJsonStructure(jsonData) {
  const structure = {
    topLevelKeys: Object.keys(jsonData),
    hasPageInfo: false,
    hasImageInfo: false,
    hasMetadata: false,
    pageCount: null,
    imageUrls: [],
    navigationInfo: {}
  };
  
  // Look for page-related information
  const pageKeys = ['page', 'pages', 'pagenum', 'pagecount', 'total_pages', 'numPages'];
  for (const key of pageKeys) {
    if (jsonData[key] !== undefined) {
      structure.hasPageInfo = true;
      structure.pageCount = jsonData[key];
      break;
    }
  }
  
  // Look for image-related information
  const imageKeys = ['image', 'images', 'thumbnail', 'fullsize', 'iiif', 'src'];
  for (const key of imageKeys) {
    if (jsonData[key] !== undefined) {
      structure.hasImageInfo = true;
      if (typeof jsonData[key] === 'string') {
        structure.imageUrls.push(jsonData[key]);
      }
    }
  }
  
  // Look for metadata
  const metadataKeys = ['title', 'description', 'metadata', 'collection', 'id'];
  for (const key of metadataKeys) {
    if (jsonData[key] !== undefined) {
      structure.hasMetadata = true;
    }
  }
  
  // Look for navigation information
  const navKeys = ['next', 'previous', 'prev', 'first', 'last', 'navigation'];
  for (const key of navKeys) {
    if (jsonData[key] !== undefined) {
      structure.navigationInfo[key] = jsonData[key];
    }
  }
  
  return structure;
}

function analyzeHtmlStructure(htmlData) {
  const structure = {
    hasMetaTags: htmlData.includes('<meta'),
    hasScriptTags: htmlData.includes('<script'),
    hasJsonLD: htmlData.includes('"@type"'),
    hasIIIFManifest: htmlData.includes('manifest'),
    extractedData: {}
  };
  
  // Extract JSON-LD data
  const jsonLdMatch = htmlData.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
  if (jsonLdMatch) {
    try {
      structure.extractedData.jsonLD = JSON.parse(jsonLdMatch[1]);
    } catch (e) {
      structure.extractedData.jsonLD = 'parse_error';
    }
  }
  
  // Extract JavaScript variables
  const jsVarMatches = htmlData.match(/var\s+(\w+)\s*=\s*(\{[^}]*\}|\[[^\]]*\]|"[^"]*"|'[^']*'|\d+)/g);
  if (jsVarMatches) {
    structure.extractedData.jsVariables = jsVarMatches.slice(0, 10); // First 10 matches
  }
  
  // Look for image URLs
  const imageUrls = [];
  const imgMatches = htmlData.match(/src="([^"]*\.(jpg|jpeg|png|gif|webp))"/gi);
  if (imgMatches) {
    imgMatches.forEach(match => {
      const url = match.match(/src="([^"]*)"/i)[1];
      if (url && !url.startsWith('data:')) {
        imageUrls.push(url);
      }
    });
  }
  structure.extractedData.imageUrls = [...new Set(imageUrls)].slice(0, 10);
  
  // Look for API calls in JavaScript
  const apiCallMatches = htmlData.match(/fetch\s*\(\s*["']([^"']+)["']/g);
  if (apiCallMatches) {
    structure.extractedData.apiCalls = apiCallMatches.map(match => 
      match.match(/fetch\s*\(\s*["']([^"']+)["']/)[1]
    );
  }
  
  return structure;
}

async function discoverPageStructure(baseId) {
  console.log(`\n=== Discovering Page Structure for ID: ${baseId} ===`);
  
  const baseUrl = `https://mdc.csuc.cat/digital/collection/incunableBC/id/${baseId}`;
  
  // Test multiple page structures
  const pageStructures = [
    { pattern: '/rec/{n}', pages: [1, 2, 3, 4, 5] },
    { pattern: '/page/{n}', pages: [1, 2, 3, 4, 5] },
    { pattern: '?page={n}', pages: [1, 2, 3, 4, 5] },
    { pattern: '?p={n}', pages: [1, 2, 3, 4, 5] }
  ];
  
  for (const structure of pageStructures) {
    console.log(`Testing structure: ${structure.pattern}`);
    
    const structureResults = {
      pattern: structure.pattern,
      workingPages: [],
      failedPages: [],
      pageData: []
    };
    
    for (const pageNum of structure.pages) {
      let testUrl;
      if (structure.pattern.includes('?')) {
        testUrl = `${baseUrl}${structure.pattern.replace('{n}', pageNum)}`;
      } else {
        testUrl = `${baseUrl}${structure.pattern.replace('{n}', pageNum)}`;
      }
      
      try {
        const response = await makeRequest(testUrl);
        
        if (response.statusCode === 200) {
          structureResults.workingPages.push(pageNum);
          
          // Extract page-specific data
          const pageData = {
            pageNumber: pageNum,
            url: testUrl,
            statusCode: response.statusCode,
            bodySize: response.body.length,
            hasUniqueContent: false
          };
          
          // Check for unique content indicators
          if (response.body.includes(`Page ${pageNum}`) || 
              response.body.includes(`page ${pageNum}`) ||
              response.body.includes(`rec ${pageNum}`)) {
            pageData.hasUniqueContent = true;
          }
          
          structureResults.pageData.push(pageData);
          console.log(`✓ Page ${pageNum}: ${response.statusCode}`);
        } else {
          structureResults.failedPages.push(pageNum);
          console.log(`✗ Page ${pageNum}: ${response.statusCode}`);
        }
      } catch (error) {
        structureResults.failedPages.push(pageNum);
        console.log(`✗ Page ${pageNum}: ${error.message}`);
      }
    }
    
    results.pageStructures.push(structureResults);
  }
}

async function analyzeMetadataPatterns() {
  console.log(`\n=== Analyzing Metadata Patterns ===`);
  
  const testIds = ['175331', '49455', '14914'];
  
  for (const testId of testIds) {
    console.log(`Analyzing metadata for ID: ${testId}`);
    
    const metadataUrls = [
      `https://mdc.csuc.cat/digital/collection/incunableBC/id/${testId}/rec/1`,
      `https://mdc.csuc.cat/digital/api/singleitem/collection/incunableBC/id/${testId}/rec/1`,
      `https://mdc.csuc.cat/digital/collection/incunableBC/id/${testId}/metadata`,
      `https://mdc.csuc.cat/digital/collection/incunableBC/id/${testId}/info.json`,
      `https://mdc.csuc.cat/digital/collection/incunableBC/id/${testId}/manifest.json`
    ];
    
    for (const url of metadataUrls) {
      try {
        const response = await makeRequest(url);
        
        const metadataInfo = {
          id: testId,
          url: url,
          statusCode: response.statusCode,
          contentType: response.headers['content-type'],
          hasMetadata: false,
          extractedMetadata: {}
        };
        
        // Try to extract metadata
        if (response.headers['content-type']?.includes('json')) {
          try {
            const jsonData = JSON.parse(response.body);
            metadataInfo.hasMetadata = true;
            metadataInfo.extractedMetadata = jsonData;
          } catch (e) {
            // Not valid JSON
          }
        } else {
          // Extract from HTML
          const titleMatch = response.body.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) {
            metadataInfo.extractedMetadata.title = titleMatch[1];
            metadataInfo.hasMetadata = true;
          }
        }
        
        results.metadataAnalysis.push(metadataInfo);
        
        console.log(`${url}: ${response.statusCode} - ${metadataInfo.hasMetadata ? 'Has metadata' : 'No metadata'}`);
        
      } catch (error) {
        console.log(`✗ ${url}: ${error.message}`);
      }
    }
  }
}

async function main() {
  console.log('=== MDC Catalonia API Response Parser ===');
  
  const testUrls = [
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/49455/rec/2',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/14914/rec/1'
  ];
  
  // Parse each test URL
  for (const url of testUrls) {
    await parseApiResponse(url);
  }
  
  // Discover page structures
  await discoverPageStructure('175331');
  await discoverPageStructure('49455');
  
  // Analyze metadata patterns
  await analyzeMetadataPatterns();
  
  // Save results
  const reportPath = path.join(__dirname, '../reports/mdc-api-response-analysis.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  
  console.log('\n=== Analysis Complete ===');
  console.log(`Report saved to: ${reportPath}`);
  console.log(`API responses analyzed: ${results.apiResponses.length}`);
  console.log(`Page structures tested: ${results.pageStructures.length}`);
  console.log(`Metadata patterns analyzed: ${results.metadataAnalysis.length}`);
}

main().catch(console.error);