import { test, expect } from './helpers/electron';

test.describe('Orleans Library Test', () => {
  test('should support Orleans library and load manifest', async ({ page }) => {
    console.log('Testing Orleans library support...');
    
    // Get supported libraries
    const supportedLibraries = await page.evaluate(async () => {
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
    
    // Check if Orleans is in the supported libraries
    const orleansLib = supportedLibraries.find((lib: any) => lib.name.includes('Orléans'));
    expect(orleansLib).toBeTruthy();
    console.log('✅ Orleans library found in supported libraries');
    console.log('Orleans library:', orleansLib);
    
    // Test URL detection and manifest loading
    const orleansUrl = 'https://mediatheques.orleans.fr/recherche/viewnotice/clef/FRAGMENTSDEDIFFERENTSLIVRESDELECRITURESAINTE--AUGUSTINSAINT----28/id/745380';
    
    // Clear any existing items
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
    
    // Add Orleans manuscript
    const addMoreButton = page.locator('button:has-text("Add More Documents")');
    if (await addMoreButton.isVisible()) {
      await addMoreButton.click();
      await page.waitForTimeout(500);
    }
    
    const urlInput = page.locator('textarea').first();
    const addButton = page.locator('button').filter({ hasText: /Add|Submit/ }).first();
    
    if (await urlInput.isVisible()) {
      await urlInput.fill(orleansUrl);
      if (await addButton.isVisible() && await addButton.isEnabled()) {
        await addButton.click();
      }
    }
    
    console.log('Waiting for Orleans manifest to load...');
    
    // Wait for manifest loading
    const queueItem = page.locator('[data-testid="queue-item"]').first();
    let manifestLoaded = false;
    let manifestName = '';
    
    for (let attempt = 0; attempt < 15; attempt++) {
      await page.waitForTimeout(3000);
      
      const titleElement = queueItem.locator('strong');
      const currentTitle = await titleElement.textContent();
      
      // Check for explicit error messages first
      if (currentTitle && currentTitle.includes('Error invoking remote method')) {
        console.log(`❌ Orleans manifest error: ${currentTitle}`);
        throw new Error(`Manifest loading failed: ${currentTitle}`);
      }
      
      if (currentTitle && !currentTitle.includes('Loading manifest')) {
        manifestLoaded = true;
        manifestName = currentTitle;
        console.log(`✅ Orleans manifest loaded: ${currentTitle}`);
        break;
      }
      
      // Check status badge for failure states
      const statusBadge = queueItem.locator('.status-badge');
      const status = await statusBadge.textContent();
      if (status?.toLowerCase().includes('failed')) {
        console.log(`❌ Orleans manifest failed with status: ${status}`);
        throw new Error(`Manifest failed with status: ${status}`);
      }
      
      if (attempt % 3 === 0) {
        console.log(`  ... still loading Orleans manifest (attempt ${attempt + 1}/15)`);
        // Log current state for debugging
        console.log(`  Current title: "${currentTitle}"`);
        console.log(`  Current status: "${status}"`);
      }
    }
    
    expect(manifestLoaded).toBe(true);
    expect(manifestName).toBeTruthy();
    expect(manifestName).not.toContain('Error');
    
    console.log('✅ Orleans library test completed successfully!');
  });
});