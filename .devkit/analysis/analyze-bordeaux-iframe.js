const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function analyzeBordeauxIframe() {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  // Collect all network requests
  const requests = [];
  const imageRequests = [];
  const dziRequests = [];
  
  page.on('request', request => {
    const url = request.url();
    requests.push({
      url,
      method: request.method(),
      resourceType: request.resourceType()
    });
    
    // Collect image-related requests
    if (url.match(/\.(jpg|jpeg|png|tif|tiff)$/i) || 
        url.includes('_files/') || 
        url.includes('/tiles/') ||
        url.includes('/image/')) {
      imageRequests.push(url);
    }
    
    // Collect DZI-related requests
    if (url.match(/\.(dzi|xml)$/i) || url.includes('ImageProperties')) {
      dziRequests.push(url);
      console.log(`DZI/XML Request: ${url}`);
    }
  });
  
  page.on('response', async response => {
    const url = response.url();
    if (url.match(/\.(dzi|xml)$/i) || url.includes('ImageProperties')) {
      console.log(`DZI/XML Response: ${url} - Status: ${response.status()}`);
      if (response.status() === 200) {
        try {
          const content = await response.text();
          console.log(`DZI Content preview:`, content.substring(0, 500));
          // Save DZI content
          await fs.writeFile(
            path.join(__dirname, `dzi-${Date.now()}.xml`),
            content
          );
        } catch (e) {
          console.log('Could not read response:', e.message);
        }
      }
    }
  });
  
  // Direct iframe URL
  const iframeUrl = 'https://selene.bordeaux.fr/in/imageReader.xhtml?id=ark:/27705/330636101_MS_0778&locale=en&embedded=true&ark=ark:/27705/330636101_MS_0778';
  
  console.log('Loading iframe viewer directly...');
  try {
    await page.goto(iframeUrl, {
      waitUntil: 'networkidle',
      timeout: 60000
    });
    
    console.log('Iframe loaded, waiting for viewer initialization...');
    await page.waitForTimeout(5000);
    
    // Take screenshot
    await page.screenshot({ path: path.join(__dirname, 'bordeaux-iframe-viewer.png') });
    
    // Check for OpenSeadragon
    const viewerInfo = await page.evaluate(() => {
      const result = {
        hasOpenSeadragon: typeof window.OpenSeadragon !== 'undefined',
        viewerType: null,
        tileSources: null,
        dziUrl: null
      };
      
      // Check for OpenSeadragon
      if (window.OpenSeadragon) {
        result.viewerType = 'OpenSeadragon';
        // Try to find viewer instance
        for (const key in window) {
          if (window[key] && window[key].drawer && window[key].viewport) {
            const viewer = window[key];
            if (viewer.source) {
              result.tileSources = viewer.source;
            }
            if (viewer.tileSources) {
              result.tileSources = viewer.tileSources;
            }
            break;
          }
        }
      }
      
      // Look for DZI URLs in scripts
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const content = script.textContent || '';
        const dziMatch = content.match(/([^"'\s]+\.dzi)/i);
        if (dziMatch) {
          result.dziUrl = dziMatch[1];
        }
      }
      
      // Check for other viewer types
      if (window.Seadragon) result.viewerType = 'Seadragon';
      if (window.IIPViewer) result.viewerType = 'IIPViewer';
      
      return result;
    });
    
    console.log('Viewer info:', JSON.stringify(viewerInfo, null, 2));
    
    // Try to interact with the viewer
    const viewerElement = await page.$('canvas, .openseadragon-canvas, #viewer, .viewer');
    if (viewerElement) {
      console.log('Found viewer element, trying zoom...');
      // Try zoom in
      await viewerElement.dblclick();
      await page.waitForTimeout(2000);
      
      // Try pan
      await page.mouse.move(400, 300);
      await page.mouse.down();
      await page.mouse.move(200, 300);
      await page.mouse.up();
      await page.waitForTimeout(2000);
    }
    
    // Look for zoom controls
    const zoomIn = await page.$('[aria-label*="zoom in"], .zoomIn, .zoom-in, button[title*="Zoom in"]');
    if (zoomIn) {
      console.log('Found zoom in button, clicking...');
      await zoomIn.click();
      await page.waitForTimeout(2000);
    }
    
  } catch (error) {
    console.error('Error during iframe analysis:', error);
  }
  
  // Save results
  const results = {
    timestamp: new Date().toISOString(),
    iframeUrl,
    totalRequests: requests.length,
    imageRequests: imageRequests.slice(0, 100),
    dziRequests,
    uniqueImagePatterns: [...new Set(imageRequests.map(url => {
      const match = url.match(/(\d+_\d+\.(jpg|png))/);
      return match ? 'Tile pattern: ' + match[0] : url;
    }))].slice(0, 20)
  };
  
  await fs.writeFile(
    path.join(__dirname, 'bordeaux-iframe-analysis.json'),
    JSON.stringify(results, null, 2)
  );
  
  console.log('\nIframe Analysis Summary:');
  console.log(`- Total requests: ${requests.length}`);
  console.log(`- Image requests: ${imageRequests.length}`);
  console.log(`- DZI requests: ${dziRequests.length}`);
  
  if (imageRequests.length > 0) {
    console.log('\nSample image URLs:');
    imageRequests.slice(0, 10).forEach(url => console.log(`  - ${url}`));
  }
  
  await browser.close();
}

analyzeBordeauxIframe().catch(console.error);