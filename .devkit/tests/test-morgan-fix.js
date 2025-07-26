const https = require('https');

// Test the proposed fix
async function testMorganFix(url) {
  console.log('\n🔧 Testing Morgan Library Fix');
  console.log('URL:', url);
  console.log('-'.repeat(60));
  
  // PROPOSED FIX: Don't append /thumbs for main morgan URLs
  let pageUrl = url;
  
  // Only keep the /thumbs behavior for ICA format
  if (!url.includes('ica.themorgan.org') && url.includes('/thumbs')) {
    // Remove /thumbs if present
    pageUrl = url.replace('/thumbs', '');
    console.log('📝 Removed /thumbs:', pageUrl);
  }
  
  // Fetch the page
  const response = await fetchUrl(pageUrl);
  
  if (response.statusCode !== 200) {
    console.log(`❌ Failed to fetch page: ${response.statusCode}`);
    return null;
  }
  
  console.log('✅ Page fetched successfully');
  
  // Extract manuscript ID from URL
  const manuscriptMatch = url.match(/\/collection\/([^/]+)/);
  if (!manuscriptMatch) {
    console.log('❌ Could not extract manuscript ID from URL');
    return null;
  }
  
  const manuscriptId = manuscriptMatch[1];
  console.log('📚 Manuscript ID:', manuscriptId);
  
  // Look for page URLs
  const pageUrlRegex = new RegExp(`\\/collection\\/${manuscriptId}\\/(\\d+)`, 'g');
  const pageMatches = [...response.html.matchAll(pageUrlRegex)];
  const uniquePages = [...new Set(pageMatches.map(match => match[1]))];
  
  console.log(`\n📄 Page extraction results:`);
  console.log(`   Total matches: ${pageMatches.length}`);
  console.log(`   Unique pages: ${uniquePages.length}`);
  
  if (uniquePages.length > 0) {
    console.log(`   Page numbers: ${uniquePages.slice(0, 20).join(', ')}${uniquePages.length > 20 ? '...' : ''}`);
    
    // Test fetching a few pages to verify they have download links
    console.log('\n🔍 Verifying page download links (testing first 3 pages):');
    
    for (let i = 0; i < Math.min(3, uniquePages.length); i++) {
      const pageNum = uniquePages[i];
      const individualPageUrl = `https://www.themorgan.org/collection/${manuscriptId}/${pageNum}`;
      
      console.log(`\n   Page ${pageNum}:`);
      const pageResponse = await fetchUrl(individualPageUrl);
      
      if (pageResponse.statusCode === 200) {
        // Look for download links
        const downloadRegex = /href="([^"]*\/download\/[^"]*\.jpg[^"]*)"/gi;
        const downloadMatches = [...pageResponse.html.matchAll(downloadRegex)];
        
        if (downloadMatches.length > 0) {
          console.log(`   ✅ Found download link: ${downloadMatches[0][1]}`);
          
          // Check if it's high resolution
          if (downloadMatches[0][1].includes('iiif/')) {
            console.log('   📸 IIIF format - should be high resolution');
          }
        } else {
          console.log('   ⚠️  No download link found');
        }
      } else {
        console.log(`   ❌ Failed to fetch page: ${pageResponse.statusCode}`);
      }
    }
  }
  
  return uniquePages.length;
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { 
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({ html: data, statusCode: res.statusCode });
      });
    }).on('error', err => {
      reject(err);
    });
  });
}

// Test cases
const testCases = [
  'https://www.themorgan.org/collection/lindau-gospels/thumbs',  // With /thumbs
  'https://www.themorgan.org/collection/lindau-gospels',         // Without /thumbs
  'https://www.themorgan.org/collection/gospel-book',
  'https://www.themorgan.org/collection/arenberg-gospels'
];

async function runTests() {
  console.log('🧪 Morgan Library Fix Test\n');
  console.log('Testing proposed fix: Don\'t append /thumbs to Morgan URLs');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const url of testCases) {
    console.log('\n\n' + '='.repeat(60));
    const pageCount = await testMorganFix(url);
    results.push({ url, pageCount });
  }
  
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 Test Results Summary:\n');
  
  results.forEach(result => {
    const status = result.pageCount === null ? '❌ Failed' : 
                   result.pageCount === 0 ? '⚠️  No pages' : 
                   `✅ ${result.pageCount} pages`;
    console.log(`${status} - ${result.url}`);
  });
  
  console.log('\n🔧 Recommended Fix:');
  console.log('1. Remove the automatic /thumbs appending for main Morgan URLs');
  console.log('2. Fetch the main collection page directly');
  console.log('3. Extract individual page numbers from the main page');
  console.log('4. Fetch each individual page to get high-res download links\n');
}

runTests().catch(console.error);