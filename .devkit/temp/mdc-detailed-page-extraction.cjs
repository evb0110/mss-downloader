#!/usr/bin/env node

const https = require('https');
const { JSDOM } = require('jsdom');

const testUrls = [
  'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
  'https://mdc.csuc.cat/digital/collection/incunableBC/id/49455/rec/2'
];

function makeRequest(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
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
          body: data
        });
      });
    });
    
    req.on('error', (err) => {
      resolve({ url, status: 'ERROR', error: err.message });
    });
    
    req.setTimeout(15000, () => {
      req.destroy();
      resolve({ url, status: 'TIMEOUT' });
    });
  });
}

function extractIIIFReferences(html) {
  const iiifRefs = [];
  
  // Extract all IIIF URLs from various contexts
  const patterns = [
    /iiif\/2\/[^"'\s]+/gi,
    /https?:\/\/[^\/]+\/iiif\/2\/[^"'\s]+/gi,
    /"(iiif[^"]+)"/gi,
    /'(iiif[^']+)'/gi,
    /incunableBC:[0-9]+/gi
  ];
  
  patterns.forEach(pattern => {
    const matches = html.match(pattern) || [];
    iiifRefs.push(...matches);
  });
  
  return [...new Set(iiifRefs)]; // Remove duplicates
}

function extractPageStructure(html) {
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Look for pagination or page navigation elements
    const pageElements = [];
    
    // Check for specific elements that might contain page info
    const selectors = [
      'img[src*="iiif"]',
      '[data-page]',
      '.page',
      '.leaf',
      '.folio',
      'a[href*="/rec/"]',
      'button[data-page]',
      '.pagination',
      '.viewer'
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        pageElements.push({
          selector,
          tag: el.tagName,
          src: el.src || '',
          href: el.href || '',
          dataPage: el.getAttribute('data-page') || '',
          textContent: el.textContent?.trim().substring(0, 100) || '',
          outerHTML: el.outerHTML.substring(0, 200)
        });
      });
    });
    
    return pageElements;
  } catch (err) {
    return [];
  }
}

async function testDirectIIIFIds() {
  console.log('\n=== TESTING DIRECT IIIF IDs FOUND IN HTML ===');
  
  // Test the IDs we found: 174519, 49125
  const foundIds = ['174519', '49125'];
  
  for (const id of foundIds) {
    const iiifUrl = `https://mdc.csuc.cat/iiif/2/incunableBC:${id}/info.json`;
    const result = await makeRequest(iiifUrl);
    
    console.log(`ID: ${id} | Status: ${result.status} | URL: ${iiifUrl}`);
    
    if (result.status === 200) {
      console.log(`  SUCCESS! Working ID found: ${id}`);
      console.log(`  Response preview: ${result.body.substring(0, 300)}...`);
      
      // Test image URL
      const imageUrl = `https://mdc.csuc.cat/iiif/2/incunableBC:${id}/full/max/0/default.jpg`;
      const imageResult = await makeRequest(imageUrl);
      console.log(`  Image URL test: ${imageResult.status} (${imageUrl})`);
    }
  }
}

async function analyzeCompoundStructure() {
  console.log('\n=== ANALYZING COMPOUND STRUCTURE ===');
  
  // Test compound object URLs
  const compoundUrls = [
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/compound',
    'https://mdc.csuc.cat/digital/api/collections/incunableBC/items/175331',
    'https://mdc.csuc.cat/digital/api/collections/incunableBC/items/175331/pages'
  ];
  
  for (const url of compoundUrls) {
    const result = await makeRequest(url);
    console.log(`\nCompound URL: ${url}`);
    console.log(`Status: ${result.status}`);
    
    if (result.status === 200 && result.body) {
      console.log(`Content preview: ${result.body.substring(0, 300)}...`);
      
      // Try to parse as JSON if it looks like JSON
      if (result.body.trim().startsWith('{') || result.body.trim().startsWith('[')) {
        try {
          const data = JSON.parse(result.body);
          console.log(`  Parsed JSON keys: ${Object.keys(data).join(', ')}`);
        } catch (e) {
          console.log(`  JSON parse failed: ${e.message}`);
        }
      }
    }
  }
}

async function main() {
  console.log('MDC DETAILED PAGE EXTRACTION ANALYSIS');
  console.log('====================================');
  
  for (const url of testUrls) {
    console.log(`\n=== ANALYZING: ${url} ===`);
    
    const result = await makeRequest(url);
    if (result.status === 200 && result.body) {
      
      console.log('\n--- IIIF References ---');
      const iiifRefs = extractIIIFReferences(result.body);
      iiifRefs.forEach((ref, index) => {
        console.log(`${index + 1}. ${ref}`);
      });
      
      console.log('\n--- Page Structure Elements ---');
      const pageElements = extractPageStructure(result.body);
      pageElements.forEach((el, index) => {
        console.log(`${index + 1}. ${el.selector} - ${el.tag}`);
        if (el.src) console.log(`   src: ${el.src}`);
        if (el.href) console.log(`   href: ${el.href}`);
        if (el.dataPage) console.log(`   data-page: ${el.dataPage}`);
        if (el.textContent) console.log(`   text: ${el.textContent}`);
      });
    }
  }
  
  await testDirectIIIFIds();
  await analyzeCompoundStructure();
  
  console.log('\n=== ANALYSIS COMPLETE ===');
}

main().catch(console.error);