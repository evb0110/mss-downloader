#!/usr/bin/env node

const https = require('https');
const { JSDOM } = require('jsdom');

function makeRequest(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/html, */*'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          url,
          status: res.statusCode,
          headers: res.headers,
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

async function discoverMetadataAPIs() {
  console.log('=== DISCOVERING METADATA APIs ===');
  
  const testId = '175331';
  const apis = [
    // CONTENTdm APIs
    `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmQuery/incunableBC/${testId}/title!dmoclcno!dmcreated!dmmodified!dmaccess!dmimage!dmoclcno!dmcreated!dmmodified!dmaccess!dmimage/title/1024/0/0/0/0/1/json`,
    `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetItemInfo/incunableBC/${testId}/json`,
    `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/incunableBC/${testId}/json`,
    `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=GetParent/incunableBC/${testId}/json`,
    
    // Direct API endpoints
    `https://mdc.csuc.cat/digital/api/items/${testId}`,
    `https://mdc.csuc.cat/digital/api/collections/incunableBC/items/${testId}`,
    `https://mdc.csuc.cat/digital/api/collections/incunableBC/items/${testId}/pages`,
    `https://mdc.csuc.cat/digital/api/collections/incunableBC/items/${testId}/metadata`,
    
    // IIIF Manifest endpoints
    `https://mdc.csuc.cat/iiif/info/incunableBC/${testId}/manifest.json`,
    `https://mdc.csuc.cat/iiif/2/incunableBC:${testId}/manifest.json`,
    `https://mdc.csuc.cat/iiif/collection/incunableBC/${testId}/manifest.json`,
    
    // Search/discovery endpoints
    `https://mdc.csuc.cat/digital/api/search?q=*&fq[]=OCLC!175331`,
    `https://mdc.csuc.cat/digital/api/search?q=*&fq[]=dmrecord!${testId}`,
  ];
  
  for (const url of apis) {
    const result = await makeRequest(url);
    console.log(`\nAPI: ${url}`);
    console.log(`Status: ${result.status}`);
    
    if (result.status === 200) {
      console.log(`Content Type: ${result.headers['content-type'] || 'unknown'}`);
      console.log(`Size: ${result.body.length} bytes`);
      
      // Check if it's JSON
      if (result.body.trim().startsWith('{') || result.body.trim().startsWith('[')) {
        try {
          const data = JSON.parse(result.body);
          console.log(`JSON Keys: ${Object.keys(data).slice(0, 10).join(', ')}`);
          
          // Look for page references
          const jsonStr = JSON.stringify(data, null, 2);
          const pageMatches = jsonStr.match(/["']?page["']?\s*:\s*["']?[^,"'}]+/gi) || [];
          const idMatches = jsonStr.match(/["']?id["']?\s*:\s*["']?[0-9]+/gi) || [];
          const iiifMatches = jsonStr.match(/iiif[^"',}]+/gi) || [];
          
          if (pageMatches.length > 0) {
            console.log(`  Page references: ${pageMatches.slice(0, 3).join(', ')}`);
          }
          if (idMatches.length > 0) {
            console.log(`  ID references: ${idMatches.slice(0, 5).join(', ')}`);
          }
          if (iiifMatches.length > 0) {
            console.log(`  IIIF references: ${iiifMatches.slice(0, 3).join(', ')}`);
          }
          
        } catch (e) {
          console.log(`JSON parse failed: ${e.message}`);
          console.log(`Content preview: ${result.body.substring(0, 200)}...`);
        }
      } else {
        console.log(`Content preview: ${result.body.substring(0, 200)}...`);
      }
    }
  }
}

async function analyzeRecordPages() {
  console.log('\n=== ANALYZING RECORD PAGES FOR NAVIGATION ===');
  
  const baseUrl = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331';
  const recordUrls = [];
  
  // Test multiple rec numbers
  for (let i = 1; i <= 10; i++) {
    recordUrls.push(`${baseUrl}/rec/${i}`);
  }
  
  const navigationData = [];
  
  for (const url of recordUrls) {
    const result = await makeRequest(url);
    console.log(`\nRecord ${url.split('/rec/')[1]}: Status ${result.status}`);
    
    if (result.status === 200) {
      // Extract IIIF ID from this page
      const iiifMatches = result.body.match(/iiif\/2\/incunableBC:([0-9]+)/);
      if (iiifMatches) {
        const iiifId = iiifMatches[1];
        console.log(`  IIIF ID: ${iiifId}`);
        
        // Test the IIIF endpoint
        const iiifUrl = `https://mdc.csuc.cat/iiif/2/incunableBC:${iiifId}/info.json`;
        const iiifResult = await makeRequest(iiifUrl);
        console.log(`  IIIF Status: ${iiifResult.status}`);
        
        if (iiifResult.status === 200) {
          try {
            const iiifData = JSON.parse(iiifResult.body);
            console.log(`  Image Size: ${iiifData.width}x${iiifData.height}`);
            
            navigationData.push({
              recordNumber: url.split('/rec/')[1],
              iiifId: iiifId,
              width: iiifData.width,
              height: iiifData.height,
              working: true
            });
          } catch (e) {
            console.log(`  IIIF JSON parse failed`);
          }
        }
      } else {
        console.log(`  No IIIF ID found`);
      }
    }
  }
  
  return navigationData;
}

async function testDifferentItems() {
  console.log('\n=== TESTING DIFFERENT ITEMS ===');
  
  const testItems = ['49455', '175331', '123456', '100000'];
  
  for (const itemId of testItems) {
    console.log(`\nTesting item: ${itemId}`);
    
    // Test first record page
    const recordUrl = `https://mdc.csuc.cat/digital/collection/incunableBC/id/${itemId}/rec/1`;
    const result = await makeRequest(recordUrl);
    
    console.log(`Record page status: ${result.status}`);
    
    if (result.status === 200) {
      const iiifMatches = result.body.match(/iiif\/2\/incunableBC:([0-9]+)/);
      if (iiifMatches) {
        console.log(`  Found IIIF ID: ${iiifMatches[1]}`);
      }
      
      // Look for total pages indication
      const totalMatches = result.body.match(/of\s+([0-9]+)/i) || result.body.match(/total[^0-9]*([0-9]+)/i);
      if (totalMatches) {
        console.log(`  Possible total pages: ${totalMatches[1]}`);
      }
    }
  }
}

async function main() {
  console.log('MDC API DISCOVERY AND PAGE MAPPING');
  console.log('==================================');
  
  await discoverMetadataAPIs();
  
  const navigationData = await analyzeRecordPages();
  
  await testDifferentItems();
  
  console.log('\n=== FINAL NAVIGATION MAPPING ===');
  console.log(JSON.stringify(navigationData, null, 2));
  
  console.log('\n=== ANALYSIS COMPLETE ===');
}

main().catch(console.error);