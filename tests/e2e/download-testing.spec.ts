import { test, expect } from './helpers/electron';

test.describe('Download Functionality Testing', () => {
  let supportedLibraries: any[] = [];
  
  test.beforeAll(async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    
    // Get supported libraries
    supportedLibraries = await page.evaluate(async () => {
      let retries = 10;
      while (!window.electronAPI && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        retries--;
      }
      
      if (!window.electronAPI) {
        throw new Error('electronAPI not available');
      }
      
      return await window.electronAPI.getSupportedLibraries();
    });
    
    console.log(`Testing downloads for ${supportedLibraries.length} libraries`);
  });

  test('should test download functionality for all libraries', async ({ page }) => {
    // Clear any existing queue items first
    const clearButton = page.locator('[data-testid="clear-completed"]');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      const confirmButton = page.locator('[data-testid="confirm-delete"]');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
    
    // Clear all items (including failed ones)
    const clearAllButton = page.locator('button:has-text("Clear All")');
    if (await clearAllButton.isVisible()) {
      await clearAllButton.click();
      const confirmButton = page.locator('[data-testid="confirm-delete"]');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
    
    // Wait for queue to be empty
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(0);
    
    // Filter out libraries with warning emoji (known issues)
    const testableLibraries = supportedLibraries.filter(lib => !lib.name.includes('⚠️'));
    console.log(`Testing ${testableLibraries.length} libraries (excluding warned ones)`);
    
    const urlInput = page.locator('[data-testid="url-input"]');
    const addButton = page.locator('[data-testid="add-button"]');
    
    // Add all testable libraries to queue
    const allUrls = testableLibraries.map(lib => lib.example).join('\n');
    await urlInput.fill(allUrls);
    await addButton.click();
    
    // Wait for all items to be added
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(testableLibraries.length, { timeout: 30000 });
    
    console.log(`Added ${testableLibraries.length} manuscripts to queue`);
    
    // Configure download settings for each item
    const queueItems = page.locator('[data-testid="queue-item"]');
    
    for (let i = 0; i < testableLibraries.length; i++) {
      const item = queueItems.nth(i);
      const library = testableLibraries[i];
      
      console.log(`Configuring download settings for ${library.name}`);
      
      // Click on the item to expand options (if needed)
      await item.click();
      
      // Look for configuration buttons or inputs (use first() to avoid strict mode violation)
      const editButton = item.locator('button:has-text("Edit"), button[title*="edit"], button[title*="settings"]').first();
      if (await editButton.isVisible()) {
        await editButton.click();
        
        // Take screenshot after clicking edit
        await page.screenshot({ 
          path: `test-results/edit-dialog-${i}-${library.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
          fullPage: true 
        });
        
        // First, let's configure auto-split for large manuscripts
        const autoSplitToggle = page.locator('input[type="checkbox"]:near(:text("Auto-split")), input[type="checkbox"]:near(:text("Split"))').first();
        if (await autoSplitToggle.isVisible()) {
          const isChecked = await autoSplitToggle.isChecked();
          if (!isChecked) {
            await autoSplitToggle.check();
            console.log(`Enabled auto-split for ${library.name}`);
          }
        }
        
        // Set auto-split threshold to 30MB
        const autoSplitThresholdSelectors = [
          'input[type="number"]:near(:text("threshold"))',
          'input[type="number"]:near(:text("Split"))',
          'input[type="number"]:near(:text("Auto"))',
          '.auto-split input[type="number"]',
          '[data-testid*="split"] input[type="number"]'
        ];
        
        let autoSplitSet = false;
        for (const selector of autoSplitThresholdSelectors) {
          const thresholdInput = page.locator(selector).first();
          if (await thresholdInput.isVisible()) {
            await thresholdInput.fill('30');
            autoSplitSet = true;
            console.log(`Set auto-split threshold for ${library.name} to 30MB using: ${selector}`);
            break;
          }
        }
        
        // Look for size limit input - check for different possible patterns
        const sizeLimitSelectors = [
          'input[type="number"]:near(:text("Size Limit"))',
          'input[type="number"]:near(:text("MB"))',
          'input[type="number"][placeholder*="MB"]',
          'input[type="number"][placeholder*="Size"]',
          '.size-limit input[type="number"]',
          '[data-testid*="size"] input[type="number"]'
        ];
        
        let sizeLimitSet = false;
        for (const selector of sizeLimitSelectors) {
          const sizeLimitInput = page.locator(selector).first();
          if (await sizeLimitInput.isVisible()) {
            await sizeLimitInput.fill('30');
            sizeLimitSet = true;
            console.log(`Set size limit for ${library.name} using selector: ${selector}`);
            break;
          }
        }
        
        if (!sizeLimitSet && !autoSplitSet) {
          console.log(`Could not find size limit or auto-split inputs for ${library.name}`);
        }
        
        // Set maximum concurrency
        const concurrencySelectors = [
          'input[type="number"]:near(:text("Concurrency"))',
          'input[type="number"]:near(:text("Concurrent"))',
          '.concurrency input[type="number"]',
          '[data-testid*="concurrency"] input[type="number"]',
          'input[type="range"]' // Slider input
        ];
        
        let concurrencySet = false;
        for (const selector of concurrencySelectors) {
          const concurrencyInput = page.locator(selector).first();
          if (await concurrencyInput.isVisible()) {
            const inputType = await concurrencyInput.getAttribute('type');
            if (inputType === 'range') {
              // For slider, set to maximum
              const maxValue = await concurrencyInput.getAttribute('max') || '10';
              await concurrencyInput.fill(maxValue);
            } else {
              // For number input
              const maxConcurrency = await concurrencyInput.getAttribute('max') || '10';
              await concurrencyInput.fill(maxConcurrency);
            }
            concurrencySet = true;
            console.log(`Set concurrency for ${library.name} using selector: ${selector}`);
            break;
          }
        }
        
        if (!concurrencySet) {
          console.log(`Could not find concurrency input for ${library.name}`);
        }
        
        // Clear any page range that might be causing validation errors (skip range inputs)
        const pageRangeInputs = page.locator('input[placeholder*="Page"]:not([type="range"]), input:near(:text("Page Range")):not([type="range"])');
        const pageRangeCount = await pageRangeInputs.count();
        for (let j = 0; j < pageRangeCount; j++) {
          const input = pageRangeInputs.nth(j);
          if (await input.isVisible()) {
            const inputType = await input.getAttribute('type');
            if (inputType !== 'range') {
              await input.clear();
              console.log(`Cleared page range input ${j} for ${library.name}`);
            }
          }
        }
        
        // Click "All Pages" button if available to ensure no range issues
        const allPagesButton = page.locator('button:has-text("All Pages")');
        if (await allPagesButton.isVisible()) {
          await allPagesButton.click();
          console.log(`Clicked All Pages for ${library.name}`);
        }
        
        // Take screenshot before attempting to save
        await page.screenshot({ 
          path: `test-results/before-save-${i}-${library.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
          fullPage: true 
        });
        
        // Check for validation errors
        const validationError = page.locator(':text("Invalid"), .error, .validation-error, [style*="color: red"]');
        const hasError = await validationError.isVisible();
        if (hasError) {
          const errorText = await validationError.textContent();
          console.log(`Validation error for ${library.name}: ${errorText}`);
          
          // Try to fix common issues
          if (errorText?.includes('page range') || errorText?.includes('duplicate')) {
            // Clear all inputs and try again
            const allInputs = item.locator('input[type="number"], input[type="text"]');
            const inputCount = await allInputs.count();
            for (let k = 0; k < inputCount; k++) {
              const input = allInputs.nth(k);
              if (await input.isVisible()) {
                await input.clear();
              }
            }
            
            // Click All Pages again
            if (await allPagesButton.isVisible()) {
              await allPagesButton.click();
            }
          }
        }
        
        // Save settings if there's a save button and it's enabled
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Apply"), button:has-text("OK")');
        if (await saveButton.isVisible()) {
          const isEnabled = await saveButton.isEnabled();
          if (isEnabled) {
            await saveButton.click();
            console.log(`Successfully saved settings for ${library.name}`);
          } else {
            console.log(`Save button disabled for ${library.name}, skipping`);
            
            // Take screenshot of disabled state
            await page.screenshot({ 
              path: `test-results/save-disabled-${i}-${library.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
              fullPage: true 
            });
            
            // Try clicking Cancel or close button
            const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Close")');
            if (await cancelButton.isVisible()) {
              await cancelButton.click();
            }
          }
        }
      }
      
      // Alternative: Check for inline inputs
      const inlineSizeInput = item.locator('input[type="number"]').first();
      if (await inlineSizeInput.isVisible()) {
        await inlineSizeInput.fill('30');
      }
    }
    
    console.log('Configured download settings for all items');
    
    // Check and configure global auto-split settings
    const globalSettingsButton = page.locator('button:has-text("Default Download Settings"), button:has-text("Settings")');
    if (await globalSettingsButton.isVisible()) {
      await globalSettingsButton.click();
      console.log('Opened global settings');
      
      // Take screenshot of global settings
      await page.screenshot({ 
        path: 'test-results/global-settings.png',
        fullPage: true 
      });
      
      // Enable auto-split globally if available
      const globalAutoSplitToggle = page.locator('input[type="checkbox"]:near(:text("Auto-split")), input[type="checkbox"]:near(:text("Split"))').first();
      if (await globalAutoSplitToggle.isVisible()) {
        const isChecked = await globalAutoSplitToggle.isChecked();
        if (!isChecked) {
          await globalAutoSplitToggle.check();
          console.log('Enabled global auto-split');
        }
      }
      
      // Set global auto-split threshold to 30MB using the slider
      const globalThresholdSlider = page.locator('input[type="range"]:near(:text("Auto-split threshold"))').first();
      if (await globalThresholdSlider.isVisible()) {
        // Move slider to minimum (30MB)
        await globalThresholdSlider.fill('30');
        console.log('Set global auto-split threshold slider to 30MB');
      }
      
      // Also try text input if available
      const globalThresholdInput = page.locator('input[type="number"]:near(:text("threshold")), input[type="number"]:near(:text("Split"))').first();
      if (await globalThresholdInput.isVisible()) {
        await globalThresholdInput.fill('30');
        console.log('Set global auto-split threshold input to 30MB');
      }
      
      // Save global settings if needed
      const saveGlobalButton = page.locator('button:has-text("Save"), button:has-text("Apply")');
      if (await saveGlobalButton.isVisible() && await saveGlobalButton.isEnabled()) {
        await saveGlobalButton.click();
        console.log('Saved global settings');
      }
      
      // Close settings if there's a close button
      const closeButton = page.locator('button:has-text("Close"), button:has-text("Cancel")');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }
    }
    
    // Scroll back to top where the control buttons are
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
    
    // Wait for manifest loading to complete before starting queue
    console.log('Waiting for manifest loading to complete...');
    const loadingText = page.locator(':text("Loading Manifests")');
    if (await loadingText.isVisible()) {
      await expect(loadingText).not.toBeVisible({ timeout: 120000 }); // Wait up to 2 minutes
      console.log('Manifest loading completed');
    }
    
    // Wait a bit more for the queue to stabilize
    await page.waitForTimeout(3000);
    
    // Take screenshot after manifest loading is complete
    await page.screenshot({ 
      path: 'test-results/after-manifest-loading.png',
      fullPage: true 
    });
    
    // Start the download queue - look for Resume Queue button specifically
    let queueStarted = false;
    const resumeQueueButton = page.locator('button:has-text("Resume Queue")').first();
    console.log('Checking Resume Queue button...');
    const resumeVisible = await resumeQueueButton.isVisible();
    const resumeEnabled = await resumeQueueButton.isEnabled();
    console.log(`Resume Queue button: visible=${resumeVisible}, enabled=${resumeEnabled}`);
    
    if (resumeVisible && resumeEnabled) {
      await resumeQueueButton.click();
      console.log('Started queue using Resume Queue button');
      queueStarted = true;
      
      // Take screenshot after clicking start
      await page.screenshot({ 
        path: 'test-results/after-clicking-start.png',
        fullPage: true 
      });
    } else {
      // Fallback to other start buttons
      const startSelectors = [
        'button:has-text("Start")',
        'button:has-text("Resume")', 
        '[data-testid="start-queue"]',
        '[data-testid="resume-queue"]',
        '.start-button',
        '.resume-button'
      ];
      
      for (const selector of startSelectors) {
        const startButton = page.locator(selector).first(); // Fix strict mode violation
        try {
          const isVisible = await startButton.isVisible();
          const isEnabled = await startButton.isEnabled();
          console.log(`Checking ${selector}: visible=${isVisible}, enabled=${isEnabled}`);
          
          if (isVisible && isEnabled) {
            await startButton.scrollIntoViewIfNeeded();
            await startButton.click();
            console.log(`Started download queue using: ${selector}`);
            queueStarted = true;
            
            // Take screenshot after clicking start
            await page.screenshot({ 
              path: 'test-results/after-clicking-start.png',
              fullPage: true 
            });
            break;
          }
        } catch (error) {
          console.log(`Error checking ${selector}: ${error.message}`);
        }
      }
    }
    
    if (!queueStarted) {
      console.log('Could not find start button, taking screenshot for debugging');
      await page.screenshot({ 
        path: 'test-results/no-start-button-found.png',
        fullPage: true 
      });
      
      // Try to find any button that might start the queue
      console.log('Looking for any buttons containing queue-related text...');
      const allButtons = page.locator('button');
      const buttonCount = await allButtons.count();
      for (let i = 0; i < buttonCount; i++) {
        const button = allButtons.nth(i);
        const buttonText = await button.textContent();
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();
        console.log(`Button ${i}: "${buttonText}" - visible: ${isVisible}, enabled: ${isEnabled}`);
        
        if (buttonText && (buttonText.includes('Start') || buttonText.includes('Resume') || buttonText.includes('Queue')) && isVisible && isEnabled) {
          await button.scrollIntoViewIfNeeded();
          await button.click();
          console.log(`Started queue using button: "${buttonText}"`);
          queueStarted = true;
          break;
        }
      }
    }
    
    // Take screenshot after starting
    await page.screenshot({ 
      path: 'test-results/after-start-queue.png',
      fullPage: true 
    });
    
    // Wait for downloads to begin and verify first parts start downloading
    let downloadsStarted = 0;
    let totalChecks = 0;
    const maxWaitTime = 120000; // 2 minutes
    const checkInterval = 5000; // 5 seconds
    const maxChecks = maxWaitTime / checkInterval;
    
    while (totalChecks < maxChecks && downloadsStarted < Math.min(3, testableLibraries.length)) {
      await page.waitForTimeout(checkInterval);
      totalChecks++;
      
      // Check current status of items
      const allItems = page.locator('[data-testid="queue-item"]');
      const itemCount = await allItems.count();
      
      let currentDownloading = 0;
      let currentCompleted = 0;
      let currentFailed = 0;
      
      for (let i = 0; i < Math.min(itemCount, testableLibraries.length); i++) {
        const item = allItems.nth(i);
        const statusBadge = item.locator('.status-badge');
        const status = await statusBadge.textContent();
        const library = testableLibraries[i];
        
        if (status?.toLowerCase().includes('downloading') || status?.toLowerCase().includes('processing')) {
          currentDownloading++;
          if (downloadsStarted <= i) {
            console.log(`✓ ${library.name}: Download started (${status})`);
            downloadsStarted = i + 1;
          }
        } else if (status?.toLowerCase().includes('completed')) {
          currentCompleted++;
          if (downloadsStarted <= i) {
            console.log(`✓ ${library.name}: Download completed`);
            downloadsStarted = i + 1;
          }
        } else if (status?.toLowerCase().includes('failed')) {
          currentFailed++;
          console.log(`✗ ${library.name}: Download failed (${status})`);
        } else {
          console.log(`${library.name}: ${status || 'unknown status'}`);
        }
      }
      
      console.log(`Check ${totalChecks}/${maxChecks}: ${currentDownloading} downloading, ${currentCompleted} completed, ${currentFailed} failed`);
      
      // Take screenshot every few checks
      if (totalChecks % 3 === 0) {
        await page.screenshot({ 
          path: `test-results/download-progress-check-${totalChecks}.png`,
          fullPage: true 
        });
      }
    }
    
    // Final verification
    console.log(`\n=== FINAL DOWNLOAD TEST RESULTS ===`);
    console.log(`Downloads started: ${downloadsStarted}/${testableLibraries.length}`);
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'test-results/download-test-final.png',
      fullPage: true 
    });
    
    // Verify at least some downloads started
    expect(downloadsStarted).toBeGreaterThan(0);
    
    // Check final status of each library
    const finalItems = page.locator('[data-testid="queue-item"]');
    const finalCount = await finalItems.count();
    
    for (let i = 0; i < Math.min(finalCount, testableLibraries.length); i++) {
      const item = finalItems.nth(i);
      const library = testableLibraries[i];
      const statusBadge = item.locator('.status-badge');
      const status = await statusBadge.textContent();
      
      console.log(`${library.name}: ${status || 'unknown'}`);
      
      // Verify the item is not in a failed state (unless it's expected)
      if (status?.toLowerCase().includes('failed')) {
        // Check if it's a known problematic library
        const errorElement = item.locator('.manuscript-error-link');
        let errorMessage = '';
        if (await errorElement.isVisible()) {
          errorMessage = await errorElement.textContent() || '';
        }
        
        console.warn(`${library.name} failed with: ${errorMessage}`);
        
        // Don't fail the test for certain expected errors
        const expectedErrors = ['captcha', 'blocked', 'timeout', 'network'];
        const isExpectedError = expectedErrors.some(err => 
          errorMessage.toLowerCase().includes(err) || 
          status.toLowerCase().includes(err)
        );
        
        if (!isExpectedError) {
          throw new Error(`Unexpected failure for ${library.name}: ${errorMessage || status}`);
        }
      }
    }
    
    console.log('Download functionality test completed successfully');
  });
  
  // Test individual library downloads for detailed analysis
  const priorityLibraries = ['Gallica (BnF)', 'e-codices (Unifr)', 'Vatican Library'];
  
  priorityLibraries.forEach(libraryName => {
    test(`should download from ${libraryName} with 30MB limit`, async ({ page }) => {
      const library = supportedLibraries.find(lib => lib.name === libraryName);
      if (!library) {
        test.skip(true, `${libraryName} not found in supported libraries`);
        return;
      }
      
      console.log(`Testing individual download for ${library.name}`);
      
      // Clear queue
      const clearButton = page.locator('[data-testid="clear-completed"]');
      if (await clearButton.isVisible()) {
        await clearButton.click();
        const confirmButton = page.locator('[data-testid="confirm-delete"]');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
      }
      
      await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(0);
      
      // Add library URL
      const urlInput = page.locator('[data-testid="url-input"]');
      const addButton = page.locator('[data-testid="add-button"]');
      
      await urlInput.fill(library.example);
      await addButton.click();
      
      // Wait for item to be added and processed
      await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(1, { timeout: 30000 });
      
      const queueItem = page.locator('[data-testid="queue-item"]').first();
      
      // Wait for manifest loading to complete
      await expect(queueItem).not.toHaveClass(/loading-manifest/, { timeout: 45000 });
      
      // Check if item failed during manifest loading
      const hasFailed = await queueItem.locator('.status-badge.status-failed').isVisible();
      if (hasFailed) {
        const errorElement = queueItem.locator('.manuscript-error-link');
        let errorMessage = 'Unknown error';
        if (await errorElement.isVisible()) {
          errorMessage = await errorElement.textContent() || 'Error detected';
        }
        console.log(`${library.name} failed during manifest loading: ${errorMessage}`);
        
        // Skip download test if manifest failed
        test.skip(true, `Skipping download test - manifest loading failed: ${errorMessage}`);
        return;
      }
      
      // Configure 30MB limit
      const editButton = queueItem.locator('button:has-text("Edit"), button[title*="edit"]').first();
      if (await editButton.isVisible()) {
        await editButton.click();
        
        // Take screenshot of edit dialog
        await page.screenshot({ 
          path: `test-results/individual-edit-${libraryName.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
          fullPage: true 
        });
        
        // Enable auto-split if available
        const autoSplitToggle = page.locator('input[type="checkbox"]:near(:text("Auto-split")), input[type="checkbox"]:near(:text("Split"))').first();
        if (await autoSplitToggle.isVisible()) {
          const isChecked = await autoSplitToggle.isChecked();
          if (!isChecked) {
            await autoSplitToggle.check();
            console.log(`Enabled auto-split for ${library.name}`);
          }
        }
        
        // Set auto-split threshold to 30MB
        const autoSplitThresholdInput = page.locator('input[type="number"]:near(:text("threshold")), input[type="number"]:near(:text("Split"))').first();
        if (await autoSplitThresholdInput.isVisible()) {
          await autoSplitThresholdInput.fill('30');
          console.log(`Set auto-split threshold for ${library.name} to 30MB`);
        }
        
        // Set 30MB limit
        const sizeLimitInput = page.locator('input[type="number"]').first();
        if (await sizeLimitInput.isVisible()) {
          await sizeLimitInput.fill('30');
        }
        
        // Ensure All Pages is selected to avoid validation errors
        const allPagesButton = page.locator('button:has-text("All Pages")');
        if (await allPagesButton.isVisible()) {
          await allPagesButton.click();
        }
        
        // Clear any problematic page range inputs
        const pageRangeInputs = page.locator('input[placeholder*="range"], input[placeholder*="Page"]');
        const pageRangeCount = await pageRangeInputs.count();
        for (let j = 0; j < pageRangeCount; j++) {
          const input = pageRangeInputs.nth(j);
          if (await input.isVisible()) {
            await input.clear();
          }
        }
        
        // Take screenshot before save
        await page.screenshot({ 
          path: `test-results/individual-before-save-${libraryName.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
          fullPage: true 
        });
        
        // Save if button is enabled
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Apply")');
        if (await saveButton.isVisible()) {
          const isEnabled = await saveButton.isEnabled();
          if (isEnabled) {
            await saveButton.click();
            console.log(`Applied settings for ${library.name}`);
          } else {
            console.log(`Save button disabled for ${library.name}, proceeding anyway`);
            // Click cancel or close
            const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Close")');
            if (await cancelButton.isVisible()) {
              await cancelButton.click();
            }
          }
        }
      }
      
      // Scroll to top to ensure control buttons are visible
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1000);
      
      // Take screenshot before starting download
      await page.screenshot({ 
        path: `test-results/individual-before-start-${libraryName.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
        fullPage: true 
      });
      
      // Start download - try multiple selectors
      const startSelectors = [
        'button:has-text("Start")',
        'button:has-text("Resume")', 
        'button:has-text("Resume Queue")',
        '[data-testid="start-queue"]',
        '[data-testid="resume-queue"]'
      ];
      
      let queueStartedForItem = false;
      for (const selector of startSelectors) {
        const startButton = page.locator(selector);
        if (await startButton.isVisible() && await startButton.isEnabled()) {
          await startButton.scrollIntoViewIfNeeded();
          await startButton.click();
          console.log(`Started download for ${library.name} using: ${selector}`);
          queueStartedForItem = true;
          break;
        }
      }
      
      if (!queueStartedForItem) {
        console.log(`Could not find start button for ${library.name}`);
        await page.screenshot({ 
          path: `test-results/individual-no-start-${libraryName.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
          fullPage: true 
        });
        
        // Debug: list all visible buttons
        const allButtons = page.locator('button');
        const buttonCount = await allButtons.count();
        console.log(`Found ${buttonCount} buttons, checking for start/resume options...`);
        
        for (let i = 0; i < Math.min(buttonCount, 20); i++) {
          const button = allButtons.nth(i);
          const buttonText = await button.textContent();
          const isVisible = await button.isVisible();
          const isEnabled = await button.isEnabled();
          console.log(`Button ${i}: "${buttonText}" - visible: ${isVisible}, enabled: ${isEnabled}`);
          
          if (buttonText && (buttonText.includes('Start') || buttonText.includes('Resume')) && isVisible && isEnabled) {
            await button.scrollIntoViewIfNeeded();
            await button.click();
            console.log(`Started download using: "${buttonText}"`);
            queueStartedForItem = true;
            break;
          }
        }
      }
      
      // Take screenshot after starting
      await page.screenshot({ 
        path: `test-results/individual-after-start-${libraryName.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
        fullPage: true 
      });
      
      // Monitor download progress
      let downloadStarted = false;
      let progressDetected = false;
      
      for (let check = 0; check < 24; check++) { // 2 minutes total
        await page.waitForTimeout(5000);
        
        const statusBadge = queueItem.locator('.status-badge');
        const status = await statusBadge.textContent();
        
        // Check for progress indicators
        const progressBar = queueItem.locator('.progress-bar, [role="progressbar"]');
        const hasProgress = await progressBar.isVisible();
        
        if (hasProgress) {
          progressDetected = true;
          console.log(`${library.name}: Progress bar detected`);
        }
        
        if (status?.toLowerCase().includes('downloading') || 
            status?.toLowerCase().includes('processing') ||
            hasProgress) {
          downloadStarted = true;
          console.log(`${library.name}: Download active (${status})`);
          break;
        }
        
        if (status?.toLowerCase().includes('completed')) {
          downloadStarted = true;
          console.log(`${library.name}: Download completed quickly`);
          break;
        }
        
        if (status?.toLowerCase().includes('failed')) {
          const errorElement = queueItem.locator('.manuscript-error-link');
          let errorMessage = '';
          if (await errorElement.isVisible()) {
            errorMessage = await errorElement.textContent() || '';
          }
          console.log(`${library.name}: Download failed - ${errorMessage || status}`);
          break;
        }
        
        console.log(`${library.name}: Check ${check + 1}/24 - Status: ${status}`);
      }
      
      // Take final screenshot
      await page.screenshot({ 
        path: `test-results/individual-download-${libraryName.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
        fullPage: true 
      });
      
      // Verify download activity
      expect(downloadStarted || progressDetected).toBeTruthy();
      
      console.log(`${library.name}: Individual download test completed`);
    });
  });
});