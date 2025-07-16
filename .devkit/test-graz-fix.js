const { EnhancedManuscriptDownloaderService } = require('../src/main/services/EnhancedManuscriptDownloaderService');
const path = require('path');
const fs = require('fs').promises;

// Test URLs from user report
const testUrls = [
  'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
  'https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540', 
  'https://unipub.uni-graz.at/download/webcache/1504/8224544'
];

async function testGrazFix() {
  const testDir = path.join(__dirname, 'graz-test-' + Date.now());
  await fs.mkdir(testDir, { recursive: true });
  
  const service = new EnhancedManuscriptDownloaderService();
  
  for (const url of testUrls) {
    console.log(`\n📋 Testing URL: ${url}`);
    
    try {
      // Test manifest loading
      const manifest = await service.loadGrazManifest(url);
      
      console.log(`✅ Manifest loaded successfully!`);
      console.log(`   Title: ${manifest.displayName}`);
      console.log(`   Total pages: ${manifest.totalPages}`);
      console.log(`   First page URL: ${manifest.pageLinks[0]}`);
      
      // Download first 3 pages for validation
      console.log(`\n📥 Downloading first 3 pages for validation...`);
      const pagesToTest = Math.min(3, manifest.pageLinks.length);
      
      for (let i = 0; i < pagesToTest; i++) {
        const pageUrl = manifest.pageLinks[i];
        console.log(`   Downloading page ${i + 1}: ${pageUrl}`);
        
        const response = await service.fetchDirect(pageUrl);
        if (!response.ok) {
          console.log(`   ❌ Failed to download page ${i + 1}: HTTP ${response.status}`);
        } else {
          const buffer = await response.arrayBuffer();
          const imageFile = path.join(testDir, `${path.basename(url).replace(/[^a-zA-Z0-9]/g, '_')}_page_${i + 1}.jpg`);
          await fs.writeFile(imageFile, Buffer.from(buffer));
          console.log(`   ✅ Page ${i + 1} downloaded: ${Buffer.from(buffer).length} bytes`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log(`\n✅ Test results saved to: ${testDir}`);
}

testGrazFix().catch(console.error);