const https = require('https');
const fs = require('fs');
const path = require('path');

const testUrl = 'https://mdc.csuc.cat/digital/api/singleitem/collection/incunableBC/id/174519';
const testParams = [
  '/full/full/0/default.jpg',
  '/full/max/0/default.jpg',
  '/full/2000,/0/default.jpg',
  '/full/4000,/0/default.jpg',
  '/full/,2000/0/default.jpg',
  '/full/,4000/0/default.jpg',
  '/full/9999,/0/default.jpg',
  '/full/,9999/0/default.jpg'
];

async function testResolution(baseUrl, params) {
  return new Promise((resolve, reject) => {
    const url = baseUrl + params;
    console.log(`Testing: ${url}`);
    
    const req = https.get(url, (res) => {
      let data = Buffer.alloc(0);
      
      res.on('data', (chunk) => {
        data = Buffer.concat([data, chunk]);
      });
      
      res.on('end', () => {
        const size = data.length;
        console.log(`  Status: ${res.statusCode}, Size: ${size} bytes`);
        
        if (res.statusCode === 200 && size > 1000) {
          resolve({
            params,
            size,
            statusCode: res.statusCode,
            contentType: res.headers['content-type'],
            data
          });
        } else {
          resolve({
            params,
            size,
            statusCode: res.statusCode,
            contentType: res.headers['content-type'],
            error: `Small file or error: ${size} bytes`
          });
        }
      });
    });
    
    req.on('error', (err) => {
      console.log(`  Error: ${err.message}`);
      resolve({
        params,
        error: err.message,
        statusCode: 0,
        size: 0
      });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        params,
        error: 'Timeout',
        statusCode: 0,
        size: 0
      });
    });
  });
}

async function findMaxResolution() {
  console.log('MANDATORY MAXIMUM RESOLUTION TESTING FOR MDC CATALONIA');
  console.log('Testing different IIIF parameters...\n');
  
  // First, let's get the manifest to understand the structure
  const manifestUrl = 'https://mdc.csuc.cat/digital/api/singleitem/collection/incunableBC/id/174519';
  console.log('Fetching manifest from:', manifestUrl);
  
  try {
    const manifestResponse = await new Promise((resolve, reject) => {
      https.get(manifestUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ data, statusCode: res.statusCode }));
      }).on('error', reject);
    });
    
    console.log('Manifest response status:', manifestResponse.statusCode);
    console.log('Manifest response preview:', manifestResponse.data.substring(0, 500));
    
    // Try to parse as JSON
    let manifest;
    try {
      manifest = JSON.parse(manifestResponse.data);
      console.log('Manifest parsed successfully');
      console.log('Manifest keys:', Object.keys(manifest));
    } catch (e) {
      console.log('Failed to parse manifest as JSON:', e.message);
    }
    
    // Now test different IIIF image URLs
    // Let's try to construct the base image URL
    const possibleBaseUrls = [
      'https://mdc.csuc.cat/digital/api/singleitem/collection/incunableBC/id/174519/image',
      'https://mdc.csuc.cat/digital/iiif/incunableBC:174519',
      'https://mdc.csuc.cat/digital/iiif/2/incunableBC:174519',
      'https://mdc.csuc.cat/digital/api/collection/incunableBC/id/174519/image',
      'https://mdc.csuc.cat/digital/collection/incunableBC/id/174519/image'
    ];
    
    const results = [];
    
    for (const baseUrl of possibleBaseUrls) {
      console.log(`\nTesting base URL: ${baseUrl}`);
      
      for (const params of testParams) {
        const result = await testResolution(baseUrl, params);
        result.baseUrl = baseUrl;
        results.push(result);
        
        // If we get a good result, save it
        if (result.size > 10000 && result.statusCode === 200) {
          const filename = `mdc-catalonia-${params.replace(/[\/,]/g, '_')}.jpg`;
          const filepath = path.join(__dirname, '..', 'validation-artifacts', filename);
          fs.mkdirSync(path.dirname(filepath), { recursive: true });
          fs.writeFileSync(filepath, result.data);
          console.log(`  Saved successful image: ${filename}`);
        }
      }
    }
    
    // Sort by size to find the largest
    const successful = results.filter(r => r.size > 10000 && r.statusCode === 200);
    successful.sort((a, b) => b.size - a.size);
    
    console.log('\n=== RESOLUTION TEST RESULTS ===');
    console.log('Successful downloads (sorted by size):');
    successful.forEach((result, index) => {
      console.log(`${index + 1}. ${result.baseUrl}${result.params}`);
      console.log(`   Size: ${result.size} bytes (${(result.size / 1024).toFixed(1)} KB)`);
      console.log(`   Content-Type: ${result.contentType}`);
    });
    
    if (successful.length === 0) {
      console.log('No successful downloads found!');
      console.log('\nAll failed attempts:');
      results.forEach(result => {
        console.log(`${result.baseUrl}${result.params}: ${result.error || 'Status ' + result.statusCode}`);
      });
    } else {
      const best = successful[0];
      console.log(`\nBEST RESOLUTION FOUND:`);
      console.log(`URL: ${best.baseUrl}${best.params}`);
      console.log(`Size: ${best.size} bytes (${(best.size / 1024).toFixed(1)} KB)`);
    }
    
    // Save results to file
    const reportPath = path.join(__dirname, '..', 'reports', 'mdc-catalonia-resolution-test.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({
      testDate: new Date().toISOString(),
      successful: successful.map(r => ({
        url: r.baseUrl + r.params,
        size: r.size,
        contentType: r.contentType
      })),
      failed: results.filter(r => r.size <= 10000 || r.statusCode !== 200).map(r => ({
        url: r.baseUrl + r.params,
        error: r.error || 'Status ' + r.statusCode,
        size: r.size
      }))
    }, null, 2));
    
    console.log(`\nDetailed results saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('Error during testing:', error);
  }
}

findMaxResolution().catch(console.error);