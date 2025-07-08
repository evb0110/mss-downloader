const https = require('https');
const fs = require('fs');
const zlib = require('zlib');

async function makeRequest(url, acceptEncoding = false) {
  return new Promise((resolve) => {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache'
    };
    
    if (!acceptEncoding) {
      headers['Accept-Encoding'] = 'identity';
    }
    
    const req = https.get(url, { headers }, (res) => {
      let data = Buffer.alloc(0);
      
      res.on('data', (chunk) => {
        data = Buffer.concat([data, chunk]);
      });
      
      res.on('end', () => {
        let body = data;
        
        const encoding = res.headers['content-encoding'];
        if (encoding === 'gzip') {
          try {
            body = zlib.gunzipSync(data);
          } catch (e) {
            console.log('Failed to decompress gzip');
          }
        } else if (encoding === 'deflate') {
          try {
            body = zlib.inflateSync(data);
          } catch (e) {
            console.log('Failed to decompress deflate');
          }
        }
        
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body.toString('utf8'),
          url: url
        });
      });
    });
    
    req.on('error', (error) => {
      resolve({
        statusCode: 0,
        error: error.message,
        url: url
      });
    });
    
    req.setTimeout(15000, () => {
      req.abort();
      resolve({
        statusCode: 0,
        error: 'Timeout',
        url: url
      });
    });
  });
}

async function analyzeUurlViewer() {
  console.log('Analyzing UURL viewer page...\n');
  
  const result = await makeRequest('https://uurl.kbr.be/1558106');
  
  if (result.statusCode === 200) {
    console.log('UURL viewer loaded successfully');
    console.log(`Content-Type: ${result.headers['content-type']}`);
    console.log(`Content-Length: ${result.body.length}`);
    
    // Save the uncompressed HTML
    fs.writeFileSync('.devkit/temp/uurl-viewer-uncompressed.html', result.body);
    console.log('Saved to .devkit/temp/uurl-viewer-uncompressed.html');
    
    // Look for AJAX zoom patterns
    const ajaxMatches = result.body.match(/ajax[zZ]oom|axzm|zoom.*php/gi) || [];
    if (ajaxMatches.length > 0) {
      console.log('AJAX zoom patterns found:', ajaxMatches.slice(0, 10));
    }
    
    // Look for JavaScript configurations
    const jsConfigMatches = result.body.match(/var\s+\w+\s*=\s*[{[][\s\S]*?[}\]]/gi) || [];
    if (jsConfigMatches.length > 0) {
      console.log('JS configurations found:', jsConfigMatches.slice(0, 3));
    }
    
    // Look for IIIF patterns
    const iiifMatches = result.body.match(/iiif[^"'\s]*|manifest[^"'\s]*\.json/gi) || [];
    if (iiifMatches.length > 0) {
      console.log('IIIF patterns found:', iiifMatches.slice(0, 5));
    }
    
    // Look for image server URLs
    const imageMatches = result.body.match(/https?:\/\/[^"'\s]*\/[^"'\s]*\.(jpg|jpeg|png|tiff|jp2)/gi) || [];
    if (imageMatches.length > 0) {
      console.log('Image URLs found:', imageMatches.slice(0, 5));
    }
    
    // Look for tile server patterns
    const tileMatches = result.body.match(/tile[^"'\s]*|zoom[^"'\s]*level/gi) || [];
    if (tileMatches.length > 0) {
      console.log('Tile/zoom patterns found:', tileMatches.slice(0, 5));
    }
    
    // Look for API endpoints
    const apiMatches = result.body.match(/\/api\/[^"'\s]*|endpoint[^"'\s]*/gi) || [];
    if (apiMatches.length > 0) {
      console.log('API endpoints found:', apiMatches.slice(0, 5));
    }
    
    // Look for page count
    const pageMatches = result.body.match(/page[^"'\s]*\d+|total[^"'\s]*\d+|\d+[^"'\s]*pages?/gi) || [];
    if (pageMatches.length > 0) {
      console.log('Page patterns found:', pageMatches.slice(0, 5));
    }
    
    // Look for document ID references
    const docIdMatches = result.body.match(/18776579|1558106/gi) || [];
    if (docIdMatches.length > 0) {
      console.log('Document ID references found:', docIdMatches.length);
    }
    
    // Look for OpenSeadragon patterns
    const osdMatches = result.body.match(/openseadragon|seadragon/gi) || [];
    if (osdMatches.length > 0) {
      console.log('OpenSeadragon patterns found:', osdMatches.slice(0, 3));
    }
    
    // Look for script sources
    const scriptMatches = result.body.match(/<script[^>]*src=["']([^"']*)["']/gi) || [];
    if (scriptMatches.length > 0) {
      console.log('Script sources found:', scriptMatches.slice(0, 5));
    }
    
  } else {
    console.log(`Failed to load UURL viewer: ${result.statusCode}`);
  }
}

async function testMaximumResolutionPatterns() {
  console.log('\n\nTesting maximum resolution patterns...\n');
  
  const documentId = '18776579';
  
  const resolutionTests = [
    // Test pixel dimensions
    {
      name: 'Width 2000px',
      url: `https://belgica.kbr.be/Ils/digitalCollection/DigitalCollectionThumbnailHandler.ashx?documentId=${documentId}&width=2000`
    },
    {
      name: 'Width 4000px',
      url: `https://belgica.kbr.be/Ils/digitalCollection/DigitalCollectionThumbnailHandler.ashx?documentId=${documentId}&width=4000`
    },
    {
      name: 'Width 8000px',
      url: `https://belgica.kbr.be/Ils/digitalCollection/DigitalCollectionThumbnailHandler.ashx?documentId=${documentId}&width=8000`
    },
    // Test quality parameters
    {
      name: 'Quality 100',
      url: `https://belgica.kbr.be/Ils/digitalCollection/DigitalCollectionThumbnailHandler.ashx?documentId=${documentId}&size=LARGE&quality=100`
    },
    {
      name: 'High DPI',
      url: `https://belgica.kbr.be/Ils/digitalCollection/DigitalCollectionThumbnailHandler.ashx?documentId=${documentId}&size=LARGE&dpi=300`
    },
    // Test format parameters
    {
      name: 'PNG format',
      url: `https://belgica.kbr.be/Ils/digitalCollection/DigitalCollectionThumbnailHandler.ashx?documentId=${documentId}&size=LARGE&format=png`
    },
    {
      name: 'TIFF format',
      url: `https://belgica.kbr.be/Ils/digitalCollection/DigitalCollectionThumbnailHandler.ashx?documentId=${documentId}&size=LARGE&format=tiff`
    },
    // Test maximum size parameters
    {
      name: 'MAX size with quality',
      url: `https://belgica.kbr.be/Ils/digitalCollection/DigitalCollectionThumbnailHandler.ashx?documentId=${documentId}&size=MAX&quality=100`
    }
  ];
  
  for (const test of resolutionTests) {
    console.log(`Testing: ${test.name}`);
    
    const result = await makeRequest(test.url);
    
    if (result.statusCode === 200) {
      const contentType = result.headers['content-type'];
      const contentLength = result.headers['content-length'] || result.body.length;
      
      if (contentType && contentType.startsWith('image/')) {
        console.log(`✓ SUCCESS: ${contentLength} bytes (${contentType})`);
      } else {
        console.log(`? RESPONSE: ${contentLength} bytes (${contentType})`);
      }
    } else {
      console.log(`✗ FAILED: ${result.statusCode}`);
    }
  }
}

async function main() {
  await analyzeUurlViewer();
  await testMaximumResolutionPatterns();
}

main().catch(console.error);