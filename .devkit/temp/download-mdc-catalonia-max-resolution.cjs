const https = require('https');
const fs = require('fs');
const path = require('path');

async function downloadMaxResolution() {
  console.log('Downloading MDC Catalonia maximum resolution image...');
  
  // Based on the test results, the best resolution was from the IIIF v2 endpoint
  const maxResolutionUrl = 'https://mdc.csuc.cat/digital/iiif/2/incunableBC:174519/full/,2000/0/default.jpg';
  const fullResolutionUrl = 'https://mdc.csuc.cat/digital/iiif/2/incunableBC:174519/full/full/0/default.jpg';
  
  const urls = [
    { url: maxResolutionUrl, name: 'max-resolution-,2000' },
    { url: fullResolutionUrl, name: 'full-resolution' }
  ];
  
  for (const { url, name } of urls) {
    console.log(`Downloading ${name}: ${url}`);
    
    const result = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = Buffer.alloc(0);
        
        res.on('data', (chunk) => {
          data = Buffer.concat([data, chunk]);
        });
        
        res.on('end', () => {
          const size = data.length;
          console.log(`  Status: ${res.statusCode}, Size: ${size} bytes`);
          console.log(`  Content-Type: ${res.headers['content-type']}`);
          
          if (res.statusCode === 200 && res.headers['content-type'] === 'image/jpeg') {
            const filename = `mdc-catalonia-${name}.jpg`;
            const filepath = path.join(__dirname, '..', 'validation-artifacts', 'MDC-CATALONIA', filename);
            fs.mkdirSync(path.dirname(filepath), { recursive: true });
            fs.writeFileSync(filepath, data);
            console.log(`  Saved: ${filename}`);
            
            resolve({
              success: true,
              url,
              filename,
              size,
              contentType: res.headers['content-type']
            });
          } else {
            console.log(`  Failed: Not a valid JPEG`);
            resolve({
              success: false,
              url,
              error: `Status ${res.statusCode} or wrong content type`
            });
          }
        });
      }).on('error', (err) => {
        console.log(`  Error: ${err.message}`);
        resolve({
          success: false,
          url,
          error: err.message
        });
      });
    });
    
    if (result.success) {
      console.log(`✓ Successfully downloaded ${result.filename} (${result.size} bytes)`);
    } else {
      console.log(`✗ Failed to download: ${result.error}`);
    }
  }
}

downloadMaxResolution().catch(console.error);