const https = require('https');

// Test with known working Morgan URLs
const testUrls = [
  {
    name: 'Lindau Gospels (main page)',
    url: 'https://www.themorgan.org/collection/lindau-gospels',
    expectedPattern: 'collection'
  },
  {
    name: 'Gospel Book specific page',
    url: 'https://www.themorgan.org/collection/gospel-book/159129', 
    expectedPattern: 'collection'
  },
  {
    name: 'ICA manuscript',
    url: 'https://ica.themorgan.org/manuscript/page/1/159109',
    expectedPattern: 'ica'
  }
];

function fetchUrl(url, followRedirects = true) {
  return new Promise((resolve, reject) => {
    console.log(`\n📡 Fetching: ${url}`);
    
    const makeRequest = (requestUrl) => {
      https.get(requestUrl, { 
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (res) => {
        console.log(`   Status: ${res.statusCode}`);
        
        // Handle redirects
        if (followRedirects && (res.statusCode === 301 || res.statusCode === 302)) {
          const redirectUrl = res.headers.location;
          console.log(`   Redirected to: ${redirectUrl}`);
          makeRequest(redirectUrl);
          return;
        }
        
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
        });
        
        res.on('end', () => {
          console.log(`   Response length: ${data.length}`);
          resolve({ html: data, finalUrl: requestUrl, statusCode: res.statusCode });
        });
      }).on('error', err => {
        console.error(`❌ Error fetching URL: ${err.message}`);
        reject(err);
      });
    };
    
    makeRequest(url);
  });
}

async function testMorganPageExtraction() {
  console.log('🧪 Morgan Library Page Extraction Debug Test\n');
  console.log('=' .repeat(60));
  
  for (const test of testUrls) {
    console.log(`\n\n🔹 Testing: ${test.name}`);
    console.log(`URL: ${test.url}`);
    console.log('-'.repeat(60));
    
    try {
      const response = await fetchUrl(test.url);
      
      if (response.statusCode === 404) {
        console.log('❌ Page not found (404)');
        continue;
      }
      
      // Look for the dropdown/navigation structure that might contain page links
      console.log('\n🔍 Looking for navigation/page structures...');
      
      // Check for "View all pages" or similar links
      const viewAllRegex = /href="([^"]*\/thumbs[^"]*)"/gi;
      const viewAllMatches = [...response.html.matchAll(viewAllRegex)];
      if (viewAllMatches.length > 0) {
        console.log(`\n✅ Found "View all pages" links:`);
        viewAllMatches.forEach((match, i) => {
          console.log(`   ${i + 1}. ${match[1]}`);
        });
      }
      
      // Check for individual page navigation
      const pageNavRegex = /<a[^>]*class="[^"]*page-link[^"]*"[^>]*href="([^"]+)"/gi;
      const pageNavMatches = [...response.html.matchAll(pageNavRegex)];
      if (pageNavMatches.length > 0) {
        console.log(`\n✅ Found page navigation links: ${pageNavMatches.length}`);
        pageNavMatches.slice(0, 5).forEach((match, i) => {
          console.log(`   ${i + 1}. ${match[1]}`);
        });
      }
      
      // Check for data attributes that might contain page info
      const dataPageRegex = /data-page-?(?:num|number|id)?="(\d+)"/gi;
      const dataPageMatches = [...response.html.matchAll(dataPageRegex)];
      if (dataPageMatches.length > 0) {
        console.log(`\n✅ Found data-page attributes: ${dataPageMatches.length}`);
        const uniquePages = [...new Set(dataPageMatches.map(m => m[1]))];
        console.log(`   Unique pages: ${uniquePages.join(', ')}`);
      }
      
      // Check for JavaScript variables that might contain page data
      if (response.html.includes('pageCount') || response.html.includes('totalPages')) {
        console.log('\n💡 Found JavaScript page count variables');
        const pageCountRegex = /(?:pageCount|totalPages|numPages)['":\s]*(\d+)/gi;
        const countMatches = [...response.html.matchAll(pageCountRegex)];
        if (countMatches.length > 0) {
          console.log(`   Page counts found: ${countMatches.map(m => m[1]).join(', ')}`);
        }
      }
      
      // Look for image gallery structures
      const galleryRegex = /<(?:div|ul|ol)[^>]*class="[^"]*(?:gallery|thumbnails?|pages?)[^"]*"[^>]*>/gi;
      const galleryMatches = [...response.html.matchAll(galleryRegex)];
      if (galleryMatches.length > 0) {
        console.log(`\n✅ Found gallery/thumbnail containers: ${galleryMatches.length}`);
      }
      
      // Sample the HTML structure around key areas
      const keyPhrases = ['View all pages', 'Browse pages', 'Page ', 'thumbnail', 'gallery'];
      for (const phrase of keyPhrases) {
        const index = response.html.toLowerCase().indexOf(phrase.toLowerCase());
        if (index !== -1) {
          console.log(`\n📋 HTML around "${phrase}":`);
          const start = Math.max(0, index - 200);
          const end = Math.min(response.html.length, index + 200);
          console.log(response.html.substring(start, end).replace(/\s+/g, ' '));
        }
      }
      
      // Check if we need to fetch a different URL
      if (test.url.includes('/collection/') && !test.url.endsWith('/thumbs')) {
        console.log('\n🔄 Checking /thumbs version...');
        const thumbsUrl = test.url + '/thumbs';
        const thumbsResponse = await fetchUrl(thumbsUrl, false);
        
        if (thumbsResponse.statusCode === 200) {
          console.log('✅ /thumbs page exists!');
          
          // Check for actual page links in thumbs page
          const pageLinkRegex = /href="\/collection\/[^/]+\/(\d+)"/gi;
          const pageLinks = [...thumbsResponse.html.matchAll(pageLinkRegex)];
          const uniquePageNumbers = [...new Set(pageLinks.map(m => m[1]))];
          
          console.log(`Found ${uniquePageNumbers.length} individual page links`);
          if (uniquePageNumbers.length > 0) {
            console.log(`Page numbers: ${uniquePageNumbers.slice(0, 10).join(', ')}${uniquePageNumbers.length > 10 ? '...' : ''}`);
          }
        } else if (thumbsResponse.statusCode === 301 || thumbsResponse.statusCode === 302) {
          console.log('⚠️  /thumbs URL redirects back to main page');
        } else {
          console.log(`❌ /thumbs page returns ${thumbsResponse.statusCode}`);
        }
      }
      
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n\n' + '='.repeat(60));
  console.log('✅ Test completed\n');
}

// Run the test
testMorganPageExtraction().catch(console.error);