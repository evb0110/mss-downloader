const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const { Jimp } = require('jimp');

async function downloadTile(url, outputPath) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  
  const buffer = await response.buffer();
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

async function testBordeauxSimple() {
  // Using the information we discovered
  const manuscriptId = '330636101_MS0778';
  const pageNum = '0006';
  const baseUrl = 'https://selene.bordeaux.fr';
  
  // Known from our analysis
  const tileInfo = {
    width: 5500,
    height: 4175,
    tileSize: 256,
    overlap: 1,
    maxLevel: 13
  };
  
  // Create output directory
  const outputDir = path.join(__dirname, 'bordeaux-test-simple');
  await fs.mkdir(outputDir, { recursive: true });
  
  // Test 1: Download thumbnail
  console.log('Test 1: Downloading thumbnail...');
  const thumbUrl = `${baseUrl}/in/dz/thumb/256/${manuscriptId}_${pageNum}.jpg`;
  const thumbPath = path.join(outputDir, 'thumbnail.jpg');
  
  try {
    await downloadTile(thumbUrl, thumbPath);
    console.log('✓ Thumbnail downloaded successfully');
  } catch (error) {
    console.error('✗ Thumbnail download failed:', error.message);
  }
  
  // Test 2: Download a few tiles from different zoom levels
  console.log('\nTest 2: Downloading sample tiles from different zoom levels...');
  
  const levels = [9, 11, 13]; // Low, medium, high resolution
  
  for (const level of levels) {
    console.log(`\nLevel ${level}:`);
    
    // Download tile 0,0 (top-left) which should always exist
    const col = 0;
    const row = 0;
    
    const tileUrl = `${baseUrl}/in/dz/${manuscriptId}_${pageNum}_files/${level}/${col}_${row}.jpg`;
    const tilePath = path.join(outputDir, `tile_level${level}_0_0.jpg`);
    
    try {
      await downloadTile(tileUrl, tilePath);
      const stats = await fs.stat(tilePath);
      console.log(`✓ Tile 0,0 downloaded (${stats.size} bytes)`);
    } catch (error) {
      console.error(`✗ Failed:`, error.message);
    }
  }
  
  // Test 3: Download and stitch a small area at maximum resolution
  console.log('\nTest 3: Downloading and stitching a 2x2 tile area at maximum resolution...');
  
  const level = tileInfo.maxLevel;
  const effectiveTileSize = tileInfo.tileSize - tileInfo.overlap;
  
  // Download 2x2 tiles from top-left corner
  const tiles = [];
  for (let col = 0; col < 2; col++) {
    for (let row = 0; row < 2; row++) {
      const tileUrl = `${baseUrl}/in/dz/${manuscriptId}_${pageNum}_files/${level}/${col}_${row}.jpg`;
      const tilePath = path.join(outputDir, `tile_${level}_${col}_${row}.jpg`);
      
      try {
        console.log(`Downloading tile ${col},${row}...`);
        await downloadTile(tileUrl, tilePath);
        tiles.push({ path: tilePath, col, row });
      } catch (error) {
        console.error(`Failed to download tile ${col},${row}:`, error.message);
      }
    }
  }
  
  if (tiles.length === 4) {
    console.log('Stitching tiles...');
    
    // Create output image (2x2 tiles)
    const outputWidth = 2 * effectiveTileSize + tileInfo.overlap;
    const outputHeight = 2 * effectiveTileSize + tileInfo.overlap;
    const outputImage = new Jimp({width: outputWidth, height: outputHeight, color: 0xFFFFFFFF});
    
    for (const tile of tiles) {
      const tileImage = await Jimp.read(tile.path);
      
      // Calculate position
      const x = tile.col * effectiveTileSize;
      const y = tile.row * effectiveTileSize;
      
      // Handle overlap
      const cropX = tile.col === 0 ? 0 : tileInfo.overlap;
      const cropY = tile.row === 0 ? 0 : tileInfo.overlap;
      const cropW = tile.col === 0 ? tileInfo.tileSize : effectiveTileSize;
      const cropH = tile.row === 0 ? tileInfo.tileSize : effectiveTileSize;
      
      // Crop and composite
      const croppedTile = tileImage.crop(cropX, cropY, cropW, cropH);
      outputImage.composite(croppedTile, x, y);
    }
    
    const stitchedPath = path.join(outputDir, 'stitched_2x2.jpg');
    await outputImage.writeAsync(stitchedPath);
    console.log(`✓ Stitched image saved to ${stitchedPath}`);
  }
  
  // Test 4: Calculate full download requirements
  console.log('\nTest 4: Full download calculation for maximum resolution:');
  
  const fullCols = Math.ceil(tileInfo.width / effectiveTileSize);
  const fullRows = Math.ceil(tileInfo.height / effectiveTileSize);
  const totalTiles = fullCols * fullRows;
  
  console.log(`- Image dimensions: ${tileInfo.width}x${tileInfo.height}`);
  console.log(`- Tile grid: ${fullCols}x${fullRows}`);
  console.log(`- Total tiles needed: ${totalTiles}`);
  console.log(`- Estimated download size: ~${Math.round(totalTiles * 30 / 1024)} MB (assuming 30KB per tile)`);
  
  // Test 5: Check other pages
  console.log('\nTest 5: Checking availability of other pages...');
  const pageTests = ['0001', '0010', '0020', '0030'];
  
  for (const testPage of pageTests) {
    const testUrl = `${baseUrl}/in/dz/thumb/256/${manuscriptId}_${testPage}.jpg`;
    
    try {
      const response = await fetch(testUrl, { 
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      if (response.ok) {
        console.log(`✓ Page ${testPage} exists`);
      } else {
        console.log(`✗ Page ${testPage} not found (${response.status})`);
      }
    } catch (error) {
      console.log(`✗ Page ${testPage} error: ${error.message}`);
    }
  }
  
  console.log(`\nTest complete. Results saved to: ${outputDir}`);
}

testBordeauxSimple().catch(console.error);