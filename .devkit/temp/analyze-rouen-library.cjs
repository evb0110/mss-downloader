#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

// Test manuscripts
const testManuscripts = [
  {
    id: 'btv1b10052442z',
    url: 'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.item.zoom',
    expectedPages: 93
  },
  {
    id: 'btv1b10052441h', 
    url: 'https://www.rotomagus.fr/ark:/12148/btv1b10052441h/f1.item.zoom',
    expectedPages: 13
  },
  {
    id: 'btv1b100508259',
    url: 'https://www.rotomagus.fr/ark:/12148/btv1b100508259/f3.item.zoom', 
    expectedPages: 395
  },
  {
    id: 'btv1b101040278',
    url: 'https://www.rotomagus.fr/ark:/12148/btv1b101040278/f1.item.zoom',
    expectedPages: 313
  },
  {
    id: 'btv1b10050014d',
    url: 'https://www.rotomagus.fr/ark:/12148/btv1b10050014d/f1.item.zoom',
    expectedPages: 91
  }
];

const imageResolutions = ['highres', 'medres', 'lowres'];

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Request timeout: ${url}`));
    }, timeout);

    const req = https.request(url, options, (res) => {
      clearTimeout(timer);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        data: data
      }));
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error(`Socket timeout: ${url}`));
    });

    req.end();
  });
}

async function testImageURL(manuscriptId, pageNum, resolution) {
  const imageUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNum}.${resolution}`;
  
  try {
    const response = await fetchWithTimeout(imageUrl, { method: 'HEAD' });
    
    return {
      url: imageUrl,
      success: response.statusCode === 200,
      statusCode: response.statusCode,
      contentType: response.headers['content-type'],
      contentLength: response.headers['content-length'],
      contentDisposition: response.headers['content-disposition']
    };
  } catch (error) {
    return {
      url: imageUrl,
      success: false,
      error: error.message
    };
  }
}

async function testManifestAccess(manuscriptId) {
  const manifestUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/manifest.json`;
  
  try {
    const response = await fetchWithTimeout(manifestUrl);
    
    if (response.statusCode === 200) {
      try {
        const manifest = JSON.parse(response.data);
        return {
          url: manifestUrl,
          success: true,
          hasData: !!manifest,
          dataType: typeof manifest,
          keys: Object.keys(manifest).slice(0, 10) // First 10 keys
        };
      } catch (parseError) {
        return {
          url: manifestUrl,
          success: true,
          parseError: parseError.message,
          dataPreview: response.data.substring(0, 200)
        };
      }
    } else {
      return {
        url: manifestUrl,
        success: false,
        statusCode: response.statusCode
      };
    }
  } catch (error) {
    return {
      url: manifestUrl,
      success: false,
      error: error.message
    };
  }
}

async function analyzeRouenLibrary() {
  console.log('🔍 Analyzing Rouen Library (rotomagus.fr) URL Patterns\n');
  
  const results = {
    manuscripts: [],
    patterns: {
      imageUrlPattern: 'https://www.rotomagus.fr/ark:/12148/{manuscriptId}/f{pageNumber}.{resolution}',
      viewerUrlPattern: 'https://www.rotomagus.fr/ark:/12148/{manuscriptId}/f{pageNumber}.item.zoom',
      manifestUrlPattern: 'https://www.rotomagus.fr/ark:/12148/{manuscriptId}/manifest.json'
    },
    resolutionOptions: [],
    manifestSupport: false,
    overallAssessment: {}
  };

  // Test each manuscript
  for (const manuscript of testManuscripts) {
    console.log(`\n📖 Testing manuscript: ${manuscript.id}`);
    
    const manuscriptResult = {
      id: manuscript.id,
      expectedPages: manuscript.expectedPages,
      imageTests: [],
      manifestTest: null,
      pageValidation: []
    };

    // Test manifest access
    console.log('  Testing manifest access...');
    manuscriptResult.manifestTest = await testManifestAccess(manuscript.id);
    
    if (manuscriptResult.manifestTest.success) {
      results.manifestSupport = true;
      console.log('  ✅ Manifest accessible');
    } else {
      console.log('  ❌ Manifest not accessible');
    }

    // Test different image resolutions for first page
    console.log('  Testing image resolutions...');
    for (const resolution of imageResolutions) {
      const imageTest = await testImageURL(manuscript.id, 1, resolution);
      manuscriptResult.imageTests.push(imageTest);
      
      if (imageTest.success) {
        console.log(`  ✅ ${resolution}: ${imageTest.contentLength} bytes`);
        if (!results.resolutionOptions.includes(resolution)) {
          results.resolutionOptions.push(resolution);
        }
      } else {
        console.log(`  ❌ ${resolution}: ${imageTest.error || 'Failed'}`);
      }
    }

    // Test page range validation (test first, middle, and last pages)
    const testPages = [1, Math.floor(manuscript.expectedPages / 2), manuscript.expectedPages];
    console.log('  Testing page range...');
    
    for (const pageNum of testPages) {
      const pageTest = await testImageURL(manuscript.id, pageNum, 'highres');
      manuscriptResult.pageValidation.push({
        pageNumber: pageNum,
        success: pageTest.success,
        url: pageTest.url
      });
      
      if (pageTest.success) {
        console.log(`  ✅ Page ${pageNum} accessible`);
      } else {
        console.log(`  ❌ Page ${pageNum} failed`);
      }
    }

    results.manuscripts.push(manuscriptResult);
  }

  // Overall assessment
  const successfulManuscripts = results.manuscripts.filter(m => 
    m.imageTests.some(t => t.success) && 
    m.pageValidation.every(p => p.success)
  );

  results.overallAssessment = {
    totalTested: testManuscripts.length,
    successfulManuscripts: successfulManuscripts.length,
    manifestSupport: results.manifestSupport,
    availableResolutions: results.resolutionOptions,
    recommendedResolution: results.resolutionOptions.includes('highres') ? 'highres' : results.resolutionOptions[0],
    implementationApproach: 'Direct URL construction',
    authenticationRequired: false
  };

  console.log('\n📊 Analysis Results:');
  console.log(`✅ Successful manuscripts: ${results.overallAssessment.successfulManuscripts}/${results.overallAssessment.totalTested}`);
  console.log(`📋 Manifest support: ${results.manifestSupport ? 'Yes' : 'No'}`);
  console.log(`🎯 Available resolutions: ${results.resolutionOptions.join(', ')}`);
  console.log(`🏆 Recommended resolution: ${results.overallAssessment.recommendedResolution}`);

  // Save detailed results
  fs.writeFileSync('.devkit/reports/rouen-library-analysis.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Detailed results saved to .devkit/reports/rouen-library-analysis.json');

  return results;
}

// Run analysis
analyzeRouenLibrary().catch(console.error);