import { test, expect } from './helpers/electron';

test.describe('Download Debug', () => {
  test('debug why Gallica downloads are stuck at 0%', async ({ page }) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    console.log('Starting download debug for Gallica...');
    
    // Clear any existing queue items
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
    
    // Add Gallica manuscript
    const addMoreButton = page.locator('button:has-text("Add More Documents")');
    if (await addMoreButton.isVisible()) {
      await addMoreButton.click();
      await page.waitForTimeout(500);
    }
    
    const gallicaUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b8449691v/f1.highres';
    const urlInput = page.locator('textarea').first();
    const addButton = page.locator('button').filter({ hasText: /Add|Submit/ }).first();
    
    if (await urlInput.isVisible()) {
      await urlInput.fill(gallicaUrl);
      if (await addButton.isVisible() && await addButton.isEnabled()) {
        await addButton.click();
      }
    }
    
    await page.screenshot({ 
      path: `test-results/${timestamp}-debug-01-added-gallica.png`,
      fullPage: true 
    });
    
    // Wait for manifest loading
    console.log('Waiting for Gallica manifest to load...');
    const queueItem = page.locator('[data-testid="queue-item"]').first();
    let manifestLoaded = false;
    
    for (let attempt = 0; attempt < 15; attempt++) {
      await page.waitForTimeout(2000);
      
      const titleElement = queueItem.locator('strong');
      const currentTitle = await titleElement.textContent();
      
      if (currentTitle && !currentTitle.includes('Loading manifest')) {
        manifestLoaded = true;
        console.log(`✓ Manifest loaded: ${currentTitle}`);
        break;
      }
      
      // Check for failure
      const statusBadge = queueItem.locator('.status-badge');
      const status = await statusBadge.textContent();
      if (status?.toLowerCase().includes('failed')) {
        console.log(`❌ Manifest failed: ${status}`);
        break;
      }
    }
    
    await page.screenshot({ 
      path: `test-results/${timestamp}-debug-02-manifest-loaded.png`,
      fullPage: true 
    });
    
    if (!manifestLoaded) {
      console.log('❌ Manifest did not load, stopping test');
      return;
    }
    
    // Configure 30MB auto-split threshold
    const settingsButton = page.locator('.spoiler-trigger').first();
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(500);
      
      const globalThresholdSlider = page.locator('input[type="range"]').first();
      if (await globalThresholdSlider.isVisible()) {
        await globalThresholdSlider.fill('30');
        console.log('✓ Set auto-split threshold to 30MB');
      }
      
      await settingsButton.click(); // Close settings
      await page.waitForTimeout(500);
    }
    
    await page.screenshot({ 
      path: `test-results/${timestamp}-debug-03-settings-configured.png`,
      fullPage: true 
    });
    
    // Start download
    const startButton = page.locator('button.start-btn, button:has-text("Resume Queue")').first();
    const isVisible = await startButton.isVisible();
    const isEnabled = await startButton.isEnabled();
    
    console.log(`Start button - visible: ${isVisible}, enabled: ${isEnabled}`);
    
    if (isVisible && isEnabled) {
      await startButton.click();
      console.log('✓ Clicked start button');
      
      await page.screenshot({ 
        path: `test-results/${timestamp}-debug-04-download-started.png`,
        fullPage: true 
      });
      
      // Monitor download progress for 2 minutes
      for (let check = 0; check < 40; check++) {
        await page.waitForTimeout(3000);
        
        // Check queue status
        const titleElement = queueItem.locator('strong');
        const currentTitle = await titleElement.textContent();
        
        // Look for status badge
        const statusBadge = queueItem.locator('.status-badge');
        const status = await statusBadge.textContent();
        
        // Look for progress text
        const progressElements = queueItem.locator('*').filter({ hasText: /Downloading|Progress|pages|\d+%/ });
        const progressCount = await progressElements.count();
        
        let progressTexts = [];
        for (let i = 0; i < progressCount; i++) {
          const text = await progressElements.nth(i).textContent();
          if (text && text.trim()) {
            progressTexts.push(text.trim());
          }
        }
        
        console.log(`Check ${check + 1}/40:`);
        console.log(`  Title: ${currentTitle}`);
        console.log(`  Status: ${status}`);
        console.log(`  Progress texts: ${progressTexts.join(', ')}`);
        
        // Check if auto-split happened
        if (currentTitle && currentTitle.includes('Part_')) {
          console.log(`✓ Auto-split detected: ${currentTitle}`);
        }
        
        // Check if we have actual numerical progress
        const hasNumericalProgress = progressTexts.some(text => 
          text.match(/Downloading \d+ of \d+/) && 
          !text.includes('Downloading 0 of')
        );
        
        if (hasNumericalProgress) {
          console.log(`✓ Real download progress detected!`);
          break;
        }
        
        // Check if completed
        if (status && (status.toLowerCase().includes('completed') || status.toLowerCase().includes('success'))) {
          console.log(`✓ Download completed!`);
          break;
        }
        
        // Check if failed
        if (status && status.toLowerCase().includes('failed')) {
          console.log(`❌ Download failed: ${status}`);
          break;
        }
        
        // Take periodic screenshots
        if (check % 8 === 0) {
          await page.screenshot({ 
            path: `test-results/${timestamp}-debug-progress-${Math.floor(check/8)}.png`,
            fullPage: true 
          });
        }
      }
      
      await page.screenshot({ 
        path: `test-results/${timestamp}-debug-05-final-state.png`,
        fullPage: true 
      });
      
    } else {
      console.log('❌ Start button not available');
    }
    
    // Check if any PDFs were created
    console.log('Checking for PDF files...');
    const downloadPath = await page.evaluate(() => {
      return window.electronAPI ? window.electronAPI.getDownloadPath() : null;
    });
    
    if (downloadPath) {
      console.log(`Download path: ${downloadPath}`);
      // Additional debugging can be added here to check file system
    }
    
    console.log('Download debug test completed');
  });
});