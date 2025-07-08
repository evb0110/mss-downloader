const fs = require('fs');
const https = require('https');
const { URL } = require('url');

const UURL_URL = 'https://uurl.kbr.be/1558106';

async function investigateUurlViewer() {
  console.log('=== INVESTIGATING UURL VIEWER ===');
  console.log(`UURL URL: ${UURL_URL}`);
  console.log(`Test Time: ${new Date().toISOString()}`);
  console.log('');

  // Step 1: Fetch the UURL page
  console.log('--- Step 1: Fetching UURL Viewer Page ---');
  try {
    const response = await fetch(UURL_URL);
    const html = await response.text();
    
    console.log(`HTTP Status: ${response.status}`);
    console.log(`Content Length: ${html.length} characters`);
    
    // Save the HTML for analysis
    const htmlFile = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/uurl-viewer-page.html';
    fs.writeFileSync(htmlFile, html);
    console.log(`HTML saved to: ${htmlFile}`);
    
    // Look for image server patterns
    const imageServerPatterns = [
      /https?:\/\/[^"']*\.(?:jpg|jpeg|png|gif|webp|tiff?)[^"']*/gi,
      /imageserver[^"']*/gi,
      /iiif[^"']*/gi,
      /tiles?[^"']*/gi,
      /zoom[^"']*/gi,
      /ajax[^"']*/gi,
      /openseadragon[^"']*/gi,
      /leaflet[^"']*/gi
    ];
    
    console.log('\\n--- Pattern Analysis ---');
    let foundPatterns = [];
    
    imageServerPatterns.forEach((pattern, index) => {
      const matches = html.match(pattern) || [];
      console.log(`Pattern ${index + 1} matches: ${matches.length}`);
      if (matches.length > 0) {
        console.log(`  Sample matches:`, matches.slice(0, 3));
        foundPatterns.push(...matches);
      }
    });
    
    // Look for JavaScript configuration
    const jsConfigMatches = html.match(/(?:var|const|let)\\s+[^=]*=\\s*[^;]*(?:image|tile|zoom|iiif)[^;]*/gi) || [];
    console.log(`\\nJavaScript config references: ${jsConfigMatches.length}`);
    if (jsConfigMatches.length > 0) {
      console.log('  Sample JS config:', jsConfigMatches.slice(0, 5));
    }
    
    // Look for JSON configuration
    const jsonMatches = html.match(/\\{[^}]*(?:image|tile|zoom|iiif)[^}]*\\}/gi) || [];
    console.log(`\\nJSON config references: ${jsonMatches.length}`);
    if (jsonMatches.length > 0) {
      console.log('  Sample JSON config:', jsonMatches.slice(0, 3));
    }
    
    // Look for data attributes
    const dataAttrMatches = html.match(/data-[^="]*="[^"]*"/gi) || [];
    console.log(`\\nData attributes: ${dataAttrMatches.length}`);
    if (dataAttrMatches.length > 0) {
      console.log('  Sample data attributes:', dataAttrMatches.slice(0, 5));
    }
    
  } catch (error) {
    console.log(`Error fetching UURL page: ${error.message}`);
  }

  // Step 2: Test potential image URLs found
  console.log('\\n--- Step 2: Testing Found Image URLs ---');
  
  // Common IIIF and image server patterns for KBR
  const potentialUrls = [
    // IIIF patterns
    'https://uurl.kbr.be/1558106/info.json',
    'https://imageserver.kbr.be/1558106/info.json',
    'https://iiif.kbr.be/1558106/info.json',
    'https://images.kbr.be/1558106/info.json',
    
    // Direct image patterns
    'https://uurl.kbr.be/1558106/full/max/0/default.jpg',
    'https://imageserver.kbr.be/1558106/full/max/0/default.jpg',
    'https://iiif.kbr.be/1558106/full/max/0/default.jpg',
    'https://images.kbr.be/1558106/full/max/0/default.jpg',
    
    // Tile patterns
    'https://uurl.kbr.be/1558106/0/0/0.jpg',
    'https://uurl.kbr.be/1558106/1/0/0.jpg',
    'https://uurl.kbr.be/1558106/2/0/0.jpg',
    'https://uurl.kbr.be/1558106/3/0/0.jpg',
    
    // Alternative tile patterns
    'https://uurl.kbr.be/tiles/1558106/0/0/0.jpg',
    'https://uurl.kbr.be/tiles/1558106/1/0/0.jpg',
    'https://uurl.kbr.be/tiles/1558106/2/0/0.jpg',
    'https://uurl.kbr.be/tiles/1558106/3/0/0.jpg'
  ];
  
  const referrer = 'https://uurl.kbr.be/1558106';
  
  for (let i = 0; i < potentialUrls.length; i++) {
    const url = potentialUrls[i];
    console.log(`\\n  Testing URL ${i + 1}: ${url}`);
    
    try {
      const response = await new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || 443,
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: {
            'Referer': referrer,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8,application/json'
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
      
      const contentType = response.headers['content-type'] || '';
      const isImage = contentType.includes('image/');
      const isJson = contentType.includes('json') || url.includes('.json');
      
      console.log(`    Status: ${response.status}`);
      console.log(`    Content-Type: ${contentType}`);
      console.log(`    Size: ${response.data.length} bytes`);
      
      if (response.status === 200) {
        if (isJson) {
          try {
            const jsonData = JSON.parse(response.data.toString());
            console.log('    ✓ SUCCESS - JSON response found!');
            console.log(`    JSON keys: ${Object.keys(jsonData).join(', ')}`);
            
            // Save JSON response
            const jsonFile = `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/uurl-${i + 1}-response.json`;
            fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2));
            console.log(`    Saved to: ${jsonFile}`);
            
            // Check if this is an IIIF info.json
            if (jsonData['@context'] && jsonData['@context'].includes('iiif')) {
              console.log('    ✓ IIIF info.json detected!');
              console.log(`    Image ID: ${jsonData['@id'] || 'unknown'}`);
              console.log(`    Width: ${jsonData.width || 'unknown'}`);
              console.log(`    Height: ${jsonData.height || 'unknown'}`);
              console.log(`    Tile size: ${jsonData.tiles?.[0]?.width || 'unknown'}`);
              console.log(`    Scale factors: ${jsonData.tiles?.[0]?.scaleFactors?.join(', ') || 'unknown'}`);
              
              // Test IIIF image URL
              if (jsonData['@id']) {
                const iiifImageUrl = `${jsonData['@id']}/full/max/0/default.jpg`;
                console.log(`    Testing IIIF image: ${iiifImageUrl}`);
                
                try {
                  const imageResponse = await fetch(iiifImageUrl, {
                    headers: {
                      'Referer': referrer,
                      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                    }
                  });
                  
                  if (imageResponse.ok) {
                    console.log(`    ✓ IIIF image accessible: ${imageResponse.status}`);
                    
                    // Save a sample of the image
                    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                    const imageFile = `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/uurl-sample-image.jpg`;
                    fs.writeFileSync(imageFile, imageBuffer);
                    console.log(`    Sample image saved to: ${imageFile}`);
                    
                    // Test tile URLs
                    if (jsonData.tiles && jsonData.tiles[0]) {
                      const tileWidth = jsonData.tiles[0].width;
                      const scaleFactors = jsonData.tiles[0].scaleFactors;
                      
                      console.log(`    Testing tile URLs...`);
                      for (let scale of scaleFactors) {
                        const tileUrl = `${jsonData['@id']}/${scale * tileWidth},0,${tileWidth},${tileWidth}/${tileWidth},${tileWidth}/0/default.jpg`;
                        console.log(`      Scale ${scale}: ${tileUrl}`);
                        
                        try {
                          const tileResponse = await fetch(tileUrl, {
                            headers: {
                              'Referer': referrer,
                              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                              'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                            }
                          });
                          
                          if (tileResponse.ok) {
                            console.log(`        ✓ Tile accessible: ${tileResponse.status} (${tileResponse.headers.get('content-length')} bytes)`);
                            
                            // Save first successful tile
                            if (scale === scaleFactors[0]) {
                              const tileBuffer = Buffer.from(await tileResponse.arrayBuffer());
                              const tileFile = `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/uurl-sample-tile.jpg`;
                              fs.writeFileSync(tileFile, tileBuffer);
                              console.log(`        Sample tile saved to: ${tileFile}`);
                            }
                          } else {
                            console.log(`        ✗ Tile not accessible: ${tileResponse.status}`);
                          }
                        } catch (tileError) {
                          console.log(`        ✗ Tile error: ${tileError.message}`);
                        }
                      }
                    }
                  } else {
                    console.log(`    ✗ IIIF image not accessible: ${imageResponse.status}`);
                  }
                } catch (imageError) {
                  console.log(`    ✗ IIIF image error: ${imageError.message}`);
                }
              }
            }
          } catch (jsonError) {
            console.log(`    ✗ Invalid JSON: ${jsonError.message}`);
          }
        } else if (isImage) {
          console.log('    ✓ SUCCESS - Image found!');
          
          // Save successful image
          const imageFile = `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/uurl-found-image-${i + 1}.jpg`;
          fs.writeFileSync(imageFile, response.data);
          console.log(`    Saved to: ${imageFile}`);
        } else {
          console.log(`    ✓ SUCCESS - Other content type`);
        }
      } else if (response.status === 404) {
        console.log('    ✗ Not found');
      } else if (response.status === 403) {
        console.log('    ✗ Access denied');
      } else {
        console.log(`    ✗ Unexpected response: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`    ✗ Error: ${error.message}`);
    }
  }

  console.log('\\n=== UURL INVESTIGATION COMPLETE ===');
  console.log('Check the saved files for working image URLs and IIIF configurations.');
  
  return true;
}

if (require.main === module) {
  investigateUurlViewer()
    .catch((error) => {
      console.error('Investigation failed:', error);
      process.exit(1);
    });
}

module.exports = { investigateUurlViewer };