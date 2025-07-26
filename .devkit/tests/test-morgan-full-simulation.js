const https = require('https');

// Simulate the exact Morgan Library extraction logic from the code
async function simulateFullMorganExtraction(morganUrl) {
  console.log('\n🔧 Full Morgan Library Extraction Simulation');
  console.log('URL:', morganUrl);
  console.log('-'.repeat(60));
  
  let baseUrl;
  let displayName = 'Morgan Document';
  
  // Determine base URL and display name
  if (morganUrl.includes('ica.themorgan.org')) {
    baseUrl = 'https://ica.themorgan.org';
  } else {
    const mainMatch = morganUrl.match(/themorgan\.org\/collection\/([^/]+)/);
    if (mainMatch) {
      displayName = mainMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    baseUrl = 'https://www.themorgan.org';
  }
  
  console.log('📚 Base URL:', baseUrl);
  console.log('📚 Display Name:', displayName);
  
  // Step 1: Prepare thumbs URL (this is what the code does)
  let thumbsUrl = morganUrl;
  if (!thumbsUrl.includes('/thumbs') && !thumbsUrl.includes('ica.themorgan.org') && !thumbsUrl.match(/\.(jpg|jpeg|png|gif)$/i)) {
    thumbsUrl = thumbsUrl.replace(/\/?$/, '/thumbs');
  }
  
  console.log('📝 Thumbs URL:', thumbsUrl);
  
  // Step 2: Fetch the thumbs page
  let pageContent = '';
  let fetchSuccess = false;
  
  try {
    const response = await fetchUrl(thumbsUrl);
    if (response.statusCode === 200) {
      pageContent = response.html;
      fetchSuccess = true;
      console.log('✅ Thumbs page fetched successfully');
    } else {
      console.log(`❌ Thumbs page failed: ${response.statusCode}`);
      
      // Try without /thumbs as fallback
      if (thumbsUrl !== morganUrl) {
        console.log('🔄 Trying without /thumbs...');
        const fallbackResponse = await fetchUrl(morganUrl);
        if (fallbackResponse.statusCode === 200) {
          pageContent = fallbackResponse.html;
          fetchSuccess = true;
          console.log('✅ Main page fetched successfully');
        }
      }
    }
  } catch (error) {
    console.log('❌ Fetch error:', error.message);
  }
  
  if (!fetchSuccess) {
    console.log('❌ Failed to fetch any page content');
    return;
  }
  
  // Step 3: Extract images using priority system (matching the code)
  const imagesByPriority = {
    0: [], // .zif files
    1: [], // High-res downloads
    2: [], // Direct full-size
    3: [], // Styled images converted
    4: [], // Facsimile images
    5: []  // Other direct references
  };
  
  const manuscriptMatch = morganUrl.match(/\/collection\/([^/]+)/);
  if (manuscriptMatch) {
    const manuscriptId = manuscriptMatch[1];
    console.log('\n📄 Extracting images for manuscript:', manuscriptId);
    
    // Priority 0: .zif files
    const imageIdRegex = /\/images\/collection\/([^"'?]+)\.jpg/g;
    const validImagePattern = /\d+v?_\d+/;
    
    let match;
    while ((match = imageIdRegex.exec(pageContent)) !== null) {
      const imageId = match[1];
      if (validImagePattern.test(imageId) && !imageId.includes('front-cover')) {
        const zifUrl = `https://host.themorgan.org/facsimile/images/${manuscriptId}/${imageId}.zif`;
        imagesByPriority[0].push(zifUrl);
      }
    }
    
    // Priority 1: High-res downloads from individual pages
    const pageUrlRegex = new RegExp(`\\/collection\\/${manuscriptId}\\/(\\d+)`, 'g');
    const pageMatches = [...pageContent.matchAll(pageUrlRegex)];
    const uniquePages = [...new Set(pageMatches.map(match => match[1]))];
    
    console.log(`   Found ${uniquePages.length} individual page references`);
    
    // Priority 2: Direct full-size images
    const fullSizeImageRegex = /\/sites\/default\/files\/images\/collection\/[^"'?]+\.jpg/g;
    const fullSizeMatches = pageContent.match(fullSizeImageRegex) || [];
    
    for (const match of fullSizeMatches) {
      const fullUrl = `${baseUrl}${match}`;
      imagesByPriority[2].push(fullUrl);
    }
    
    // Priority 3: Styled images converted to original
    const styledImageRegex = /\/sites\/default\/files\/styles\/[^"']*\/public\/images\/collection\/[^"'?]+\.jpg/g;
    const styledMatches = pageContent.match(styledImageRegex) || [];
    
    for (const match of styledMatches) {
      const originalPath = match.replace(/\/styles\/[^/]+\/public\//, '/');
      const fullUrl = `${baseUrl}${originalPath}`;
      imagesByPriority[3].push(fullUrl);
    }
    
    // Priority 4: Facsimile images (THIS IS WHAT WE SAW IN THE TEST!)
    const facsimileRegex = /\/sites\/default\/files\/facsimile\/[^"']+\.jpg/g;
    const facsimileMatches = pageContent.match(facsimileRegex) || [];
    
    for (const match of facsimileMatches) {
      const fullUrl = `${baseUrl}${match}`;
      imagesByPriority[4].push(fullUrl);
    }
    
    // Priority 5: Other direct references
    const directImageRegex = /https?:\/\/[^"']*themorgan\.org[^"']*\.jpg/g;
    const directMatches = pageContent.match(directImageRegex) || [];
    
    for (const match of directMatches) {
      if (match.includes('facsimile') || match.includes('images/collection')) {
        imagesByPriority[5].push(match);
      }
    }
  }
  
  // Step 4: Show results by priority
  console.log('\n📊 Images found by priority:');
  for (let priority = 0; priority <= 5; priority++) {
    const priorityNames = [
      '0 - Ultra high-res .zif files',
      '1 - High-res downloads',
      '2 - Direct full-size',
      '3 - Styled converted',
      '4 - Facsimile images',
      '5 - Other direct'
    ];
    
    console.log(`\n   ${priorityNames[priority]}: ${imagesByPriority[priority].length} images`);
    if (imagesByPriority[priority].length > 0) {
      imagesByPriority[priority].slice(0, 2).forEach((url, i) => {
        console.log(`     ${i + 1}. ${url}`);
      });
      if (imagesByPriority[priority].length > 2) {
        console.log(`     ... and ${imagesByPriority[priority].length - 2} more`);
      }
    }
  }
  
  // Step 5: Final page links (deduplicated)
  const pageLinks = [];
  const filenameMap = new Map();
  
  const getFilenameFromUrl = (url) => {
    const match = url.match(/([^/]+)\.(jpg|zif)$/);
    return match ? match[1] : url;
  };
  
  for (let priority = 0; priority <= 5; priority++) {
    for (const imageUrl of imagesByPriority[priority]) {
      const filename = getFilenameFromUrl(imageUrl);
      if (!filenameMap.has(filename)) {
        filenameMap.set(filename, imageUrl);
        pageLinks.push(imageUrl);
      }
    }
  }
  
  console.log(`\n✅ Total unique images: ${pageLinks.length}`);
  
  if (pageLinks.length === 0) {
    console.log('\n❌ NO IMAGES FOUND - This explains why only 1 page is offered!');
    console.log('\n🔍 Debugging: Checking for any .jpg references in HTML...');
    const anyJpgRegex = /[^"']*\.jpg/gi;
    const allJpgs = pageContent.match(anyJpgRegex) || [];
    console.log(`   Found ${allJpgs.length} total .jpg references`);
    if (allJpgs.length > 0) {
      console.log('   First few:');
      allJpgs.slice(0, 5).forEach((jpg, i) => {
        console.log(`     ${i + 1}. ${jpg}`);
      });
    }
  }
  
  return pageLinks.length;
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

// Test with various Morgan URLs
const testUrls = [
  'https://www.themorgan.org/collection/lindau-gospels',
  'https://www.themorgan.org/collection/lindau-gospels/thumbs',
  'https://www.themorgan.org/collection/arenberg-gospels'
];

async function runTests() {
  console.log('🧪 Morgan Library Full Extraction Simulation\n');
  console.log('=' .repeat(60));
  
  for (const url of testUrls) {
    console.log('\n' + '='.repeat(60));
    await simulateFullMorganExtraction(url);
  }
  
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 Summary:\n');
  console.log('The issue appears to be that the /thumbs URL pattern is outdated.');
  console.log('When /thumbs redirects or 404s, the fallback to main page should work,');
  console.log('but the facsimile images should still be found in priority 4.\n');
}

runTests().catch(console.error);