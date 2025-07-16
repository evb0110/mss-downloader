const https = require('https');
const http = require('http');

// Test URLs from user report
const testUrls = [
  'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
  'https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540', 
  'https://unipub.uni-graz.at/download/webcache/1504/8224544'
];

// Extract ID from URL
function extractId(url) {
  const match = url.match(/\/(\d+)(?:\?|$|\/)/);
  if (match) {
    const id = match[1];
    if (url.includes('/pageview/')) {
      // For pageview URLs, the titleinfo ID is pageview ID - 2
      return String(parseInt(id) - 2);
    }
    return id;
  }
  return null;
}

// Test manifest fetch with detailed error logging
async function testManifest(url) {
  const id = extractId(url);
  if (!id) {
    console.log(`❌ Could not extract ID from URL: ${url}`);
    return;
  }

  const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${id}/manifest`;
  console.log(`\n📋 Testing URL: ${url}`);
  console.log(`   Extracted ID: ${id}`);
  console.log(`   Manifest URL: ${manifestUrl}`);

  return new Promise((resolve) => {
    const startTime = Date.now();
    
    https.get(manifestUrl, {
      timeout: 60000, // 60 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive'
      }
    }, (res) => {
      let data = '';
      
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Headers:`, res.headers);

      if (res.statusCode !== 200) {
        console.log(`   ❌ Failed with status ${res.statusCode}`);
        resolve();
        return;
      }

      res.on('data', chunk => {
        data += chunk;
        // Log progress for large downloads
        if (data.length % 1000000 === 0) {
          console.log(`   Downloaded ${Math.round(data.length / 1000000)}MB...`);
        }
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;
        console.log(`   ✅ Success! Downloaded ${data.length} bytes in ${duration}ms`);
        
        try {
          const manifest = JSON.parse(data);
          const sequences = manifest.sequences || [];
          const canvases = sequences[0]?.canvases || [];
          console.log(`   📄 Pages found: ${canvases.length}`);
          
          // Test first page URL
          if (canvases.length > 0) {
            const firstCanvas = canvases[0];
            const imageUrl = firstCanvas.images?.[0]?.resource?.['@id'];
            if (imageUrl) {
              console.log(`   🖼️ First page URL: ${imageUrl}`);
            }
          }
        } catch (e) {
          console.log(`   ⚠️ Could not parse manifest JSON: ${e.message}`);
        }
        
        resolve();
      });

    }).on('error', (err) => {
      const duration = Date.now() - startTime;
      console.log(`   ❌ Error after ${duration}ms: ${err.message}`);
      resolve();
    }).on('timeout', () => {
      console.log(`   ❌ Request timeout after 60 seconds`);
      resolve();
    });
  });
}

// Test direct image access for problematic URLs
async function testDirectImageAccess() {
  console.log('\n\n🔍 Testing direct image access for URL 3...');
  
  // URL 3 was: https://unipub.uni-graz.at/download/webcache/1504/8224544
  // This looks like a direct image URL pattern
  const imageUrl = 'https://unipub.uni-graz.at/download/webcache/1504/8224544';
  
  return new Promise((resolve) => {
    https.get(imageUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Content-Type: ${res.headers['content-type']}`);
      console.log(`   Content-Length: ${res.headers['content-length']}`);
      
      if (res.statusCode === 200) {
        console.log(`   ✅ Direct image access works!`);
      } else {
        console.log(`   ❌ Direct image access failed`);
      }
      
      // Don't download the full image, just check if it's accessible
      res.destroy();
      resolve();
    }).on('error', (err) => {
      console.log(`   ❌ Error: ${err.message}`);
      resolve();
    });
  });
}

// Run all tests
async function runTests() {
  console.log('🧪 Testing University of Graz manuscript URLs...\n');
  
  for (const url of testUrls) {
    await testManifest(url);
  }
  
  await testDirectImageAccess();
  
  console.log('\n✅ All tests completed');
}

runTests();