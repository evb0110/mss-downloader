const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { createCanvas, loadImage } = require('canvas');

class BelgicaKbrPuppeteerAdapter {
  constructor() {
    this.name = 'belgica-kbr-puppeteer';
    this.description = 'Belgica KBR AjaxZoom system with Puppeteer automation for maximum resolution';
    this.supportedFormats = ['jpg'];
    this.GRID_WIDTH = 8;
    this.GRID_HEIGHT = 10;
    this.TILE_SIZE = 768;
    this.MAX_ZOOM = 3;
  }

  async validateUrl(url) {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname === 'belgica.kbr.be' &&
        urlObj.pathname.includes('/doc/') &&
        urlObj.pathname.includes('SYRACUSE')
      );
    } catch (error) {
      return false;
    }
  }

  async extractManuscriptInfo(browser, documentUrl) {
    const page = await browser.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      console.log('  Loading document page...');
      await page.goto(documentUrl, { waitUntil: 'networkidle2' });
      
      const uurlInfo = await page.evaluate(() => {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          const src = iframe.src;
          if (src && src.includes('uurl.kbr.be')) {
            const match = src.match(/uurl\\.kbr\\.be\\/(\\d+)/);
            return match ? { url: src, id: match[1] } : null;
          }
        }
        return null;
      });
      
      if (!uurlInfo) {
        throw new Error('Could not find UURL iframe in document page');
      }
      
      console.log(`  Found UURL: ${uurlInfo.url}`);
      
      await page.goto(uurlInfo.url, { waitUntil: 'networkidle2' });
      
      const galleryInfo = await page.evaluate(() => {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          const src = iframe.src;
          if (src && src.includes('gallery.php')) {
            const mapMatch = src.match(/map=([^&]*)/);
            return mapMatch ? { url: src, mapPath: mapMatch[1] } : null;
          }
        }
        return null;
      });
      
      if (!galleryInfo) {
        throw new Error('Could not find gallery iframe in UURL page');
      }
      
      console.log(`  Found gallery: ${galleryInfo.url}`);
      
      const documentIdMatch = documentUrl.match(/\\/([^\\/]+)$/);
      const documentId = documentIdMatch ? documentIdMatch[1] : 'unknown';
      
      return {
        documentId,
        uurlInfo,
        galleryInfo
      };
    } finally {
      await page.close();
    }
  }

  async interceptTileRequests(browser, galleryUrl) {
    const page = await browser.newPage();
    const interceptedTiles = [];
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.setRequestInterception(true);
      
      page.on('request', (request) => {
        request.continue();
      });
      
      page.on('response', async (response) => {
        const url = response.url();
        
        if (url.includes('axZm') && url.includes('.jpg') && response.status() === 200) {
          try {
            const buffer = await response.buffer();
            const urlMatch = url.match(/([^/]+)\\.jpg$/);
            const filename = urlMatch ? urlMatch[1] : 'unknown';
            
            interceptedTiles.push({
              url,
              filename,
              buffer,
              size: buffer.length
            });
            
            console.log(`    Intercepted tile: ${filename} (${buffer.length} bytes)`);
          } catch (error) {
            console.log(`    Failed to capture tile from ${url}: ${error.message}`);
          }
        }
      });
      
      console.log('  Loading gallery page...');
      await page.goto(galleryUrl, { waitUntil: 'networkidle2' });
      
      await page.waitForTimeout(3000);
      
      const ajaxZoomExists = await page.evaluate(() => {
        return typeof window.ajaxZoom !== 'undefined' || 
               document.querySelector('#axZm_zoomContainer') !== null ||
               document.querySelector('[id*="axZm"]') !== null;
      });
      
      if (ajaxZoomExists) {
        console.log('  AjaxZoom detected, attempting to trigger tile loading...');
        
        await page.evaluate(() => {
          const zoomElements = document.querySelectorAll('[id*="axZm"], [class*="axZm"]');
          for (const element of zoomElements) {
            element.click();
          }
        });
        
        await page.waitForTimeout(2000);
        
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        await page.waitForTimeout(2000);
        
        const zoomButtons = await page.$$('button, input[type="button"], a');
        for (const button of zoomButtons) {
          try {
            const text = await button.evaluate(el => el.textContent || el.value || el.title);
            if (text && (text.includes('zoom') || text.includes('+'))) {
              await button.click();
              await page.waitForTimeout(1000);
            }
          } catch (error) {
            // Ignore click errors
          }
        }
        
        await page.waitForTimeout(3000);
      }
      
      const allImages = await page.$$eval('img', imgs => 
        imgs.map(img => ({ src: img.src, width: img.width, height: img.height }))
      );
      
      console.log(`  Found ${allImages.length} images in gallery`);
      console.log(`  Intercepted ${interceptedTiles.length} tile requests`);
      
      return interceptedTiles;
    } finally {
      await page.close();
    }
  }

  async downloadManuscriptPage(documentUrl, outputPath) {
    let browser;
    
    try {
      console.log('Starting Puppeteer browser...');
      browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      console.log('\\nPhase 1: Extract manuscript information');
      const manuscriptInfo = await this.extractManuscriptInfo(browser, documentUrl);
      
      console.log('\\nPhase 2: Intercept tile requests');
      const interceptedTiles = await this.interceptTileRequests(browser, manuscriptInfo.galleryInfo.url);
      
      if (interceptedTiles.length === 0) {
        throw new Error('No tiles were intercepted during gallery interaction');
      }
      
      console.log('\\nPhase 3: Process intercepted tiles');
      
      const validTiles = interceptedTiles.filter(tile => {
        const isValidJpeg = tile.buffer.subarray(0, 2).toString('hex') === 'ffd8';
        return isValidJpeg && tile.buffer.length > 5000;
      });
      
      console.log(`  Valid tiles: ${validTiles.length}/${interceptedTiles.length}`);
      
      if (validTiles.length === 0) {
        throw new Error('No valid tiles found in intercepted data');
      }
      
      console.log('\\nPhase 4: Create composite image');
      
      const maxDimension = Math.max(this.GRID_WIDTH * this.TILE_SIZE, this.GRID_HEIGHT * this.TILE_SIZE);
      const canvas = createCanvas(maxDimension, maxDimension);
      const ctx = canvas.getContext('2d');
      
      let placedTiles = 0;
      
      for (let i = 0; i < validTiles.length; i++) {
        const tile = validTiles[i];
        const x = (i % this.GRID_WIDTH) * this.TILE_SIZE;
        const y = Math.floor(i / this.GRID_WIDTH) * this.TILE_SIZE;
        
        if (y + this.TILE_SIZE > maxDimension) {
          break;
        }
        
        try {
          const img = await loadImage(tile.buffer);
          ctx.drawImage(img, x, y, this.TILE_SIZE, this.TILE_SIZE);
          placedTiles++;
        } catch (error) {
          console.log(`  Failed to place tile ${i}: ${error.message}`);
        }
      }
      
      const imageBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
      fs.writeFileSync(outputPath, imageBuffer);
      
      console.log(`\\nResult saved to: ${outputPath}`);
      console.log(`Final dimensions: ${canvas.width}×${canvas.height} pixels`);
      console.log(`File size: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Tiles placed: ${placedTiles}/${validTiles.length}`);
      
      return {
        success: true,
        outputPath,
        dimensions: { width: canvas.width, height: canvas.height },
        fileSize: imageBuffer.length,
        tilesPlaced: placedTiles,
        totalTiles: validTiles.length,
        interceptedTiles: interceptedTiles.length
      };
    } catch (error) {
      throw new Error(`Puppeteer download failed: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async testFullWorkflow(documentUrl) {
    try {
      console.log('=== BELGICA KBR PUPPETEER ADAPTER TEST ===');
      console.log('');
      
      const isValidUrl = await this.validateUrl(documentUrl);
      console.log(`URL validation: ${isValidUrl ? 'PASSED' : 'FAILED'}`);
      
      if (!isValidUrl) {
        throw new Error('URL validation failed');
      }
      
      const outputPath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/belgica-kbr-puppeteer-result.jpg';
      const result = await this.downloadManuscriptPage(documentUrl, outputPath);
      
      console.log('\\n=== TEST SUMMARY ===');
      console.log('✓ Puppeteer-based approach completed');
      console.log(`✓ Manuscript page downloaded: ${result.outputPath}`);
      console.log(`✓ Resolution: ${result.dimensions.width}×${result.dimensions.height}`);
      console.log(`✓ File size: ${(result.fileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`✓ Tiles processed: ${result.tilesPlaced}/${result.totalTiles}`);
      console.log(`✓ Interception rate: ${result.interceptedTiles} requests captured`);
      
      return result;
    } catch (error) {
      console.error('\\n=== TEST FAILED ===');
      console.error(`Error: ${error.message}`);
      throw error;
    }
  }
}

async function runPuppeteerTest() {
  const adapter = new BelgicaKbrPuppeteerAdapter();
  const testUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
  
  try {
    const result = await adapter.testFullWorkflow(testUrl);
    
    console.log('\\n=== NEXT STEPS ===');
    console.log('1. Integrate this approach into the tile engine system');
    console.log('2. Add proper error handling and retry logic');
    console.log('3. Implement multi-page support');
    console.log('4. Add progress tracking for user feedback');
    console.log('5. Optimize performance and memory usage');
    console.log('6. Test with additional manuscripts');
    
    return true;
  } catch (error) {
    console.error('\\nPuppeteer test failed:', error.message);
    return false;
  }
}

if (require.main === module) {
  runPuppeteerTest()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { BelgicaKbrPuppeteerAdapter, runPuppeteerTest };