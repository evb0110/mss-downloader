import { test, expect } from './helpers/electron';

test.describe('Manuscript Library Testing', () => {
  let supportedLibraries: any[] = [];
  
  test.beforeAll(async ({ electronApp }) => {
    // Get the page instance to access the app
    const page = await electronApp.firstWindow();
    
    // Wait for the app to load and get supported libraries
    await page.waitForLoadState('domcontentloaded');
    
    // Execute code to get supported libraries from the main process
    supportedLibraries = await page.evaluate(async () => {
      // Wait for electronAPI to be available
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
    
    console.log(`Found ${supportedLibraries.length} supported libraries:`, 
                supportedLibraries.map(lib => lib.name));
  });

  test('should have supported libraries available', async () => {
    expect(supportedLibraries.length).toBeGreaterThan(0);
    
    // Verify each library has required properties
    for (const library of supportedLibraries) {
      expect(library).toHaveProperty('name');
      expect(library).toHaveProperty('example');
      expect(library.name).toBeTruthy();
      expect(library.example).toBeTruthy();
    }
  });

  // Create a test for each supported library - commented out to avoid dynamic test creation issues
  // We'll create individual tests below instead
  /*
  supportedLibraries.forEach((library, index) => {
    test(`should successfully process ${library.name}`, async ({ page }) => {
      // Skip this test if library has warning emoji (indicates known issues)
      if (library.name.includes('⚠️')) {
        test.skip(true, `Skipping ${library.name} - known issues indicated by warning`);
      }
      
      const urlInput = page.locator('[data-testid="url-input"]');
      const addButton = page.locator('[data-testid="add-button"]');
      
      // Clear any existing queue items first
      const clearButton = page.locator('[data-testid="clear-completed"]');
      if (await clearButton.isVisible()) {
        await clearButton.click();
        // Handle potential confirmation dialog
        const confirmButton = page.locator('[data-testid="confirm-delete"]');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
      }
      
      // Wait for queue to be empty
      await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(0);
      
      console.log(`Testing library: ${library.name} with URL: ${library.example}`);
      
      // Add the library's example URL
      await urlInput.fill(library.example);
      await expect(addButton).toBeEnabled();
      await addButton.click();
      
      // Wait for the item to be added to queue
      const queueItems = page.locator('[data-testid="queue-item"]');
      await expect(queueItems).toHaveCount(1, { timeout: 15000 });
      
      // Verify the item was processed successfully (not failed)
      const queueItem = queueItems.first();
      
      // Wait for loading to complete (either success or failure)
      await expect(queueItem).not.toHaveClass(/loading-manifest/, { timeout: 30000 });
      
      // Check if the item failed
      const hasFailed = await queueItem.locator('.status-badge.status-failed').isVisible();
      const hasError = await queueItem.locator('.manuscript-error-link').isVisible();
      
      if (hasFailed || hasError) {
        // Get error message for debugging
        let errorMessage = 'Unknown error';
        try {
          const errorElement = queueItem.locator('.manuscript-error-link');
          if (await errorElement.isVisible()) {
            errorMessage = await errorElement.textContent() || 'Error link found';
          }
        } catch (e) {
          // Error getting error message
        }
        
        console.error(`Library ${library.name} failed with error: ${errorMessage}`);
        
        // Take screenshot for debugging
        await page.screenshot({ 
          path: `test-results/library-${library.name.replace(/[^a-zA-Z0-9]/g, '_')}-error.png`,
          fullPage: true 
        });
        
        // Fail the test with detailed error info
        throw new Error(`Library ${library.name} failed to process URL ${library.example}. Error: ${errorMessage}`);
      }
      
      // Verify successful processing
      const statusBadge = queueItem.locator('.status-badge');
      const status = await statusBadge.textContent();
      
      console.log(`Library ${library.name} processed with status: ${status}`);
      
      // Should be pending, loading, or completed - anything except failed
      expect(['pending', 'loading', 'completed']).toContain(status?.toLowerCase());
      
      // Verify basic manuscript info is present
      const manuscriptTitle = queueItem.locator('strong');
      await expect(manuscriptTitle).toBeVisible();
      
      const titleText = await manuscriptTitle.textContent();
      expect(titleText).toBeTruthy();
      expect(titleText).not.toContain('Failed to load');
    });
  });
  */

  // Test individual libraries manually to avoid dynamic test issues
  test('should process Gallica (BnF) library', async ({ page }) => {
    await testSingleLibrary(page, 'Gallica (BnF)');
  });

  test('should process e-codices (Unifr) library', async ({ page }) => {
    await testSingleLibrary(page, 'e-codices (Unifr)');
  });

  test('should process Vatican Library', async ({ page }) => {
    await testSingleLibrary(page, 'Vatican Library');
  });

  test('should process British Library', async ({ page }) => {
    await testSingleLibrary(page, 'British Library');
  });

  test('should process Cambridge University Digital Library', async ({ page }) => {
    await testSingleLibrary(page, 'Cambridge University Digital Library');
  });

  test('should process Trinity College Cambridge', async ({ page }) => {
    await testSingleLibrary(page, 'Trinity College Cambridge');
  });

  // Helper function to test a single library
  async function testSingleLibrary(page: any, libraryName: string) {
    const library = supportedLibraries.find(lib => lib.name === libraryName);
    if (!library) {
      throw new Error(`Library ${libraryName} not found in supported libraries`);
    }

    console.log(`Testing library: ${library.name} with URL: ${library.example}`);

    const urlInput = page.locator('[data-testid="url-input"]');
    const addButton = page.locator('[data-testid="add-button"]');
    
    // Clear any existing queue items first
    const clearButton = page.locator('[data-testid="clear-completed"]');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      // Handle potential confirmation dialog
      const confirmButton = page.locator('[data-testid="confirm-delete"]');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
    
    // Wait for queue to be empty
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(0);
    
    // Add the library's example URL
    await urlInput.fill(library.example);
    await expect(addButton).toBeEnabled();
    await addButton.click();
    
    // Wait for the item to be added to queue
    const queueItems = page.locator('[data-testid="queue-item"]');
    await expect(queueItems).toHaveCount(1, { timeout: 15000 });
    
    // Verify the item was processed successfully (not failed)
    const queueItem = queueItems.first();
    
    // Wait for loading to complete (either success or failure)
    await expect(queueItem).not.toHaveClass(/loading-manifest/, { timeout: 30000 });
    
    // Check if the item failed
    const hasFailed = await queueItem.locator('.status-badge.status-failed').isVisible();
    const hasError = await queueItem.locator('.manuscript-error-link').isVisible();
    
    if (hasFailed || hasError) {
      // Get error message for debugging
      let errorMessage = 'Unknown error';
      try {
        const errorElement = queueItem.locator('.manuscript-error-link');
        if (await errorElement.isVisible()) {
          errorMessage = await errorElement.textContent() || 'Error link found';
        }
      } catch (e) {
        // Error getting error message
      }
      
      console.error(`Library ${library.name} failed with error: ${errorMessage}`);
      
      // Take screenshot for debugging
      await page.screenshot({ 
        path: `test-results/library-${library.name.replace(/[^a-zA-Z0-9]/g, '_')}-error.png`,
        fullPage: true 
      });
      
      // Fail the test with detailed error info
      throw new Error(`Library ${library.name} failed to process URL ${library.example}. Error: ${errorMessage}`);
    }
    
    // Verify successful processing
    const statusBadge = queueItem.locator('.status-badge');
    const status = await statusBadge.textContent();
    
    console.log(`Library ${library.name} processed with status: ${status}`);
    
    // Should be pending, loading, completed, or queued - anything except failed
    expect(['pending', 'loading', 'completed', 'queued']).toContain(status?.toLowerCase());
    
    // Verify basic manuscript info is present
    const manuscriptTitle = queueItem.locator('strong');
    await expect(manuscriptTitle).toBeVisible();
    
    const titleText = await manuscriptTitle.textContent();
    expect(titleText).toBeTruthy();
    expect(titleText).not.toContain('Failed to load');
  }

  test('should handle bulk addition of all libraries', async ({ page }) => {
    const urlInput = page.locator('[data-testid="url-input"]');
    const addButton = page.locator('[data-testid="add-button"]');
    
    // Clear any existing queue items first
    const clearButton = page.locator('[data-testid="clear-completed"]');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      // Handle potential confirmation dialog
      const confirmButton = page.locator('[data-testid="confirm-delete"]');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
    
    // Wait for queue to be empty
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(0);
    
    // Get all non-warning library URLs
    const testUrls = supportedLibraries
      .filter(library => !library.name.includes('⚠️'))
      .map(library => library.example)
      .join('\n');
    
    console.log(`Testing bulk addition of ${supportedLibraries.length} libraries`);
    
    // Add all URLs at once
    await urlInput.fill(testUrls);
    await addButton.click();
    
    // Wait for all items to be processed
    const expectedCount = supportedLibraries.filter(lib => !lib.name.includes('⚠️')).length;
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(expectedCount, { timeout: 45000 });
    
    // Check that most items processed successfully
    const failedItems = page.locator('[data-testid="queue-item"] .status-badge.status-failed');
    const failedCount = await failedItems.count();
    
    console.log(`Bulk test result: ${failedCount} failed out of ${expectedCount} total`);
    
    // Allow some failures but most should succeed
    expect(failedCount).toBeLessThan(expectedCount * 0.5); // Less than 50% failure rate
  });
});