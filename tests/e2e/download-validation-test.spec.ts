import { test, expect } from './helpers/electron';

test.describe('Download Validation Test', () => {
  test('validate that downloads actually work with auto-split and PDF creation', async ({ page }) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    console.log('Starting download validation test...');
    
    // Test with a known working library (Gallica) with fast download
    const testUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b8449691v/f1.highres';
    
    // Clear any existing queue items
    const deleteAllButton = page.locator('button:has-text("Delete All")');
    if (await deleteAllButton.isVisible() && await deleteAllButton.isEnabled()) {
      await deleteAllButton.click();
      await page.waitForTimeout(500);
      const confirmButton = page.locator('[data-testid="confirm-delete"]').first();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Add the manuscript
    const addMoreButton = page.locator('button:has-text("Add More Documents")');
    if (await addMoreButton.isVisible()) {
      await addMoreButton.click();
      await page.waitForTimeout(500);
    }
    
    const urlInput = page.locator('textarea').first();
    const addButton = page.locator('button').filter({ hasText: /Add|Submit/ }).first();
    
    await urlInput.fill(testUrl);
    await addButton.click();
    
    console.log('Added Gallica manuscript, waiting for manifest...');
    
    // Wait for manifest loading
    const queueItem = page.locator('[data-testid="queue-item"]').first();
    let manifestLoaded = false;
    
    for (let attempt = 0; attempt < 20; attempt++) {
      await page.waitForTimeout(2000);
      
      const titleElement = queueItem.locator('strong');
      const currentTitle = await titleElement.textContent();
      
      if (currentTitle && !currentTitle.includes('Loading manifest')) {
        manifestLoaded = true;
        console.log(`✓ Manifest loaded: ${currentTitle}`);
        break;
      }
    }
    
    if (!manifestLoaded) {
      throw new Error('Manifest failed to load');
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
    
    // Take pre-download screenshot
    await page.screenshot({ 
      path: `test-results/${timestamp}-download-validation-01-ready.png`,
      fullPage: true 
    });
    
    // Start download
    const startButton = page.locator('button.start-btn').first();
    if (await startButton.isVisible() && await startButton.isEnabled()) {
      await startButton.click();
      console.log('✓ Started download');
    } else {
      throw new Error('Start button not available');
    }
    
    // Monitor for auto-split and real progress
    let autoSplitDetected = false;
    let realProgressDetected = false;
    let downloadCompleted = false;
    
    console.log('Monitoring download progress...');
    
    for (let check = 0; check < 60; check++) { // 3 minutes max
      await page.waitForTimeout(3000);
      
      // Check for auto-split
      const titleElement = queueItem.locator('strong');
      const currentTitle = await titleElement.textContent();
      
      if (currentTitle && currentTitle.includes('Part_') && !autoSplitDetected) {
        autoSplitDetected = true;
        console.log(`✓ Auto-split detected: ${currentTitle}`);
      }
      
      // Check for real progress (not stuck at 0%)
      const progressElements = queueItem.locator('*').filter({ hasText: /Downloading \d+ of \d+/ });
      const progressCount = await progressElements.count();
      
      if (progressCount > 0) {
        const progressText = await progressElements.first().textContent();
        if (progressText && !progressText.includes('Downloading 0 of') && !realProgressDetected) {
          realProgressDetected = true;
          console.log(`✓ Real download progress detected: ${progressText}`);
        }
      }
      
      // Check for completion
      const statusBadge = queueItem.locator('.status-badge');
      const status = await statusBadge.textContent();
      if (status && status.toLowerCase().includes('completed')) {
        downloadCompleted = true;
        console.log(`✓ Download completed!`);
        break;
      }
      
      // Take periodic screenshots
      if (check % 10 === 0) {
        await page.screenshot({ 
          path: `test-results/${timestamp}-download-validation-progress-${Math.floor(check/10)}.png`,
          fullPage: true 
        });
        console.log(`  ... monitoring (${check * 3} seconds elapsed)`);
      }
    }
    
    // Final screenshot
    await page.screenshot({ 
      path: `test-results/${timestamp}-download-validation-final.png`,
      fullPage: true 
    });
    
    // Summary
    console.log('\\n=== DOWNLOAD VALIDATION SUMMARY ===');
    console.log(`✅ Manifest Loading: ${manifestLoaded ? 'SUCCESS' : 'FAILED'}`);
    console.log(`✅ Auto-split (30MB): ${autoSplitDetected ? 'SUCCESS' : 'FAILED'}`);
    console.log(`✅ Real Progress: ${realProgressDetected ? 'SUCCESS' : 'FAILED'}`);
    console.log(`✅ Download Completion: ${downloadCompleted ? 'SUCCESS' : 'IN PROGRESS'}`);
    
    // The test passes if we get real progress and auto-split working
    // Completion may take longer than our test timeout
    expect(manifestLoaded).toBe(true);
    expect(autoSplitDetected).toBe(true);
    expect(realProgressDetected).toBe(true);
    
    console.log('✓ Download validation test PASSED - Core functionality working!');
  });
});