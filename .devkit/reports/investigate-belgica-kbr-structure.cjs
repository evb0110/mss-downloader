const fs = require('fs');
const https = require('https');
const { URL } = require('url');

const TEST_URL = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';

async function investigateBelgicaStructure() {
  console.log('=== INVESTIGATING BELGICA KBR STRUCTURE ===');
  console.log(`Test URL: ${TEST_URL}`);
  console.log(`Test Time: ${new Date().toISOString()}`);
  console.log('');

  // Step 1: Fetch the document page
  console.log('--- Step 1: Fetching Document Page ---');
  try {
    const response = await fetch(TEST_URL);
    const html = await response.text();
    
    console.log(`HTTP Status: ${response.status}`);
    console.log(`Content Length: ${html.length} characters`);
    
    // Save the HTML for analysis
    const htmlFile = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/belgica-document-page.html';
    fs.writeFileSync(htmlFile, html);
    console.log(`HTML saved to: ${htmlFile}`);
    
    // Look for zoomtiles or viewer patterns
    const zoomTileMatches = html.match(/zoomtiles[^"']*/gi) || [];
    const viewerMatches = html.match(/viewerd\\.kbr\\.be[^"']*/gi) || [];
    const ajaxZoomMatches = html.match(/ajaxzoom[^"']*/gi) || [];
    const displayMatches = html.match(/display[^"']*/gi) || [];
    
    console.log('\\n--- Pattern Analysis ---');
    console.log(`Zoomtiles references: ${zoomTileMatches.length}`);
    if (zoomTileMatches.length > 0) {
      console.log('  Sample zoomtiles:', zoomTileMatches.slice(0, 3));
    }
    
    console.log(`Viewer references: ${viewerMatches.length}`);
    if (viewerMatches.length > 0) {
      console.log('  Sample viewer:', viewerMatches.slice(0, 3));
    }
    
    console.log(`AjaxZoom references: ${ajaxZoomMatches.length}`);
    if (ajaxZoomMatches.length > 0) {
      console.log('  Sample ajaxzoom:', ajaxZoomMatches.slice(0, 3));
    }
    
    console.log(`Display references: ${displayMatches.length}`);
    if (displayMatches.length > 0) {
      console.log('  Sample display:', displayMatches.slice(0, 3));
    }
    
    // Look for JavaScript configuration
    const jsConfigMatches = html.match(/(?:var|const|let)\\s+[^=]*=\\s*[^;]*(?:zoomtiles|viewerd|syracuse|16994415)[^;]*/gi) || [];
    console.log(`\\nJavaScript config references: ${jsConfigMatches.length}`);
    if (jsConfigMatches.length > 0) {
      console.log('  Sample JS config:', jsConfigMatches.slice(0, 3));
    }
    
    // Look for specific manuscript ID patterns
    const manuscriptIdMatches = html.match(/16994415[^"\\s]*/gi) || [];
    console.log(`\\nManuscript ID references: ${manuscriptIdMatches.length}`);
    if (manuscriptIdMatches.length > 0) {
      console.log('  Sample manuscript IDs:', manuscriptIdMatches.slice(0, 5));
    }
    
    // Look for iframe or embed patterns
    const iframeMatches = html.match(/<iframe[^>]*src="[^"]*"/gi) || [];
    console.log(`\\nIframe references: ${iframeMatches.length}`);
    if (iframeMatches.length > 0) {
      console.log('  Sample iframes:', iframeMatches.slice(0, 3));
    }
    
  } catch (error) {
    console.log(`Error fetching document page: ${error.message}`);
  }

  // Step 2: Test different tile URL patterns
  console.log('\\n--- Step 2: Testing Tile URL Patterns ---');
  
  const patterns = [
    // Original pattern from adapter
    'https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/16994415_0001/3-0-0.jpg',
    // Alternative patterns
    'https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/16994415/3-0-0.jpg',
    'https://viewerd.kbr.be/SYRACUSE/zoomtiles/16994415_0001/3-0-0.jpg',
    'https://viewerd.kbr.be/SYRACUSE/zoomtiles/16994415/3-0-0.jpg',
    'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/zoomtiles/16994415_0001/3-0-0.jpg',
    'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/zoomtiles/16994415/3-0-0.jpg',
    // With different page numbers
    'https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/16994415_0001/3-0-0.jpg',
    'https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/16994415_0002/3-0-0.jpg',
    'https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/16994415_0003/3-0-0.jpg',
    // Different zoom levels
    'https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/16994415_0001/0-0-0.jpg',
    'https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/16994415_0001/1-0-0.jpg',
    'https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/16994415_0001/2-0-0.jpg',
    'https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/16994415_0001/3-0-0.jpg',
    // AjaxZoom patterns
    'https://viewerd.kbr.be/display/SYRACUSE/ajaxzoom/16994415_0001/3-0-0.jpg',
    'https://viewerd.kbr.be/ajaxzoom/SYRACUSE/16994415_0001/3-0-0.jpg',
  ];
  
  const referrer = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
  
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    console.log(`\\n  Testing pattern ${i + 1}: ${pattern}`);
    
    try {
      const response = await new Promise((resolve, reject) => {
        const urlObj = new URL(pattern);
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || 443,
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: {
            'Referer': referrer,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
          }
        };
        
        const req = https.request(options, (res) => {
          let data = Buffer.alloc(0);
          res.on('data', (chunk) => {
            data = Buffer.concat([data, chunk]);
          });
          res.on('end', () => {
            resolve({ status: res.statusCode, headers: res.headers, data });
          });
        });
        
        req.on('error', reject);
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
        req.end();
      });
      
      const isValidJpeg = response.data.length > 0 && 
                         response.data.subarray(0, 2).toString('hex') === 'ffd8';
      
      console.log(`    Status: ${response.status}`);
      console.log(`    Size: ${response.data.length} bytes`);
      console.log(`    Content-Type: ${response.headers['content-type'] || 'unknown'}`);
      console.log(`    Valid JPEG: ${isValidJpeg}`);
      
      if (response.status === 200 && isValidJpeg && response.data.length > 5000) {
        console.log('    ✓ SUCCESS - Valid tile found!');
        
        // Save the successful tile
        const tileFile = `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/belgica-successful-tile-${i + 1}.jpg`;
        fs.writeFileSync(tileFile, response.data);
        console.log(`    Saved to: ${tileFile}`);
        
        // Test a few more tiles from this pattern
        const basePattern = pattern.replace('/3-0-0.jpg', '');
        console.log(`    Testing additional tiles from: ${basePattern}`);
        
        for (let x = 0; x < 3; x++) {
          for (let y = 0; y < 3; y++) {
            if (x === 0 && y === 0) continue; // Already tested
            
            const testUrl = `${basePattern}/3-${x}-${y}.jpg`;
            try {
              const testResponse = await new Promise((resolve, reject) => {
                const urlObj = new URL(testUrl);
                const options = {
                  hostname: urlObj.hostname,
                  port: urlObj.port || 443,
                  path: urlObj.pathname + urlObj.search,
                  method: 'GET',
                  headers: {
                    'Referer': referrer,
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                  }
                };
                
                const req = https.request(options, (res) => {
                  let data = Buffer.alloc(0);
                  res.on('data', (chunk) => {
                    data = Buffer.concat([data, chunk]);
                  });
                  res.on('end', () => {
                    resolve({ status: res.statusCode, data });
                  });
                });
                
                req.on('error', reject);
                req.setTimeout(5000, () => {
                  req.destroy();
                  reject(new Error('Request timeout'));
                });
                req.end();
              });
              
              const testIsValidJpeg = testResponse.data.length > 0 && 
                                     testResponse.data.subarray(0, 2).toString('hex') === 'ffd8';
              
              console.log(`      Tile ${x}-${y}: ${testResponse.status} (${testResponse.data.length} bytes, JPEG: ${testIsValidJpeg})`);
              
              if (testResponse.status === 200 && testIsValidJpeg && testResponse.data.length > 5000) {
                const testTileFile = `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/belgica-tile-${x}-${y}.jpg`;
                fs.writeFileSync(testTileFile, testResponse.data);
              }
            } catch (testError) {
              console.log(`      Tile ${x}-${y}: Error - ${testError.message}`);
            }
          }
        }
        
        break; // Stop testing once we find a working pattern
      } else if (response.status === 404) {
        console.log('    ✗ Not found');
      } else if (response.status === 403) {
        console.log('    ✗ Access denied');
      } else {
        console.log(`    ✗ Unexpected response`);
      }
      
    } catch (error) {
      console.log(`    ✗ Error: ${error.message}`);
    }
  }

  // Step 3: Check for redirects or different domains
  console.log('\\n--- Step 3: Checking for Redirects ---');
  try {
    const response = await fetch(TEST_URL, { redirect: 'manual' });
    console.log(`Document page status: ${response.status}`);
    
    if (response.status === 301 || response.status === 302) {
      const location = response.headers.get('location');
      console.log(`Redirect to: ${location}`);
    }
    
    // Check if there's a different viewer domain
    const viewerDomains = [
      'viewerd.kbr.be',
      'viewer.kbr.be',
      'images.kbr.be',
      'tiles.kbr.be',
      'zoom.kbr.be'
    ];
    
    for (const domain of viewerDomains) {
      const testUrl = `https://${domain}`;
      try {
        const domainResponse = await fetch(testUrl, { method: 'HEAD' });
        console.log(`Domain ${domain}: ${domainResponse.status}`);
      } catch (error) {
        console.log(`Domain ${domain}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.log(`Error checking redirects: ${error.message}`);
  }

  console.log('\\n=== INVESTIGATION COMPLETE ===');
  console.log('Review the saved HTML file and check for successful tile patterns.');
  console.log('If tiles were found, examine the working pattern for the correct URL structure.');
}

if (require.main === module) {
  investigateBelgicaStructure()
    .catch((error) => {
      console.error('Investigation failed:', error);
      process.exit(1);
    });
}

module.exports = { investigateBelgicaStructure };