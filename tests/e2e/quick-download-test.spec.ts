import { test, expect } from './helpers/electron';

test.describe('Quick Download Test', () => {
  
  test('should test basic download functionality with different libraries', async ({ page }) => {
    // Wait for app to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Test libraries to try
    const testUrls = [
      {
        name: 'E-codices',
        url: 'https://www.e-codices.ch/en/sbe/0610/1'
      },
      {
        name: 'Vatican',
        url: 'https://digi.vatlib.it/view/MSS_Vat.lat.3225'
      }
    ];
    
    for (const testLib of testUrls) {
      console.log(`\n=== Testing ${testLib.name} ===`);
      
      // Take initial screenshot
      await page.screenshot({ 
        path: `test-results/${timestamp}-quick-${testLib.name}-initial.png`,
        fullPage: true 
      });
      
      // Clear queue if needed
      const deleteAllButton = page.locator('button:has-text("Delete All")');
      if (await deleteAllButton.isVisible() && await deleteAllButton.isEnabled()) {
        await deleteAllButton.click();
        await page.waitForTimeout(500);
        const confirmButton = page.locator('[data-testid="confirm-delete"]').first();
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
          await page.waitForTimeout(1000);
        }
      }
      
      // Add manuscript
      const addMoreButton = page.locator('button:has-text("Add More Documents")');
      if (await addMoreButton.isVisible()) {
        await addMoreButton.click();
        await page.waitForTimeout(500);
      }
      
      const urlInput = page.locator('textarea').first();
      const addButton = page.locator('button').filter({ hasText: /Add|Submit/ }).first();
      
      if (await urlInput.isVisible()) {
        await urlInput.fill(testLib.url);
        console.log(`✓ Filled URL: ${testLib.url}`);
        
        if (await addButton.isVisible() && await addButton.isEnabled()) {
          await addButton.click();
          console.log('✓ Clicked add button');
        }
      }
      
      // Wait for manifest loading
      await page.waitForTimeout(3000);
      const queueItem = page.locator('[data-testid="queue-item"]').first();
      
      // Check manifest loading
      let manifestLoaded = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        await page.waitForTimeout(2000);
        
        const titleElement = queueItem.locator('strong');
        const currentTitle = await titleElement.textContent();
        console.log(`Attempt ${attempt + 1}: Title="${currentTitle}"`);
        
        if (currentTitle && !currentTitle.includes('Loading manifest')) {
          manifestLoaded = true;
          console.log(`✓ ${testLib.name} manifest loaded: ${currentTitle}`);
          break;
        }
      }
      
      if (!manifestLoaded) {
        console.log(`❌ ${testLib.name} manifest failed to load`);
        continue;
      }
      
      // Try to start download
      const startButton = page.locator('button.start-btn, button:has-text("Resume Queue")').first();
      if (await startButton.isVisible() && await startButton.isEnabled()) {
        await startButton.click();
        console.log(`✓ Started download for ${testLib.name}`);
        
        // Take screenshot after starting
        await page.screenshot({ 
          path: `test-results/${timestamp}-quick-${testLib.name}-downloading.png`,
          fullPage: true 
        });
        
        // Check download progress for 30 seconds
        let progressDetected = false;
        for (let check = 0; check < 6; check++) {
          await page.waitForTimeout(5000);
          
          // Look for progress indicators
          const progressText = queueItem.locator('*').filter({ hasText: /\d+.*of.*\d+|\d+%/ });
          const hasProgress = await progressText.count() > 0;
          
          if (hasProgress) {
            const progressContent = await progressText.first().textContent();
            console.log(`${testLib.name}: Progress detected - ${progressContent}`);
            progressDetected = true;
            break;
          } else {
            console.log(`${testLib.name}: Check ${check + 1}/6 - No progress detected yet`);
          }
        }
        
        if (!progressDetected) {
          console.log(`❌ ${testLib.name}: No download progress detected`);
        } else {
          console.log(`✅ ${testLib.name}: Download progress working!`);
        }
      } else {
        console.log(`❌ ${testLib.name}: Start button not available`);
      }
      
      // Take final screenshot
      await page.screenshot({ 
        path: `test-results/${timestamp}-quick-${testLib.name}-final.png`,
        fullPage: true 
      });
    }
  });
});