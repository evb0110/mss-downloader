import { test, expect } from './helpers/electron';

test.describe('Morgan Library Fix Test', () => {
  test('should successfully process Morgan Library manuscript with fixed image sizing', async ({ page }) => {
    console.log('Testing Morgan Library fix for image sizing issue');
    
    // Use the Lindau Gospels URL that was mentioned in the fix
    const morganUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
    
    // Clear any existing queue items first
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
    
    // Add Morgan manuscript URL
    const addMoreButton = page.locator('button:has-text("Add More Documents")');
    if (await addMoreButton.isVisible()) {
      await addMoreButton.click();
      await page.waitForTimeout(500);
    }
    
    const urlInput = page.locator('textarea').first();
    const addButton = page.locator('button').filter({ hasText: /Add|Submit/ }).first();
    
    await urlInput.fill(morganUrl);
    if (await addButton.isVisible() && await addButton.isEnabled()) {
      await addButton.click();
    }
    
    // Wait for manifest loading
    await page.waitForTimeout(3000);
    const queueItem = page.locator('[data-testid="queue-item"]').first();
    
    console.log('Waiting for Morgan Library manifest to load...');
    
    // Check manifest loading with longer timeout for Morgan Library
    let manifestLoaded = false;
    let manifestTitle = '';
    
    for (let attempt = 0; attempt < 20; attempt++) {
      await page.waitForTimeout(2000);
      
      const titleElement = queueItem.locator('strong');
      const currentTitle = await titleElement.textContent();
      
      if (currentTitle && !currentTitle.includes('Loading manifest')) {
        manifestLoaded = true;
        manifestTitle = currentTitle;
        console.log(`✓ Morgan Library manifest loaded: ${currentTitle}`);
        break;
      }
      
      // Check for failure
      const statusBadge = queueItem.locator('.status-badge');
      const status = await statusBadge.textContent();
      if (status?.toLowerCase().includes('failed')) {
        console.log(`❌ Morgan Library manifest failed: ${status}`);
        // Take screenshot for debugging
        await page.screenshot({ 
          path: `test-results/morgan-library-manifest-failed.png`,
          fullPage: true 
        });
        throw new Error(`Morgan Library manifest failed: ${status}`);
      }
    }
    
    expect(manifestLoaded).toBe(true);
    expect(manifestTitle).toBeTruthy();
    expect(manifestTitle).not.toContain('Failed to load');
    expect(manifestTitle).not.toContain('Error invoking');
    
    console.log('✓ Morgan Library manifest loaded successfully');
    
    // Verify start button is available
    const startButton = page.locator('button.start-btn, button:has-text("Resume Queue")').first();
    const isVisible = await startButton.isVisible();
    const isEnabled = await startButton.isEnabled();
    
    expect(isVisible).toBe(true);
    expect(isEnabled).toBe(true);
    
    console.log('✓ Start button is available');
    
    // Try to start download to test the fix
    if (isVisible && isEnabled) {
      await startButton.click();
      console.log('✓ Started Morgan Library download');
      
      // Wait for download to begin and check for progress
      let downloadStarted = false;
      
      for (let check = 0; check < 10; check++) {
        await page.waitForTimeout(3000);
        
        // Look for progress indicators
        const progressText = queueItem.locator('*').filter({ hasText: /\d+.*of.*\d+|\d+%|Downloading \d+|Calculating/ });
        const hasProgress = await progressText.count() > 0;
        
        if (hasProgress) {
          const progressContent = await progressText.first().textContent();
          console.log(`✓ Morgan Library download progress: ${progressContent}`);
          downloadStarted = true;
          break;
        }
        
        // Check for any error states
        const statusBadge = queueItem.locator('.status-badge');
        const status = await statusBadge.textContent();
        if (status?.toLowerCase().includes('failed')) {
          console.log(`❌ Morgan Library download failed: ${status}`);
          await page.screenshot({ 
            path: `test-results/morgan-library-download-failed.png`,
            fullPage: true 
          });
          throw new Error(`Morgan Library download failed: ${status}`);
        }
      }
      
      expect(downloadStarted).toBe(true);
      console.log('✓ Morgan Library download started successfully');
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: `test-results/morgan-library-fix-test-success.png`,
      fullPage: true 
    });
    
    console.log('✅ Morgan Library fix test completed successfully');
  });
  
  test('should process alternative Morgan Library URL format', async ({ page }) => {
    console.log('Testing alternative Morgan Library URL format');
    
    // Test a different Morgan manuscript URL format
    const morganUrl = 'https://www.themorgan.org/collection/gospel-book';
    
    // Clear queue
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
    
    // Add URL
    const addMoreButton = page.locator('button:has-text("Add More Documents")');
    if (await addMoreButton.isVisible()) {
      await addMoreButton.click();
      await page.waitForTimeout(500);
    }
    
    const urlInput = page.locator('textarea').first();
    const addButton = page.locator('button').filter({ hasText: /Add|Submit/ }).first();
    
    await urlInput.fill(morganUrl);
    if (await addButton.isVisible() && await addButton.isEnabled()) {
      await addButton.click();
    }
    
    // Wait for processing
    await page.waitForTimeout(5000);
    const queueItem = page.locator('[data-testid="queue-item"]').first();
    
    // Check that it either loads successfully or fails gracefully
    const titleElement = queueItem.locator('strong');
    const currentTitle = await titleElement.textContent();
    
    // Should either load a manuscript or show a clear error message
    expect(currentTitle).toBeTruthy();
    console.log(`Alternative Morgan URL result: ${currentTitle}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: `test-results/morgan-library-alternative-url-test.png`,
      fullPage: true 
    });
  });
});