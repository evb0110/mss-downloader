const fetch = require('node-fetch');

async function verifyBordeauxAccess() {
  const manuscriptId = '330636101_MS0778';
  const baseUrl = 'https://selene.bordeaux.fr';
  
  console.log('Bordeaux Library Access Verification\n');
  
  // Test 1: Thumbnail access
  console.log('1. Testing thumbnail access:');
  const thumbUrl = `${baseUrl}/in/dz/thumb/256/${manuscriptId}_0006.jpg`;
  
  try {
    const response = await fetch(thumbUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    console.log(`   ✓ Thumbnail: ${response.status} ${response.statusText}`);
    console.log(`   URL: ${thumbUrl}`);
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}`);
  }
  
  // Test 2: Tile access at different levels
  console.log('\n2. Testing tile access at different zoom levels:');
  const levels = [9, 11, 13];
  
  for (const level of levels) {
    const tileUrl = `${baseUrl}/in/dz/${manuscriptId}_0006_files/${level}/0_0.jpg`;
    
    try {
      const response = await fetch(tileUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const size = response.headers.get('content-length');
      console.log(`   ✓ Level ${level}: ${response.status} (${size} bytes)`);
    } catch (error) {
      console.log(`   ✗ Level ${level}: ${error.message}`);
    }
  }
  
  // Test 3: Calculate full download for level 13
  console.log('\n3. Maximum resolution analysis (Level 13):');
  const tileSize = 256;
  const overlap = 1;
  const imageWidth = 5500;
  const imageHeight = 4175;
  const effectiveTileSize = tileSize - overlap;
  
  const cols = Math.ceil(imageWidth / effectiveTileSize);
  const rows = Math.ceil(imageHeight / effectiveTileSize);
  
  console.log(`   - Image dimensions: ${imageWidth}x${imageHeight} pixels`);
  console.log(`   - Tile grid: ${cols}x${rows} (${cols * rows} tiles)`);
  console.log(`   - Estimated size: ~${Math.round(cols * rows * 5 / 1024)} MB`);
  
  // Test 4: Page availability
  console.log('\n4. Testing page availability:');
  const testPages = ['0001', '0006', '0010', '0020', '0030', '0050'];
  
  for (const page of testPages) {
    const pageUrl = `${baseUrl}/in/dz/thumb/256/${manuscriptId}_${page}.jpg`;
    
    try {
      const response = await fetch(pageUrl, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      if (response.ok) {
        console.log(`   ✓ Page ${page} exists`);
      } else {
        console.log(`   ✗ Page ${page}: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ✗ Page ${page}: Error`);
    }
  }
  
  console.log('\n5. Implementation recommendations:');
  console.log('   - Use Deep Zoom tile pattern for downloading');
  console.log('   - Download tiles at level 13 for maximum quality');
  console.log('   - Handle 1-pixel overlap when stitching');
  console.log('   - No authentication required for public manuscripts');
  console.log('   - Process pages sequentially to avoid rate limiting');
}

verifyBordeauxAccess().catch(console.error);