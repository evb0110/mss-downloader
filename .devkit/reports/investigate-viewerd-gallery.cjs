const fs = require('fs');
const https = require('https');
const { URL } = require('url');

const GALLERY_URL = 'https://viewerd.kbr.be/gallery.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/';

async function investigateViewerdGallery() {
  console.log('=== INVESTIGATING VIEWERD GALLERY ===');
  console.log(`Gallery URL: ${GALLERY_URL}`);
  console.log(`Test Time: ${new Date().toISOString()}`);
  console.log('');

  // Step 1: Fetch the gallery page
  console.log('--- Step 1: Fetching Gallery Page ---');
  try {
    const response = await fetch(GALLERY_URL);
    const html = await response.text();
    
    console.log(`HTTP Status: ${response.status}`);
    console.log(`Content Length: ${html.length} characters`);
    
    // Save the HTML for analysis
    const htmlFile = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/viewerd-gallery-page.html';
    fs.writeFileSync(htmlFile, html);
    console.log(`HTML saved to: ${htmlFile}`);
    
    // Look for ajaxzoom patterns
    const ajaxzoomMatches = html.match(/ajaxzoom[^"']*/gi) || [];
    console.log(`\\nAjaxZoom references: ${ajaxzoomMatches.length}`);
    if (ajaxzoomMatches.length > 0) {
      console.log('  Sample ajaxzoom:', ajaxzoomMatches.slice(0, 5));
    }
    
    // Look for image paths
    const imageMatches = html.match(/(?:src|href)="[^"]*\\.(?:jpg|jpeg|png|gif|webp|tiff?)"/gi) || [];
    console.log(`\\nImage references: ${imageMatches.length}`);
    if (imageMatches.length > 0) {
      console.log('  Sample images:', imageMatches.slice(0, 5));
    }
    
    // Look for zoomload patterns
    const zoomLoadMatches = html.match(/zoomload[^"']*/gi) || [];
    console.log(`\\nZoomLoad references: ${zoomLoadMatches.length}`);
    if (zoomLoadMatches.length > 0) {
      console.log('  Sample zoomload:', zoomLoadMatches.slice(0, 5));
    }
    
    // Look for JavaScript variables
    const jsVarMatches = html.match(/(?:var|let|const)\\s+\\w+\\s*=\\s*[^;]+/gi) || [];
    console.log(`\\nJavaScript variables: ${jsVarMatches.length}`);
    if (jsVarMatches.length > 0) {
      console.log('  Sample JS vars:', jsVarMatches.slice(0, 5));
    }
    
    // Look for URLs in the HTML
    const urlMatches = html.match(/https?:\/\/[^"'\s]+/gi) || [];
    console.log(`\\nURL references: ${urlMatches.length}`);
    if (urlMatches.length > 0) {
      console.log('  Sample URLs:', urlMatches.slice(0, 5));
    }
    
    // Look for map parameter references
    const mapMatches = html.match(/[^"']*A\/1\/5\/8\/9\/4\/8\/5[^"']*/gi) || [];
    console.log(`\\nMap references: ${mapMatches.length}`);
    if (mapMatches.length > 0) {
      console.log('  Sample maps:', mapMatches.slice(0, 5));
    }
    
  } catch (error) {
    console.log(`Error fetching gallery page: ${error.message}`);
  }

  // Step 2: Test potential AjaxZoom endpoints
  console.log('\\n--- Step 2: Testing AjaxZoom Endpoints ---');
  
  const ajaxzoomPatterns = [
    // Based on the map structure A/1/5/8/9/4/8/5/0000-00-00_00/
    'https://viewerd.kbr.be/axZm/zoomLoad.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/',
    'https://viewerd.kbr.be/axZm/zoomLoad.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/&z=1',
    'https://viewerd.kbr.be/axZm/zoomLoad.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/&z=2',
    'https://viewerd.kbr.be/axZm/zoomLoad.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/&z=3',
    
    // Alternative patterns
    'https://viewerd.kbr.be/zoomLoad.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/',
    'https://viewerd.kbr.be/ajaxzoom/zoomLoad.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/',
    
    // Info endpoints
    'https://viewerd.kbr.be/axZm/zoomLoad.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/&info=1',
    'https://viewerd.kbr.be/axZm/zoomLoad.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/&example=info',
    
    // Different map formats
    'https://viewerd.kbr.be/axZm/zoomLoad.php?map=A/1/5/8/9/4/8/5/',
    'https://viewerd.kbr.be/axZm/zoomLoad.php?map=A/1/5/8/9/4/8/5/0001/',
    'https://viewerd.kbr.be/axZm/zoomLoad.php?map=A/1/5/8/9/4/8/5/0002/',
    
    // Tile endpoints
    'https://viewerd.kbr.be/axZm/zoomTiles.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/',
    'https://viewerd.kbr.be/axZm/zoomTiles.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/&z=3&x=0&y=0',
    'https://viewerd.kbr.be/axZm/zoomTiles.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/&z=2&x=0&y=0',
    'https://viewerd.kbr.be/axZm/zoomTiles.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/&z=1&x=0&y=0',
    
    // Image endpoints
    'https://viewerd.kbr.be/axZm/pic/A/1/5/8/9/4/8/5/0000-00-00_00/',
    'https://viewerd.kbr.be/pic/A/1/5/8/9/4/8/5/0000-00-00_00/',
    'https://viewerd.kbr.be/images/A/1/5/8/9/4/8/5/0000-00-00_00/',
    
    // Direct tile paths
    'https://viewerd.kbr.be/A/1/5/8/9/4/8/5/0000-00-00_00/3-0-0.jpg',
    'https://viewerd.kbr.be/A/1/5/8/9/4/8/5/0000-00-00_00/2-0-0.jpg',
    'https://viewerd.kbr.be/A/1/5/8/9/4/8/5/0000-00-00_00/1-0-0.jpg',
  ];
  
  const referrer = 'https://viewerd.kbr.be/gallery.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/';
  
  for (let i = 0; i < ajaxzoomPatterns.length; i++) {
    const url = ajaxzoomPatterns[i];
    console.log(`\\n  Testing endpoint ${i + 1}: ${url}`);
    
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
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8,application/json,text/plain,*/*'
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
      const isJson = contentType.includes('json');
      const isText = contentType.includes('text/');
      
      console.log(`    Status: ${response.status}`);
      console.log(`    Content-Type: ${contentType}`);
      console.log(`    Size: ${response.data.length} bytes`);
      
      if (response.status === 200) {
        if (isImage) {
          console.log('    ✓ SUCCESS - Image found!');
          
          // Save successful image
          const imageFile = `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/viewerd-image-${i + 1}.jpg`;
          fs.writeFileSync(imageFile, response.data);
          console.log(`    Saved to: ${imageFile}`);
          
        } else if (isJson) {
          console.log('    ✓ SUCCESS - JSON response found!');
          
          try {
            const jsonData = JSON.parse(response.data.toString());
            console.log(`    JSON keys: ${Object.keys(jsonData).join(', ')}`);
            
            // Save JSON response
            const jsonFile = `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/viewerd-json-${i + 1}.json`;
            fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2));
            console.log(`    Saved to: ${jsonFile}`);
            
          } catch (jsonError) {
            console.log(`    ✗ Invalid JSON: ${jsonError.message}`);
          }
          
        } else if (isText) {
          console.log('    ✓ SUCCESS - Text response found!');
          
          const textContent = response.data.toString();
          console.log(`    Text preview: ${textContent.substring(0, 200)}...`);
          
          // Save text response
          const textFile = `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/viewerd-text-${i + 1}.txt`;
          fs.writeFileSync(textFile, textContent);
          console.log(`    Saved to: ${textFile}`);
          
        } else {
          console.log('    ✓ SUCCESS - Other content found!');
          
          // Save binary response
          const binaryFile = `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/viewerd-binary-${i + 1}.bin`;
          fs.writeFileSync(binaryFile, response.data);
          console.log(`    Saved to: ${binaryFile}`);
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

  console.log('\\n=== VIEWERD GALLERY INVESTIGATION COMPLETE ===');
  console.log('Check the saved files for working image URLs and configurations.');
  
  return true;
}

if (require.main === module) {
  investigateViewerdGallery()
    .catch((error) => {
      console.error('Investigation failed:', error);
      process.exit(1);
    });
}

module.exports = { investigateViewerdGallery };