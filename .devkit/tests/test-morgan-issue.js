const https = require('https');

// Simulate the actual Morgan Library implementation
async function simulateMorganExtraction(url) {
  console.log('\n🔧 Simulating Morgan Library Extraction');
  console.log('URL:', url);
  console.log('-'.repeat(60));
  
  // Step 1: Ensure we have /thumbs in URL (as per implementation)
  let thumbsUrl = url;
  if (!thumbsUrl.includes('/thumbs') && !thumbsUrl.includes('ica.themorgan.org') && !thumbsUrl.match(/\.(jpg|jpeg|png|gif)$/i)) {
    thumbsUrl = thumbsUrl.replace(/\/?$/, '/thumbs');
    console.log('📝 Appended /thumbs:', thumbsUrl);
  }
  
  // Step 2: Fetch the page
  const response = await fetchUrl(thumbsUrl);
  
  if (response.statusCode !== 200) {
    console.log(`❌ Failed to fetch page: ${response.statusCode}`);
    if (response.statusCode === 301 || response.statusCode === 302) {
      console.log('   Page redirected - this may be why only 1 page is offered');
    }
    return;
  }
  
  // Step 3: Extract manuscript ID from URL
  const manuscriptMatch = url.match(/\/collection\/([^/]+)/);
  if (!manuscriptMatch) {
    console.log('❌ Could not extract manuscript ID from URL');
    return;
  }
  
  const manuscriptId = manuscriptMatch[1];
  console.log('📚 Manuscript ID:', manuscriptId);
  
  // Step 4: Look for page URLs using the regex from implementation
  const pageUrlRegex = new RegExp(`\\/collection\\/${manuscriptId}\\/(\\d+)`, 'g');
  const pageMatches = [...response.html.matchAll(pageUrlRegex)];
  const uniquePages = [...new Set(pageMatches.map(match => match[1]))];
  
  console.log(`\n📄 Individual page extraction:`);
  console.log(`   Regex pattern: /collection/${manuscriptId}/(\\d+)`);
  console.log(`   Matches found: ${pageMatches.length}`);
  console.log(`   Unique pages: ${uniquePages.length}`);
  
  if (uniquePages.length > 0) {
    console.log(`   Page numbers: ${uniquePages.slice(0, 10).join(', ')}${uniquePages.length > 10 ? '...' : ''}`);
    
    // Step 5: Show what would happen with page fetching
    console.log('\n🔍 Page fetching simulation (first page only):');
    const firstPageUrl = `https://www.themorgan.org/collection/${manuscriptId}/${uniquePages[0]}`;
    console.log(`   Would fetch: ${firstPageUrl}`);
    
    const pageResponse = await fetchUrl(firstPageUrl);
    if (pageResponse.statusCode === 200) {
      console.log('   ✅ Page fetch successful');
      
      // Look for high-resolution download links
      const downloadRegex = /href="([^"]*download[^"]*\.jpg[^"]*)"/gi;
      const downloadMatches = [...pageResponse.html.matchAll(downloadRegex)];
      
      if (downloadMatches.length > 0) {
        console.log(`   Found ${downloadMatches.length} download links`);
        downloadMatches.slice(0, 3).forEach((match, i) => {
          console.log(`     ${i + 1}. ${match[1]}`);
        });
      }
    }
  } else {
    console.log('   ⚠️  No individual pages found - this explains why only 1 page is offered!');
  }
  
  // Step 6: Alternative extraction methods
  console.log('\n🔄 Checking alternative extraction methods:');
  
  // Check main page without /thumbs
  if (url !== thumbsUrl) {
    console.log('\n   Checking main page (without /thumbs)...');
    const mainResponse = await fetchUrl(url);
    
    if (mainResponse.statusCode === 200) {
      const mainPageMatches = [...mainResponse.html.matchAll(pageUrlRegex)];
      const mainUniquePages = [...new Set(mainPageMatches.map(match => match[1]))];
      
      console.log(`   Main page has ${mainUniquePages.length} unique page links`);
      if (mainUniquePages.length > uniquePages.length) {
        console.log('   ✅ Main page has MORE pages than /thumbs version!');
        console.log(`   Page numbers: ${mainUniquePages.slice(0, 10).join(', ')}${mainUniquePages.length > 10 ? '...' : ''}`);
      }
    }
  }
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { 
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
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
  'https://www.themorgan.org/collection/lindau-gospels',
  'https://www.themorgan.org/collection/gospel-book/159129',
  'https://www.themorgan.org/collection/arenberg-gospels'
];

async function runTests() {
  console.log('🧪 Morgan Library Page Extraction Issue Analysis\n');
  console.log('Problem: User reports only 1 page is offered for download');
  console.log('=' .repeat(60));
  
  for (const url of testCases) {
    console.log('\n\n' + '='.repeat(60));
    await simulateMorganExtraction(url);
  }
  
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 Summary of findings:\n');
  console.log('1. The /thumbs URL pattern may be outdated - it often redirects or 404s');
  console.log('2. The main collection page (without /thumbs) contains the actual page links');
  console.log('3. The regex needs to be run on the main page, not the /thumbs page');
  console.log('4. Individual page URLs need to be fetched to get high-res download links\n');
}

runTests().catch(console.error);