const https = require('https');

async function analyzeDownloadLinks(url) {
  console.log('\n🔍 Analyzing download link patterns');
  console.log('URL:', url);
  console.log('-'.repeat(60));
  
  const response = await fetchUrl(url);
  
  if (response.statusCode !== 200) {
    console.log(`❌ Failed to fetch page: ${response.statusCode}`);
    return;
  }
  
  // Look for various patterns that might be download links
  const patterns = [
    { name: 'Standard download pattern', regex: /href="([^"]*\/download\/[^"]*\.jpg[^"]*)"/gi },
    { name: 'IIIF image links', regex: /src="([^"]*iiif[^"]*\.jpg[^"]*)"/gi },
    { name: 'Morgan host links', regex: /(?:src|href)="([^"]*host\.themorgan\.org[^"]*\.(?:jpg|zif)[^"]*)"/gi },
    { name: 'Image collection links', regex: /(?:src|href)="([^"]*\/images\/collection\/[^"]*\.jpg[^"]*)"/gi },
    { name: 'Sites default files', regex: /src="([^"]*\/sites\/default\/files[^"]*\.jpg[^"]*)"/gi },
    { name: 'Any .jpg links', regex: /(?:src|href)="([^"]*\.jpg[^"]*)"/gi }
  ];
  
  for (const pattern of patterns) {
    const matches = [...response.html.matchAll(pattern.regex)];
    if (matches.length > 0) {
      console.log(`\n✅ ${pattern.name}: ${matches.length} matches`);
      // Show first few unique matches
      const unique = [...new Set(matches.map(m => m[1]))];
      unique.slice(0, 3).forEach((match, i) => {
        console.log(`   ${i + 1}. ${match}`);
      });
      if (unique.length > 3) {
        console.log(`   ... and ${unique.length - 3} more`);
      }
    } else {
      console.log(`\n❌ ${pattern.name}: 0 matches`);
    }
  }
  
  // Look for data attributes that might contain image info
  console.log('\n📊 Checking data attributes:');
  const dataPatterns = [
    /data-(?:image|src|url|file)="([^"]*)"/gi,
    /data-.*-(?:image|src|url|file)="([^"]*)"/gi
  ];
  
  for (const pattern of dataPatterns) {
    const matches = [...response.html.matchAll(pattern)];
    if (matches.length > 0) {
      console.log(`Found ${matches.length} data attributes with image info`);
      matches.slice(0, 3).forEach((match, i) => {
        if (match[1].includes('.jpg') || match[1].includes('image')) {
          console.log(`   ${match[0]}`);
        }
      });
    }
  }
  
  // Check for JavaScript variables
  console.log('\n💻 Checking JavaScript variables:');
  if (response.html.includes('imageUrl') || response.html.includes('downloadUrl')) {
    const jsMatches = response.html.match(/(?:imageUrl|downloadUrl|imageSrc)['":\s]*["']([^"']+\.jpg[^"']*)/gi);
    if (jsMatches) {
      console.log('Found JavaScript image variables:');
      jsMatches.slice(0, 3).forEach(match => {
        console.log(`   ${match}`);
      });
    }
  }
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

// Test individual pages from different manuscripts
const testPages = [
  'https://www.themorgan.org/collection/lindau-gospels/1',
  'https://www.themorgan.org/collection/lindau-gospels/2',
  'https://www.themorgan.org/collection/arenberg-gospels/1'
];

async function runTests() {
  console.log('🧪 Morgan Library Download Link Analysis\n');
  console.log('=' .repeat(60));
  
  for (const url of testPages) {
    console.log('\n' + '='.repeat(60));
    await analyzeDownloadLinks(url);
  }
  
  console.log('\n\n' + '='.repeat(60));
  console.log('✅ Analysis complete\n');
}

runTests().catch(console.error);