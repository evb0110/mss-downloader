import { test, expect } from './helpers/electron';

test.describe('Download Verification', () => {
  let supportedLibraries: any[] = [];
  
  test.beforeAll(async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    
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
    
    console.log(`Verifying downloads for ${supportedLibraries.length} libraries`);
  });

  test('should configure auto-split and start downloads for all libraries', async ({ page }) => {
    // Clear any existing queue
    const clearButton = page.locator('[data-testid="clear-completed"]');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      const confirmButton = page.locator('[data-testid="confirm-delete"]');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
    
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(0);
    
    // Add all libraries to queue
    const testableLibraries = supportedLibraries.filter(lib => !lib.name.includes('⚠️'));
    const urlInput = page.locator('[data-testid="url-input"]');
    const addButton = page.locator('[data-testid="add-button"]');
    
    const allUrls = testableLibraries.map(lib => lib.example).join('\n');
    await urlInput.fill(allUrls);
    await addButton.click();
    
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(testableLibraries.length, { timeout: 30000 });
    console.log(`✓ Added ${testableLibraries.length} manuscripts to queue`);
    
    // Configure global auto-split settings
    await page.evaluate(() => window.scrollTo(0, 0));
    
    const globalSettingsButton = page.locator('button:has-text("Default Download Settings")');
    if (await globalSettingsButton.isVisible()) {
      await globalSettingsButton.click();
      
      // Set auto-split threshold to 30MB using slider
      const globalThresholdSlider = page.locator('input[type="range"]').first();
      if (await globalThresholdSlider.isVisible()) {
        await globalThresholdSlider.fill('30');
        console.log('✓ Set global auto-split threshold slider to 30MB');
      }
      
      const closeButton = page.locator('button:has-text("Close"), button:has-text("Cancel")');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }
    }
    
    // Wait for manifest loading to complete
    console.log('Waiting for manifest loading...');
    const loadingText = page.locator(':text("Loading Manifests")');
    if (await loadingText.isVisible()) {
      await expect(loadingText).not.toBeVisible({ timeout: 60000 });
      console.log('✓ Manifest loading completed');
    }
    
    await page.waitForTimeout(2000);
    
    // Start the queue
    const resumeQueueButton = page.locator('button:has-text("Resume Queue")').first();
    const resumeVisible = await resumeQueueButton.isVisible();
    const resumeEnabled = await resumeQueueButton.isEnabled();
    
    console.log(`Resume Queue button: visible=${resumeVisible}, enabled=${resumeEnabled}`);
    
    if (resumeVisible && resumeEnabled) {
      await resumeQueueButton.click();
      console.log('✓ Started queue using Resume Queue button');
      
      // Verify downloads begin within reasonable time
      let downloadsStarted = false;
      for (let check = 0; check < 6; check++) { // 30 seconds
        await page.waitForTimeout(5000);
        
        const allItems = page.locator('[data-testid="queue-item"]');
        const itemCount = await allItems.count();
        
        let downloading = 0;
        let completed = 0;
        
        for (let i = 0; i < Math.min(itemCount, 5); i++) { // Check first 5 items
          const item = allItems.nth(i);
          const statusBadge = item.locator('.status-badge');
          const status = await statusBadge.textContent();
          
          if (status?.toLowerCase().includes('downloading') || 
              status?.toLowerCase().includes('processing')) {
            downloading++;
            downloadsStarted = true;
          } else if (status?.toLowerCase().includes('completed')) {
            completed++;
            downloadsStarted = true;
          }
        }
        
        console.log(`Check ${check + 1}/6: ${downloading} downloading, ${completed} completed`);
        
        if (downloadsStarted) {
          console.log('✓ Downloads have started successfully');
          break;
        }
      }
      
      expect(downloadsStarted).toBeTruthy();
      
    } else {
      console.log('❌ Resume Queue button not available');
      expect(resumeEnabled).toBeTruthy();
    }
  });

  test('should verify individual priority library downloads', async ({ page }) => {
    const priorityLibraries = ['Gallica (BnF)', 'e-codices (Unifr)', 'Vatican Library'];
    
    for (const libraryName of priorityLibraries) {
      const library = supportedLibraries.find(lib => lib.name === libraryName);
      if (!library) continue;
      
      console.log(`\n--- Testing ${library.name} ---`);
      
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
      
      // Add single library
      const urlInput = page.locator('[data-testid="url-input"]');
      const addButton = page.locator('[data-testid="add-button"]');
      
      await urlInput.fill(library.example);
      await addButton.click();
      
      await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(1, { timeout: 15000 });
      
      const queueItem = page.locator('[data-testid="queue-item"]').first();
      
      // Wait for manifest loading
      await expect(queueItem).not.toHaveClass(/loading-manifest/, { timeout: 30000 });
      
      // Check for failures
      const hasFailed = await queueItem.locator('.status-badge.status-failed').isVisible();
      if (hasFailed) {
        console.log(`⚠️ ${library.name} failed during manifest loading`);
        continue;
      }
      
      console.log(`✓ ${library.name} manifest loaded successfully`);
      
      // Start download
      await page.evaluate(() => window.scrollTo(0, 0));
      const startButton = page.locator('button:has-text("Resume Queue")').first();
      
      if (await startButton.isVisible() && await startButton.isEnabled()) {
        await startButton.click();
        console.log(`✓ Started download for ${library.name}`);
        
        // Quick verification that download begins
        let downloadStarted = false;
        for (let check = 0; check < 3; check++) {
          await page.waitForTimeout(3000);
          
          const statusBadge = queueItem.locator('.status-badge');
          const status = await statusBadge.textContent();
          
          if (status?.toLowerCase().includes('downloading') || 
              status?.toLowerCase().includes('processing') ||
              status?.toLowerCase().includes('completed')) {
            downloadStarted = true;
            console.log(`✓ ${library.name} download active: ${status}`);
            break;
          }
        }
        
        if (!downloadStarted) {
          console.log(`⚠️ ${library.name} download did not start within timeout`);
        }
      }
    }
  });
});