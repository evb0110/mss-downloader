#!/usr/bin/env node

const https = require('https');
const http = require('http');

// Test URLs from validation
const testUrls = [
  'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
  'https://mdc.csuc.cat/digital/collection/incunableBC/id/49455/rec/2'
];

// Different page ID formats to test
const pageIdFormats = [
  '001', '1', 'page001', 'page1', 'p001', 'p1',
  '0001', 'img001', 'image001', 'folio001', 'f001'
];

// Collection alternatives to test
const collectionAlternatives = [
  'incunableBC', 'incunable', 'bc', 'manuscripts', 'digitalcollections'
];

function makeRequest(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          url,
          status: res.statusCode,
          headers: res.headers,
          body: data.substring(0, 2000), // First 2000 chars
          size: data.length
        });
      });
    });
    
    req.on('error', (err) => {
      resolve({
        url,
        status: 'ERROR',
        error: err.message
      });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        url,
        status: 'TIMEOUT'
      });
    });
  });
}

async function testPageIdFormats() {
  console.log('=== TESTING PAGE ID FORMATS ===');
  
  const baseIIIFUrl = 'https://mdc.csuc.cat/iiif/2/';
  const testId = '175331';
  
  for (const format of pageIdFormats) {
    const iiifUrl = `${baseIIIFUrl}incunableBC:${testId}:${format}/info.json`;
    const result = await makeRequest(iiifUrl);
    
    console.log(`Format: ${format.padEnd(8)} | Status: ${result.status} | URL: ${iiifUrl}`);
    
    if (result.status === 200) {
      console.log(`  SUCCESS! Working format found: ${format}`);
      console.log(`  Response preview: ${result.body.substring(0, 200)}...`);
    }
  }
}

async function testCollectionNames() {
  console.log('\n=== TESTING COLLECTION NAMES ===');
  
  const baseIIIFUrl = 'https://mdc.csuc.cat/iiif/2/';
  const testId = '175331';
  const testPage = '1';
  
  for (const collection of collectionAlternatives) {
    const iiifUrl = `${baseIIIFUrl}${collection}:${testId}:${testPage}/info.json`;
    const result = await makeRequest(iiifUrl);
    
    console.log(`Collection: ${collection.padEnd(15)} | Status: ${result.status} | URL: ${iiifUrl}`);
    
    if (result.status === 200) {
      console.log(`  SUCCESS! Working collection found: ${collection}`);
      console.log(`  Response preview: ${result.body.substring(0, 200)}...`);
    }
  }
}

async function analyzeValidationUrls() {
  console.log('\n=== ANALYZING VALIDATION URLS ===');
  
  for (const url of testUrls) {
    console.log(`\nAnalyzing: ${url}`);
    const result = await makeRequest(url);
    
    console.log(`Status: ${result.status}`);
    console.log(`Size: ${result.size} bytes`);
    
    if (result.body) {
      // Look for IIIF references in HTML
      const iiifMatches = result.body.match(/iiif[^"'\s]*/gi) || [];
      const imageMatches = result.body.match(/image[^"'\s]*/gi) || [];
      const manifestMatches = result.body.match(/manifest[^"'\s]*/gi) || [];
      
      console.log(`IIIF references found: ${iiifMatches.length}`);
      console.log(`Image references found: ${imageMatches.length}`);
      console.log(`Manifest references found: ${manifestMatches.length}`);
      
      if (iiifMatches.length > 0) {
        console.log(`Sample IIIF refs: ${iiifMatches.slice(0, 3).join(', ')}`);
      }
    }
  }
}

async function testAlternativeApis() {
  console.log('\n=== TESTING ALTERNATIVE APIs ===');
  
  const apiUrls = [
    'https://mdc.csuc.cat/api/collections/incunableBC',
    'https://mdc.csuc.cat/digital/api/collections/incunableBC',
    'https://mdc.csuc.cat/oai?verb=ListRecords&metadataPrefix=oai_dc&set=incunableBC',
    'https://mdc.csuc.cat/digital/collection/incunableBC/search',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/metadata',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331.json',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/compound'
  ];
  
  for (const url of apiUrls) {
    const result = await makeRequest(url);
    console.log(`API: ${url}`);
    console.log(`Status: ${result.status}`);
    
    if (result.status === 200 && result.body) {
      console.log(`  Content type appears to be: ${result.body.startsWith('{') ? 'JSON' : 'HTML/XML'}`);
      console.log(`  Preview: ${result.body.substring(0, 150)}...`);
    }
  }
}

async function main() {
  console.log('MDC CATALONIA PAGE DISCOVERY ANALYSIS');
  console.log('=====================================');
  
  await analyzeValidationUrls();
  await testPageIdFormats();
  await testCollectionNames();
  await testAlternativeApis();
  
  console.log('\n=== ANALYSIS COMPLETE ===');
}

main().catch(console.error);