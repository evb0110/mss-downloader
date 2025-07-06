#!/usr/bin/env node

const https = require('https');

function makeRequest(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json'
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

async function analyzeCompoundStructure(itemId) {
  console.log(`\n=== ANALYZING COMPOUND STRUCTURE FOR ITEM ${itemId} ===`);
  
  const compoundUrl = `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/incunableBC/${itemId}/json`;
  
  const result = await makeRequest(compoundUrl);
  
  if (result.status === 200) {
    try {
      const data = JSON.parse(result.body);
      
      console.log(`Compound object type: ${data.type}`);
      console.log(`Number of pages: ${data.page ? data.page.length : 'N/A'}`);
      
      if (data.page && Array.isArray(data.page)) {
        console.log('\nPage structure:');
        
        const pages = [];
        
        data.page.forEach((page, index) => {
          console.log(`\nPage ${index + 1}:`);
          console.log(`  pageptr: ${page.pageptr}`);
          console.log(`  pagefile: ${page.pagefile || 'N/A'}`);
          console.log(`  pagetitle: ${page.pagetitle || 'N/A'}`);
          
          if (page.pageptr) {
            pages.push({
              index: index + 1,
              pageptr: page.pageptr,
              pagefile: page.pagefile,
              pagetitle: page.pagetitle,
              iiifId: `incunableBC:${page.pageptr}`,
              iiifUrl: `https://mdc.csuc.cat/iiif/2/incunableBC:${page.pageptr}/info.json`,
              imageUrl: `https://mdc.csuc.cat/iiif/2/incunableBC:${page.pageptr}/full/max/0/default.jpg`
            });
          }
        });
        
        console.log(`\n=== TESTING IIIF ENDPOINTS FOR ALL PAGES ===`);
        
        const workingPages = [];
        
        for (const page of pages.slice(0, 5)) { // Test first 5 pages
          const iiifResult = await makeRequest(page.iiifUrl);
          console.log(`Page ${page.index} (ID: ${page.pageptr}): IIIF Status ${iiifResult.status}`);
          
          if (iiifResult.status === 200) {
            try {
              const iiifData = JSON.parse(iiifResult.body);
              console.log(`  Dimensions: ${iiifData.width}x${iiifData.height}`);
              page.width = iiifData.width;
              page.height = iiifData.height;
              page.working = true;
              workingPages.push(page);
            } catch (e) {
              console.log(`  IIIF JSON parse failed`);
              page.working = false;
            }
          } else {
            page.working = false;
          }
        }
        
        return {
          itemId,
          totalPages: pages.length,
          pages: pages,
          workingPages: workingPages
        };
        
      } else {
        console.log('No page structure found');
        return { itemId, error: 'No page structure' };
      }
      
    } catch (e) {
      console.log(`JSON parse failed: ${e.message}`);
      return { itemId, error: 'JSON parse failed' };
    }
  } else {
    console.log(`Compound API failed: Status ${result.status}`);
    return { itemId, error: `API status ${result.status}` };
  }
}

async function testImplementation(itemId, maxPages = 3) {
  console.log(`\n=== TESTING IMPLEMENTATION FOR ${itemId} ===`);
  
  const compoundUrl = `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/incunableBC/${itemId}/json`;
  const result = await makeRequest(compoundUrl);
  
  if (result.status === 200) {
    try {
      const data = JSON.parse(result.body);
      
      if (data.page && Array.isArray(data.page)) {
        console.log(`Found ${data.page.length} pages`);
        
        const testPages = data.page.slice(0, maxPages);
        
        for (let i = 0; i < testPages.length; i++) {
          const page = testPages[i];
          const iiifId = page.pageptr;
          
          console.log(`\nTesting Page ${i + 1} (IIIF ID: ${iiifId}):`);
          
          // Test info.json
          const infoUrl = `https://mdc.csuc.cat/iiif/2/incunableBC:${iiifId}/info.json`;
          const infoResult = await makeRequest(infoUrl);
          console.log(`  Info.json: ${infoResult.status}`);
          
          if (infoResult.status === 200) {
            const iiifData = JSON.parse(infoResult.body);
            console.log(`  Dimensions: ${iiifData.width}x${iiifData.height}`);
            
            // Test max resolution
            const maxUrl = `https://mdc.csuc.cat/iiif/2/incunableBC:${iiifId}/full/max/0/default.jpg`;
            const maxResult = await makeRequest(maxUrl);
            console.log(`  Max image: ${maxResult.status} (${maxResult.body ? maxResult.body.length : 0} bytes)`);
            
            // Test full/full resolution
            const fullUrl = `https://mdc.csuc.cat/iiif/2/incunableBC:${iiifId}/full/full/0/default.jpg`;
            const fullResult = await makeRequest(fullUrl);
            console.log(`  Full image: ${fullResult.status} (${fullResult.body ? fullResult.body.length : 0} bytes)`);
          }
        }
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
}

async function main() {
  console.log('MDC COMPOUND OBJECT ANALYSIS');
  console.log('============================');
  
  // Test our known working items
  const testItems = ['175331', '49455'];
  
  const results = {};
  
  for (const itemId of testItems) {
    const analysis = await analyzeCompoundStructure(itemId);
    results[itemId] = analysis;
    
    // Test implementation
    await testImplementation(itemId, 3);
  }
  
  console.log('\n=== FINAL RESULTS SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);