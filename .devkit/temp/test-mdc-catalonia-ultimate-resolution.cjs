const https = require('https');
const fs = require('fs');
const path = require('path');

async function testUltimateResolution() {
  console.log('Testing ultimate resolution parameters for MDC Catalonia...');
  
  const baseUrl = 'https://mdc.csuc.cat/digital/iiif/2/incunableBC:174519';
  
  // Test even higher resolution parameters
  const testParams = [
    '/full/,2000/0/default.jpg',  // Already confirmed this works
    '/full/,3000/0/default.jpg',
    '/full/,4000/0/default.jpg',
    '/full/,5000/0/default.jpg',
    '/full/,6000/0/default.jpg',
    '/full/,8000/0/default.jpg',
    '/full/,10000/0/default.jpg',
    '/full/max/0/default.jpg',
    '/full/full/0/default.jpg'
  ];
  
  const results = [];
  
  for (const params of testParams) {
    const url = baseUrl + params;
    console.log(`Testing: ${url}`);
    
    const result = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = Buffer.alloc(0);
        
        res.on('data', (chunk) => {
          data = Buffer.concat([data, chunk]);
        });
        
        res.on('end', () => {
          const size = data.length;
          const contentType = res.headers['content-type'];
          
          console.log(`  Status: ${res.statusCode}, Size: ${size} bytes, Type: ${contentType}`);
          
          if (res.statusCode === 200 && contentType === 'image/jpeg') {
            const filename = `mdc-ultimate-${params.replace(/[\/,]/g, '_')}.jpg`;
            const filepath = path.join(__dirname, '..', 'validation-artifacts', 'MDC-CATALONIA', filename);
            fs.writeFileSync(filepath, data);
            console.log(`  ✓ Saved: ${filename}`);
            
            resolve({
              params,
              url,
              size,
              contentType,
              statusCode: res.statusCode,
              success: true,
              filename
            });
          } else {
            console.log(`  ✗ Failed: Status ${res.statusCode} or wrong content type`);
            resolve({
              params,
              url,
              size,
              contentType,
              statusCode: res.statusCode,
              success: false,
              error: `Status ${res.statusCode} or wrong content type`
            });
          }
        });
      }).on('error', (err) => {
        console.log(`  ✗ Error: ${err.message}`);
        resolve({
          params,
          url,
          success: false,
          error: err.message
        });
      });
    });
    
    results.push(result);
  }
  
  // Sort successful results by size
  const successful = results.filter(r => r.success);
  successful.sort((a, b) => b.size - a.size);
  
  console.log('\n=== ULTIMATE RESOLUTION TEST RESULTS ===');
  console.log('Successful downloads (sorted by size):');
  successful.forEach((result, index) => {
    console.log(`${index + 1}. ${result.params}`);
    console.log(`   Size: ${result.size} bytes (${(result.size / 1024).toFixed(1)} KB)`);
    console.log(`   File: ${result.filename}`);
  });
  
  if (successful.length > 0) {
    const best = successful[0];
    console.log(`\nABSOLUTE MAXIMUM RESOLUTION FOUND:`);
    console.log(`Parameters: ${best.params}`);
    console.log(`Size: ${best.size} bytes (${(best.size / 1024).toFixed(1)} KB)`);
    console.log(`File: ${best.filename}`);
  }
  
  // Save detailed results
  const reportPath = path.join(__dirname, '..', 'reports', 'mdc-catalonia-ultimate-resolution-test.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    testDate: new Date().toISOString(),
    baseUrl,
    results: results.map(r => ({
      params: r.params,
      size: r.size,
      success: r.success,
      error: r.error
    }))
  }, null, 2));
  
  console.log(`\nResults saved to: ${reportPath}`);
}

testUltimateResolution().catch(console.error);