const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function analyzeBordeauxLibrary() {
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
  const apiRequests = [];
  
  page.on('request', request => {
    const url = request.url();
    requests.push({
      url,
      method: request.method(),
      resourceType: request.resourceType()
    });
    
    // Collect image-related requests
    if (url.match(/\.(jpg|jpeg|png|tif|tiff|dzi|xml)$/i) || 
        url.includes('_files/') || 
        url.includes('/tiles/') ||
        url.includes('/image/') ||
        url.includes('/iiif/')) {
      imageRequests.push(url);
    }
    
    // Collect API requests
    if (url.includes('/api/') || url.includes('/rest/')) {
      apiRequests.push({
        url,
        method: request.method()
      });
    }
  });
  
  page.on('response', response => {
    const url = response.url();
    if (url.match(/\.(dzi|xml)$/i)) {
      console.log(`DZI/XML Response: ${url} - Status: ${response.status()}`);
    }
  });
  
  console.log('Loading page...');
  let viewerFound = null;
  
  try {
    await page.goto('https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778', {
      waitUntil: 'networkidle',
      timeout: 60000
    });
    
    console.log('Page loaded, waiting for viewer...');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: path.join(__dirname, 'bordeaux-initial.png') });
    
    // Handle cookie modal if present
    try {
      // Check for cookie modal
      const cookieModal = await page.$('#cookie-modal, [aria-label*="Cookie"], .cookie-banner, .cookie-consent');
      if (cookieModal) {
        console.log('Cookie modal detected');
        // Look for accept/close button
        const acceptButton = await page.$('#cookie-modal button, .cookie-banner button, button:has-text("Accept"), button:has-text("Accepter"), button:has-text("Fermer"), button:has-text("Close")');
        if (acceptButton) {
          console.log('Clicking cookie accept/close button...');
          await acceptButton.click();
          await page.waitForTimeout(2000);
        }
      }
    } catch (e) {
      console.log('Cookie modal handling error:', e.message);
    }
    
    // Wait for potential viewer initialization
    await page.waitForTimeout(5000);
    
    // Try to find viewer elements
    const viewerSelectors = [
      '.openseadragon-container',
      '.viewer-container',
      '#viewer',
      '.image-viewer',
      'canvas',
      '[data-viewer]',
      '.dzi-viewer',
      '.tile-container'
    ];
    
    for (const selector of viewerSelectors) {
      const element = await page.$(selector);
      if (element) {
        viewerFound = selector;
        console.log(`Found viewer element: ${selector}`);
        break;
      }
    }
    
    // Check for OpenSeadragon
    const hasOpenSeadragon = await page.evaluate(() => {
      return typeof window.OpenSeadragon !== 'undefined';
    });
    
    if (hasOpenSeadragon) {
      console.log('OpenSeadragon detected!');
      
      // Try to get viewer instance
      const viewerInfo = await page.evaluate(() => {
        if (window.OpenSeadragon && window.OpenSeadragon.viewer) {
          const viewer = window.OpenSeadragon.viewer;
          return {
            source: viewer.source,
            tileSources: viewer.tileSources
          };
        }
        return null;
      });
      
      if (viewerInfo) {
        console.log('Viewer info:', JSON.stringify(viewerInfo, null, 2));
      }
    }
    
    // Look for DZI configuration in page
    const dziConfig = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const content = script.textContent || '';
        if (content.includes('.dzi') || content.includes('tileSources')) {
          return content.substring(0, 1000); // First 1000 chars
        }
      }
      return null;
    });
    
    if (dziConfig) {
      console.log('Found DZI configuration in script:', dziConfig);
    }
    
    // Try clicking on the image to trigger loading
    try {
      const imageElement = await page.$('img[src*="ark"], img[src*="330636101"], .viewer-image, .document-image');
      if (imageElement) {
        console.log('Found image element, attempting click...');
        await imageElement.click({ timeout: 5000 });
        await page.waitForTimeout(3000);
      }
    } catch (clickError) {
      console.log('Could not click image element:', clickError.message);
    }
    
    // Check for iframe
    const iframe = await page.$('iframe');
    if (iframe) {
      const iframeSrc = await iframe.getAttribute('src');
      console.log('Found iframe:', iframeSrc);
    }
    
  } catch (error) {
    console.error('Error during analysis:', error);
  }
  
  // Save results
  const results = {
    timestamp: new Date().toISOString(),
    url: 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778',
    viewerFound: viewerFound || 'Not found',
    hasOpenSeadragon: hasOpenSeadragon || false,
    totalRequests: requests.length,
    imageRequests: imageRequests.slice(0, 50), // First 50 image requests
    apiRequests: apiRequests.slice(0, 50), // First 50 API requests
    allRequests: requests.filter(r => !r.url.includes('.css') && !r.url.includes('.js')).slice(0, 100)
  };
  
  await fs.writeFile(
    path.join(__dirname, 'bordeaux-network-analysis.json'),
    JSON.stringify(results, null, 2)
  );
  
  console.log('\nAnalysis Summary:');
  console.log(`- Total requests: ${requests.length}`);
  console.log(`- Image requests: ${imageRequests.length}`);
  console.log(`- API requests: ${apiRequests.length}`);
  console.log(`- Viewer found: ${viewerFound || 'No'}`);
  console.log(`- OpenSeadragon: ${hasOpenSeadragon ? 'Yes' : 'No'}`);
  
  if (imageRequests.length > 0) {
    console.log('\nSample image requests:');
    imageRequests.slice(0, 5).forEach(url => console.log(`  - ${url}`));
  }
  
  if (apiRequests.length > 0) {
    console.log('\nSample API requests:');
    apiRequests.slice(0, 5).forEach(req => console.log(`  - ${req.method} ${req.url}`));
  }
  
  await browser.close();
}

analyzeBordeauxLibrary().catch(console.error);