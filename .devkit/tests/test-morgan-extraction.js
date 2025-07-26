const https = require('https');

// Test URLs - using actual working Morgan Library URLs from the codebase
const testUrls = [
  {
    name: 'Lindau Gospels with /thumbs',
    original: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
    withThumbs: 'https://www.themorgan.org/collection/lindau-gospels/thumbs'
  },
  {
    name: 'Gospel Book without /thumbs',
    original: 'https://www.themorgan.org/collection/gospel-book',
    withThumbs: 'https://www.themorgan.org/collection/gospel-book/thumbs'
  },
  {
    name: 'Gospel Book with page number',
    original: 'https://www.themorgan.org/collection/gospel-book/159129',
    withThumbs: 'https://www.themorgan.org/collection/gospel-book/159129/thumbs'
  },
  {
    name: 'ICA manuscript format',
    original: 'https://ica.themorgan.org/manuscript/thumbs/159109',
    withThumbs: 'https://ica.themorgan.org/manuscript/thumbs/159109'
  }
];

// The regex patterns from the main code
const pageRegex = /href="\/manuscript\/\d+\/(\d+)"/g;
const collectionPageRegex = /\/collection\/[^/]+\/(\d+)/g;

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    console.log(`\n📡 Fetching: ${url}`);
    
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
        console.log(`✅ Response received: ${res.statusCode}, length: ${data.length}`);
        resolve(data);
      });
    }).on('error', err => {
      console.error(`❌ Error fetching URL: ${err.message}`);
      reject(err);
    });
  });
}

function extractPages(html, url) {
  console.log(`\n🔍 Extracting pages from ${url}`);
  
  // Try both regex patterns
  const patterns = [
    { name: 'manuscript pattern', regex: pageRegex },
    { name: 'collection pattern', regex: collectionPageRegex }
  ];
  
  const pageNumbers = new Set();
  
  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern.regex)];
    console.log(`\n  Pattern: ${pattern.name}`);
    console.log(`  Found ${matches.length} total matches`);
    
    matches.forEach((match, index) => {
      const pageNum = match[1];
      pageNumbers.add(pageNum);
      if (index < 5) { // Show first 5 matches for debugging
        console.log(`    Match ${index + 1}: ${match[0]}`);
      }
    });
    
    if (matches.length > 5) {
      console.log(`    ... and ${matches.length - 5} more matches`);
    }
  }
  
  const sortedPages = Array.from(pageNumbers).sort((a, b) => parseInt(a) - parseInt(b));
  console.log(`\n📄 Unique page numbers found: ${sortedPages.length}`);
  if (sortedPages.length > 0) {
    console.log(`Page numbers: ${sortedPages.slice(0, 10).join(', ')}${sortedPages.length > 10 ? '...' : ''}`);
  }
  
  // Show some sample HTML around collection links
  const sampleIndex = html.indexOf('/collection/');
  if (sampleIndex !== -1) {
    console.log('\n📋 Sample HTML around collection links:');
    const start = Math.max(0, sampleIndex - 100);
    const end = Math.min(html.length, sampleIndex + 300);
    console.log(html.substring(start, end));
  }
  
  return sortedPages;
}

async function testMorganExtraction() {
  console.log('🧪 Morgan Library Page Extraction Test\n');
  console.log('=' .repeat(60));
  
  for (const testCase of testUrls) {
    console.log(`\n\n🔹 Testing: ${testCase.name}`);
    console.log(`Original URL: ${testCase.original}`);
    console.log(`With /thumbs: ${testCase.withThumbs}`);
    console.log('-'.repeat(60));
    
    try {
      // Test the URL with /thumbs
      const html = await fetchUrl(testCase.withThumbs);
      const pages = extractPages(html, testCase.withThumbs);
      
      // Check if we need to follow redirects or if the page structure is different
      if (pages.length === 0) {
        console.log('\n⚠️  No pages found! Checking HTML structure...');
        
        // Look for alternative patterns
        const altPatterns = [
          /href="[^"]*\/manuscript\/\d+\/(\d+)"/g,
          /data-page="(\d+)"/g,
          /page[_-]?(\d+)/gi
        ];
        
        for (const pattern of altPatterns) {
          const altMatches = [...html.matchAll(pattern)];
          if (altMatches.length > 0) {
            console.log(`Found ${altMatches.length} matches with alternative pattern: ${pattern}`);
            console.log(`First few matches: ${altMatches.slice(0, 3).map(m => m[0]).join(', ')}`);
          }
        }
        
        // Check if page might be using JavaScript
        if (html.includes('React') || html.includes('angular') || html.includes('vue')) {
          console.log('\n⚠️  Page appears to use JavaScript framework - content might be dynamically loaded');
        }
      }
      
      // Test if the original URL (without /thumbs) has different content
      if (!testCase.original.endsWith('/thumbs')) {
        console.log('\n🔄 Also checking original URL without /thumbs...');
        const originalHtml = await fetchUrl(testCase.original);
        const originalPages = extractPages(originalHtml, testCase.original);
        
        if (originalPages.length !== pages.length) {
          console.log(`\n⚡ Different results! Original URL has ${originalPages.length} pages vs ${pages.length} with /thumbs`);
        }
      }
      
    } catch (error) {
      console.error(`\n❌ Error testing ${testCase.name}: ${error.message}`);
    }
  }
  
  console.log('\n\n' + '='.repeat(60));
  console.log('✅ Test completed\n');
}

// Run the test
testMorganExtraction().catch(console.error);