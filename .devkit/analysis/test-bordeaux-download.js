const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const Jimp = require('jimp');

async function downloadTile(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  const buffer = await response.buffer();
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

async function testBordeauxDownload() {
  // Test with page 0006
  const manuscriptId = '330636101_MS0778';
  const pageNum = '0006';
  const baseUrl = 'https://selene.bordeaux.fr';
  
  // First, get the image dimensions using playwright
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const iframeUrl = `${baseUrl}/in/imageReader.xhtml?id=ark:/27705/330636101_MS_0778&locale=en&embedded=true`;
  
  console.log('Loading viewer to get image dimensions...');
  await page.goto(iframeUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Get tile source info
  const tileInfo = await page.evaluate(() => {
    if (window.OpenSeadragon) {
      for (const key in window) {
        if (window[key] && window[key].drawer && window[key].viewport) {
          const viewer = window[key];
          if (viewer.source) {
            return {
              width: viewer.source.width,
              height: viewer.source.height,
              tileSize: viewer.source._tileWidth || 256,
              overlap: viewer.source.tileOverlap || 1,
              maxLevel: viewer.source.maxLevel
            };
          }
        }
      }
    }
    return null;
  });
  
  await browser.close();
  
  if (!tileInfo) {
    throw new Error('Could not get tile information');
  }
  
  console.log('Image info:', tileInfo);
  
  // Create output directory
  const outputDir = path.join(__dirname, 'bordeaux-test-download');
  await fs.mkdir(outputDir, { recursive: true });
  
  // Download tiles from maximum zoom level
  const level = tileInfo.maxLevel;
  const tileSize = tileInfo.tileSize;
  const overlap = tileInfo.overlap;
  const effectiveTileSize = tileSize - overlap;
  
  // Calculate grid dimensions at this level
  const scale = Math.pow(2, level);
  const scaledWidth = Math.ceil(tileInfo.width / scale);
  const scaledHeight = Math.ceil(tileInfo.height / scale);
  
  // For DZI, at each level, the number of tiles is calculated differently
  const cols = Math.ceil(tileInfo.width / effectiveTileSize / Math.pow(2, tileInfo.maxLevel - level));
  const rows = Math.ceil(tileInfo.height / effectiveTileSize / Math.pow(2, tileInfo.maxLevel - level));
  
  console.log(`Downloading tiles: ${cols}x${rows} grid at level ${level}`);
  
  // Download a few sample tiles first
  const tilesToDownload = [];
  const maxSampleTiles = 9; // 3x3 grid for testing
  
  for (let col = 0; col < Math.min(cols, 3); col++) {
    for (let row = 0; row < Math.min(rows, 3); row++) {
      const tileUrl = `${baseUrl}/in/dz/${manuscriptId}_${pageNum}_files/${level}/${col}_${row}.jpg`;
      const tilePath = path.join(outputDir, `tile_${level}_${col}_${row}.jpg`);
      tilesToDownload.push({ url: tileUrl, path: tilePath, col, row });
    }
  }
  
  // Download tiles
  console.log(`Downloading ${tilesToDownload.length} sample tiles...`);
  const downloadedTiles = [];
  
  for (const tile of tilesToDownload) {
    try {
      console.log(`Downloading ${tile.col}_${tile.row}...`);
      await downloadTile(tile.url, tile.path);
      downloadedTiles.push(tile);
    } catch (error) {
      console.error(`Failed to download tile ${tile.col}_${tile.row}:`, error.message);
    }
  }
  
  console.log(`Downloaded ${downloadedTiles.length} tiles successfully`);
  
  // Stitch tiles together
  if (downloadedTiles.length > 0) {
    console.log('Stitching tiles...');
    
    // Calculate output dimensions for our sample
    const sampleCols = Math.min(cols, 3);
    const sampleRows = Math.min(rows, 3);
    const outputWidth = sampleCols * effectiveTileSize + overlap;
    const outputHeight = sampleRows * effectiveTileSize + overlap;
    
    // Create output image
    const outputImage = new Jimp(outputWidth, outputHeight);
    
    // Place tiles
    for (const tile of downloadedTiles) {
      try {
        const tileImage = await Jimp.read(tile.path);
        const x = tile.col * effectiveTileSize;
        const y = tile.row * effectiveTileSize;
        
        // Handle overlap by cropping tiles (except first row/col)
        let sx = tile.col === 0 ? 0 : overlap;
        let sy = tile.row === 0 ? 0 : overlap;
        let sw = tile.col === 0 ? tileSize : effectiveTileSize;
        let sh = tile.row === 0 ? tileSize : effectiveTileSize;
        
        outputImage.composite(tileImage.crop(sx, sy, sw, sh), x, y);
      } catch (error) {
        console.error(`Failed to process tile ${tile.col}_${tile.row}:`, error.message);
      }
    }
    
    const outputPath = path.join(outputDir, `bordeaux_sample_level${level}.jpg`);
    await outputImage.writeAsync(outputPath);
    console.log(`Sample stitched image saved to: ${outputPath}`);
  }
  
  // Also download a full resolution thumbnail for comparison
  const thumbUrl = `${baseUrl}/in/dz/thumb/256/${manuscriptId}_${pageNum}.jpg`;
  const thumbPath = path.join(outputDir, 'thumbnail.jpg');
  
  try {
    await downloadTile(thumbUrl, thumbPath);
    console.log('Thumbnail downloaded for comparison');
  } catch (error) {
    console.error('Failed to download thumbnail:', error.message);
  }
  
  console.log(`\nTest complete. Check ${outputDir} for results.`);
  console.log('\nFull implementation would need to:');
  console.log(`1. Download all ${cols * rows} tiles at level ${level}`);
  console.log(`2. Stitch them into a ${tileInfo.width}x${tileInfo.height} image`);
  console.log('3. Handle the 1-pixel overlap correctly');
  console.log('4. Process all pages in the manuscript');
}

testBordeauxDownload().catch(console.error);