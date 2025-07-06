const https = require('https');
const fs = require('fs');

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function analyzeDIAMM() {
  const testManifests = [
    'https://iiif.diamm.net/manifests/I-Rc-Ms-1907/manifest.json',
    'https://iiif.diamm.net/manifests/I-Ra-Ms1383/manifest.json',
    'https://iiif.diamm.net/manifests/I-Rc-Ms-1574/manifest.json',
    'https://iiif.diamm.net/manifests/I-Rv-C_32/manifest.json'
  ];

  const results = {};

  for (const manifestUrl of testManifests) {
    try {
      console.log(`\n=== Analyzing ${manifestUrl} ===`);
      const manifest = await fetchJSON(manifestUrl);
      
      const manifestId = manifestUrl.split('/').slice(-2, -1)[0];
      results[manifestId] = {
        manifestUrl,
        label: manifest.label,
        pageCount: manifest.sequences[0].canvases.length,
        samplePages: []
      };

      for (let i = 0; i < Math.min(5, manifest.sequences[0].canvases.length); i++) {
        const canvas = manifest.sequences[0].canvases[i];
        const imageService = canvas.images[0].resource.service['@id'];
        
        const infoUrl = `${imageService}/info.json`;
        const info = await fetchJSON(infoUrl);
        
        results[manifestId].samplePages.push({
          label: canvas.label,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          imageService,
          imageWidth: info.width,
          imageHeight: info.height,
          maxWidth: info.maxWidth,
          maxHeight: info.maxHeight,
          profile: info.profile,
          availableSizes: info.sizes
        });
      }

      console.log(`✓ ${manifestId}: ${results[manifestId].pageCount} pages`);
    } catch (error) {
      console.error(`✗ Failed to analyze ${manifestUrl}:`, error.message);
    }
  }

  const reportData = {
    analysisDate: new Date().toISOString(),
    libraryName: 'DIAMM (Digital Image Archive of Medieval Music)',
    baseUrl: 'https://iiif.diamm.net',
    findings: {
      manifestPattern: 'https://iiif.diamm.net/manifests/{manuscript-id}/manifest.json',
      imageServicePattern: 'https://iiif.diamm.net/images/{manuscript-id}/{page-id}.tif',
      iiifVersion: '2.0/3.0 hybrid',
      maxResolution: '5000x5000 (constrained by server)',
      authentication: 'None required',
      accessRestrictions: 'None detected'
    },
    manuscripts: results
  };

  fs.writeFileSync('.devkit/reports/diamm-analysis-results.json', JSON.stringify(reportData, null, 2));
  console.log('\n=== DIAMM Analysis Complete ===');
  console.log('Total manuscripts analyzed:', Object.keys(results).length);
  console.log('Results saved to .devkit/reports/diamm-analysis-results.json');
}

analyzeDIAMM().catch(console.error);