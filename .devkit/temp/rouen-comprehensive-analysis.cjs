#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

// Test comprehensive Rouen library patterns
const testManuscripts = [
  {
    id: 'btv1b10052442z',
    title: 'Biblia sacra [Illustrations de]',
    totalPages: 93,
    testPages: [1, 46, 93]
  },
  {
    id: 'btv1b10052441h',
    title: 'Second manuscript',
    totalPages: 13,
    testPages: [1, 6, 13]
  },
  {
    id: 'btv1b100508259',
    title: 'Benedictionarium anglo-saxonicum',
    totalPages: 395,
    testPages: [1, 197, 395]
  }
];

const resolutions = ['highres', 'medres', 'lowres'];

function testImageAccess(manuscriptId, pageNumber, resolution) {
  const imageUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNumber}.${resolution}`;
  const viewerUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNumber}.item.zoom`;
  
  try {
    const result = execSync(`curl -s -w "%{http_code},%{size_download},%{content_type}" -c /tmp/rouen_cookies.txt -b /tmp/rouen_cookies.txt -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" -H "Referer: ${viewerUrl}" "${imageUrl}" -o /dev/null 2>/dev/null || echo "FAILED"`, { encoding: 'utf8' });
    
    if (result.includes('200')) {
      const [httpCode, sizeDownload, contentType] = result.trim().split(',');
      return {
        success: true,
        httpCode: parseInt(httpCode),
        size: parseInt(sizeDownload),
        contentType: contentType,
        url: imageUrl
      };
    } else {
      return {
        success: false,
        result: result.trim(),
        url: imageUrl
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      url: imageUrl
    };
  }
}

function testPageDiscovery(manuscriptId) {
  // Test how to discover total pages - try accessing the manifest or viewer page
  const viewerUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f1.item.zoom`;
  
  try {
    const pageContent = execSync(`curl -s -c /tmp/rouen_cookies.txt -b /tmp/rouen_cookies.txt -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" "${viewerUrl}" | grep -o 'totalNumberPage":[0-9]*' | head -1 || echo "NOT_FOUND"`, { encoding: 'utf8' });
    
    if (pageContent.includes('totalNumberPage')) {
      const match = pageContent.match(/totalNumberPage":(\d+)/);
      return match ? parseInt(match[1]) : null;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function comprehensiveRouenAnalysis() {
  console.log('🔍 Comprehensive Rouen Library Analysis\n');
  
  const results = {
    library: 'Rouen Municipal Library (rotomagus.fr)',
    urlPatterns: {
      viewer: 'https://www.rotomagus.fr/ark:/12148/{manuscriptId}/f{pageNumber}.item.zoom',
      image: 'https://www.rotomagus.fr/ark:/12148/{manuscriptId}/f{pageNumber}.{resolution}',
      imageAlt: 'https://www.rotomagus.fr/ark:/12148/{manuscriptId}/f{pageNumber}',
      manifest: 'https://www.rotomagus.fr/ark:/12148/{manuscriptId}/manifest.json'
    },
    availableResolutions: [],
    manuscripts: [],
    implementationSpecs: {}
  };

  // Initialize cookies
  execSync('rm -f /tmp/rouen_cookies.txt 2>/dev/null || true');

  for (const manuscript of testManuscripts) {
    console.log(`\n📖 Testing: ${manuscript.title} (${manuscript.id})`);
    
    const manuscriptResult = {
      id: manuscript.id,
      title: manuscript.title,
      declaredPages: manuscript.totalPages,
      discoveredPages: null,
      resolutionTests: {},
      pageTests: [],
      maxResolution: null,
      recommendedApproach: null
    };

    // Test page discovery
    console.log('  🔍 Testing page discovery...');
    manuscriptResult.discoveredPages = testPageDiscovery(manuscript.id);
    
    if (manuscriptResult.discoveredPages) {
      console.log(`  ✅ Discovered ${manuscriptResult.discoveredPages} pages`);
    } else {
      console.log('  ⚠️  Could not auto-discover page count');
    }

    // Test all resolutions for first page
    console.log('  🎯 Testing image resolutions...');
    for (const resolution of resolutions) {
      const test = testImageAccess(manuscript.id, 1, resolution);
      manuscriptResult.resolutionTests[resolution] = test;
      
      if (test.success) {
        console.log(`  ✅ ${resolution}: ${(test.size / 1024).toFixed(1)}KB (${test.contentType})`);
        
        if (!results.availableResolutions.includes(resolution)) {
          results.availableResolutions.push(resolution);
        }
        
        // Determine best resolution by size
        if (!manuscriptResult.maxResolution || test.size > manuscriptResult.resolutionTests[manuscriptResult.maxResolution].size) {
          manuscriptResult.maxResolution = resolution;
        }
      } else {
        console.log(`  ❌ ${resolution}: Failed`);
      }
    }

    // Test page range
    console.log('  📄 Testing page range...');
    for (const pageNum of manuscript.testPages) {
      const pageTest = testImageAccess(manuscript.id, pageNum, manuscriptResult.maxResolution || 'highres');
      manuscriptResult.pageTests.push({
        pageNumber: pageNum,
        success: pageTest.success,
        size: pageTest.success ? pageTest.size : null
      });
      
      if (pageTest.success) {
        console.log(`  ✅ Page ${pageNum}: ${(pageTest.size / 1024).toFixed(1)}KB`);
      } else {
        console.log(`  ❌ Page ${pageNum}: Failed`);
      }
    }

    // Test alternative URL pattern
    console.log('  🔄 Testing alternative URL patterns...');
    const altTest = testImageAccess(manuscript.id.replace('.', ''), 1, '');
    const baseUrl = `https://www.rotomagus.fr/ark:/12148/${manuscript.id}/f1`;
    const baseTest = execSync(`curl -I -c /tmp/rouen_cookies.txt -b /tmp/rouen_cookies.txt -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" -H "Referer: https://www.rotomagus.fr/ark:/12148/${manuscript.id}/f1.item.zoom" "${baseUrl}" 2>/dev/null | head -1 || echo "FAILED"`, { encoding: 'utf8' });
    
    if (baseTest.includes('200')) {
      console.log(`  ✅ Base URL works: ${baseUrl}`);
      manuscriptResult.recommendedApproach = 'base_url';
    } else {
      console.log(`  ❌ Base URL failed, using resolution suffix`);
      manuscriptResult.recommendedApproach = 'resolution_suffix';
    }

    results.manuscripts.push(manuscriptResult);
  }

  // Determine implementation specifications
  const successfulManuscripts = results.manuscripts.filter(m => 
    Object.values(m.resolutionTests).some(t => t.success) &&
    m.pageTests.every(p => p.success)
  );

  results.implementationSpecs = {
    authenticationRequired: false,
    sessionRequired: true,
    requiredHeaders: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Referer': 'https://www.rotomagus.fr/ark:/12148/{manuscriptId}/f{pageNumber}.item.zoom'
    },
    urlConstruction: {
      pattern: 'https://www.rotomagus.fr/ark:/12148/{manuscriptId}/f{pageNumber}.{resolution}',
      pageDiscovery: 'Parse viewer page for totalNumberPage JSON property',
      recommendedResolution: results.availableResolutions.includes('highres') ? 'highres' : results.availableResolutions[0]
    },
    pageNumbering: {
      format: 'f{number}',
      startPage: 1,
      sequential: true
    },
    successRate: `${successfulManuscripts.length}/${testManuscripts.length}`,
    implementationComplexity: 'Low - Direct URL construction with session cookies'
  };

  console.log('\n📊 Analysis Summary:');
  console.log(`✅ Success rate: ${results.implementationSpecs.successRate}`);
  console.log(`🎯 Available resolutions: ${results.availableResolutions.join(', ')}`);
  console.log(`🏆 Recommended resolution: ${results.implementationSpecs.urlConstruction.recommendedResolution}`);
  console.log(`🔧 Implementation: ${results.implementationSpecs.implementationComplexity}`);

  // Save detailed results
  fs.writeFileSync('.devkit/reports/rouen-comprehensive-analysis.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Detailed results saved to .devkit/reports/rouen-comprehensive-analysis.json');

  return results;
}

comprehensiveRouenAnalysis().catch(console.error);