#!/usr/bin/env node

const { execSync } = require('child_process');

// Test different methods to discover total pages in Rouen manuscripts
function testPageDiscoveryMethods(manuscriptId) {
  console.log(`\n🔍 Testing page discovery for ${manuscriptId}`);
  
  const viewerUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f1.item.zoom`;
  
  try {
    // Method 1: Get the full page content and parse JSON
    console.log('  Method 1: Parsing viewer page JSON...');
    const pageContent = execSync(`curl -s -c /tmp/rouen_cookies.txt -b /tmp/rouen_cookies.txt -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" "${viewerUrl}"`, { encoding: 'utf8' });
    
    // Look for totalNumberPage or totalVues
    const totalPagesMatch = pageContent.match(/"totalNumberPage":(\d+)/);
    const totalVuesMatch = pageContent.match(/"totalVues":(\d+)/);
    const nbTotalVuesMatch = pageContent.match(/"nbTotalVues":(\d+)/);
    
    if (totalPagesMatch) {
      console.log(`  ✅ Found totalNumberPage: ${totalPagesMatch[1]}`);
      return parseInt(totalPagesMatch[1]);
    }
    
    if (totalVuesMatch) {
      console.log(`  ✅ Found totalVues: ${totalVuesMatch[1]}`);
      return parseInt(totalVuesMatch[1]);
    }
    
    if (nbTotalVuesMatch) {
      console.log(`  ✅ Found nbTotalVues: ${nbTotalVuesMatch[1]}`);
      return parseInt(nbTotalVuesMatch[1]);
    }

    // Method 2: Look for pagination info
    const paginationMatch = pageContent.match(/"vue (\d+)\/(\d+)"/);
    if (paginationMatch) {
      console.log(`  ✅ Found pagination info: ${paginationMatch[2]} total pages`);
      return parseInt(paginationMatch[2]);
    }

    // Method 3: Try manifest.json approach
    console.log('  Method 2: Trying manifest.json...');
    const manifestContent = execSync(`curl -s -c /tmp/rouen_cookies.txt -b /tmp/rouen_cookies.txt -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" "https://www.rotomagus.fr/ark:/12148/${manuscriptId}/manifest.json" | head -200`, { encoding: 'utf8' });
    
    if (manifestContent.includes('totalNumberPage')) {
      const manifestMatch = manifestContent.match(/"totalNumberPage":(\d+)/);
      if (manifestMatch) {
        console.log(`  ✅ Found in manifest: ${manifestMatch[1]}`);
        return parseInt(manifestMatch[1]);
      }
    }

    console.log('  ❌ Could not find page count');
    return null;
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }
}

// Test sequential page access to verify page ranges
function testPageSequence(manuscriptId, expectedPages) {
  console.log(`\n🔢 Testing page sequence for ${manuscriptId} (expecting ${expectedPages} pages)`);
  
  const testPages = [1, Math.floor(expectedPages/4), Math.floor(expectedPages/2), Math.floor(3*expectedPages/4), expectedPages];
  const results = [];
  
  for (const pageNum of testPages) {
    const imageUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNum}.highres`;
    const viewerUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNum}.item.zoom`;
    
    try {
      const result = execSync(`curl -s -w "%{http_code}" -c /tmp/rouen_cookies.txt -b /tmp/rouen_cookies.txt -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" -H "Referer: ${viewerUrl}" "${imageUrl}" -o /dev/null 2>/dev/null`, { encoding: 'utf8' });
      
      const success = result.trim() === '200';
      results.push({ page: pageNum, success });
      console.log(`  Page ${pageNum}: ${success ? '✅' : '❌'}`);
      
    } catch (error) {
      results.push({ page: pageNum, success: false });
      console.log(`  Page ${pageNum}: ❌ Error`);
    }
  }
  
  return results;
}

async function main() {
  console.log('🔍 Rouen Library Page Discovery Analysis\n');
  
  const testCases = [
    { id: 'btv1b10052442z', expected: 93 },
    { id: 'btv1b10052441h', expected: 13 },
    { id: 'btv1b100508259', expected: 395 }
  ];
  
  for (const testCase of testCases) {
    const discoveredPages = testPageDiscoveryMethods(testCase.id);
    
    if (discoveredPages) {
      console.log(`\n🎯 Discovered ${discoveredPages} pages (expected ${testCase.expected})`);
      
      if (discoveredPages === testCase.expected) {
        console.log('✅ Page count matches expected!');
      } else {
        console.log('⚠️  Page count differs from expected');
      }
      
      // Test page sequence
      const sequenceResults = testPageSequence(testCase.id, discoveredPages);
      const successfulPages = sequenceResults.filter(r => r.success).length;
      console.log(`📊 Page access success: ${successfulPages}/${sequenceResults.length}`);
    }
  }
  
  console.log('\n📋 Implementation Recommendation:');
  console.log('1. Use viewer page parsing to discover total pages');
  console.log('2. Look for "totalNumberPage", "totalVues", or "nbTotalVues" in JSON');
  console.log('3. Construct URLs: https://www.rotomagus.fr/ark:/12148/{id}/f{page}.highres');
  console.log('4. Required headers: User-Agent and Referer');
  console.log('5. Cookie session management recommended');
}

main().catch(console.error);