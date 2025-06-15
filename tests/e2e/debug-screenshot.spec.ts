import { test, expect } from './helpers/electron';

test.describe('Debug Screenshots', () => {
  test('take screenshot to analyze queue state', async ({ page }) => {
    // Listen for console logs and errors with more detail
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      console.log(`PAGE ${type.toUpperCase()}:`, text);
    });
    
    page.on('pageerror', err => {
      console.log('PAGE ERROR:', err.message);
      console.log('ERROR STACK:', err.stack);
    });
    
    // Listen for network failures
    page.on('requestfailed', request => {
      console.log('NETWORK FAILED:', request.url(), request.failure()?.errorText);
    });
    
    // Listen for response errors
    page.on('response', response => {
      if (!response.ok()) {
        console.log('HTTP ERROR:', response.status(), response.url());
      }
    });
    
    // Wait for app to load
    await page.waitForLoadState('domcontentloaded');
    
    // Wait a bit more for Vue to render
    await page.waitForTimeout(3000);
    
    // Check page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Check if the main app div exists
    const appDiv = page.locator('[data-testid="download-queue"]');
    const appExists = await appDiv.isVisible();
    console.log('App div exists:', appExists);
    
    // Check if the basic app container exists
    const appContainer = page.locator('#app');
    const containerExists = await appContainer.isVisible();
    console.log('App container (#app) exists:', containerExists);
    
    // Check if electronAPI is available
    const electronAPIAvailable = await page.evaluate(() => {
      return typeof window.electronAPI !== 'undefined';
    });
    console.log('electronAPI available:', electronAPIAvailable);
    
    // Check Vue app mount status
    const vueAppMounted = await page.evaluate(() => {
      const appEl = document.getElementById('app');
      return appEl ? appEl.innerHTML.length > 0 : false;
    });
    console.log('Vue app has content:', vueAppMounted);
    
    // Get detailed DOM info
    const domInfo = await page.evaluate(() => {
      const body = document.body;
      const appEl = document.getElementById('app');
      
      return {
        bodyHTML: body ? body.innerHTML : 'No body',
        appExists: !!appEl,
        appInnerHTML: appEl ? appEl.innerHTML : 'No app element',
        documentReadyState: document.readyState,
        scriptTags: Array.from(document.scripts).map(s => ({
          src: s.src,
          type: s.type,
          loaded: s.readyState || 'unknown'
        })),
        hasVue: typeof window.Vue !== 'undefined',
        hasCreateApp: typeof window.createApp !== 'undefined'
      };
    });
    
    console.log('DOM Info:', JSON.stringify(domInfo, null, 2));
    
    // Try to manually check for JavaScript errors by evaluating a simple script
    try {
      await page.evaluate(() => {
        console.log('Manual eval test: JavaScript execution working');
        return 'JavaScript working';
      });
      console.log('JavaScript evaluation: WORKING');
    } catch (err) {
      console.log('JavaScript evaluation ERROR:', err);
    }
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'test-results/debug-initial-state.png',
      fullPage: true 
    });
    
    console.log('Initial screenshot taken');
    
    // Check queue items
    const queueItems = page.locator('[data-testid="queue-item"]');
    const itemCount = await queueItems.count();
    console.log(`Found ${itemCount} queue items`);
    
    if (itemCount > 0) {
      // Take a screenshot showing the queue items
      await page.screenshot({ 
        path: 'test-results/debug-queue-with-items.png',
        fullPage: true 
      });
      
      // Check if clear button is visible
      const clearButton = page.locator('[data-testid="clear-completed"]');
      const clearVisible = await clearButton.isVisible();
      console.log(`Clear button visible: ${clearVisible}`);
      
      if (clearVisible) {
        // Highlight the clear button and take screenshot
        await clearButton.scrollIntoViewIfNeeded();
        await page.screenshot({ 
          path: 'test-results/debug-clear-button-visible.png',
          fullPage: true 
        });
        
        // Click the clear button
        await clearButton.click();
        console.log('Clicked clear button');
        
        // Wait a moment and take screenshot
        await page.waitForTimeout(1000);
        await page.screenshot({ 
          path: 'test-results/debug-after-clear-click.png',
          fullPage: true 
        });
        
        // Check for confirmation dialog
        const confirmButton = page.locator('[data-testid="confirm-delete"]');
        const confirmVisible = await confirmButton.isVisible();
        console.log(`Confirm button visible: ${confirmVisible}`);
        
        if (confirmVisible) {
          await page.screenshot({ 
            path: 'test-results/debug-confirm-dialog-visible.png',
            fullPage: true 
          });
          
          // Click confirm
          await confirmButton.click();
          console.log('Clicked confirm button');
          
          // Wait and take final screenshot
          await page.waitForTimeout(2000);
          await page.screenshot({ 
            path: 'test-results/debug-after-confirm.png',
            fullPage: true 
          });
          
          const finalCount = await queueItems.count();
          console.log(`Final queue item count: ${finalCount}`);
        }
      }
    }
    
    // Check if URL input is visible (might be hidden when queue has items)
    const urlInput = page.locator('[data-testid="url-input"]');
    const urlInputVisible = await urlInput.isVisible();
    console.log(`URL input visible: ${urlInputVisible}`);
    
    // Check for empty queue message
    const emptyMessage = page.locator('[data-testid="empty-queue-message"]');
    const emptyMessageVisible = await emptyMessage.isVisible();
    console.log(`Empty queue message visible: ${emptyMessageVisible}`);
  });
});