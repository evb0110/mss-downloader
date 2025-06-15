import { test, expect } from './helpers/electron';

test.describe('Manuscript URL Processing', () => {
  const testUrls = {
    gallica: 'https://gallica.bnf.fr/ark:/12148/btv1b8427295m',
    ecodices: 'https://www.e-codices.unifr.ch/en/csg/0391',
    vatican: 'https://digi.vatlib.it/view/MSS_Vat.lat.3225',
  };

  test('should accept valid manuscript URLs', async ({ page }) => {
    const urlInput = page.locator('[data-testid="url-input"]');
    const addButton = page.locator('[data-testid="add-button"]');
    
    // Test Gallica URL
    await urlInput.fill(testUrls.gallica);
    await expect(addButton).toBeEnabled();
    
    await addButton.click();
    
    // Check that item was added to queue
    const queueItems = page.locator('[data-testid="queue-item"]');
    await expect(queueItems).toHaveCount(1);
    
    // Verify URL is displayed in queue item
    const firstItem = queueItems.first();
    await expect(firstItem).toContainText('gallica.bnf.fr');
  });

  test('should reject invalid URLs', async ({ page }) => {
    const urlInput = page.locator('[data-testid="url-input"]');
    const addButton = page.locator('[data-testid="add-button"]');
    
    // Test invalid URL
    await urlInput.fill('not-a-valid-url');
    await expect(addButton).toBeDisabled();
    
    // Test unsupported domain
    await urlInput.fill('https://example.com/manuscript');
    await expect(addButton).toBeDisabled();
  });

  test('should handle bulk URL addition', async ({ page }) => {
    const urlInput = page.locator('[data-testid="url-input"]');
    const addButton = page.locator('[data-testid="add-button"]');
    
    // Add multiple URLs
    for (const url of Object.values(testUrls)) {
      await urlInput.fill(url);
      await addButton.click();
      await urlInput.clear();
    }
    
    // Check that all items were added
    const queueItems = page.locator('[data-testid="queue-item"]');
    await expect(queueItems).toHaveCount(3);
    
    // Verify statistics updated
    const totalItems = page.locator('[data-testid="total-items"]');
    await expect(totalItems).toContainText('3');
  });

  test('should prevent duplicate URLs', async ({ page }) => {
    const urlInput = page.locator('[data-testid="url-input"]');
    const addButton = page.locator('[data-testid="add-button"]');
    
    // Add same URL twice
    await urlInput.fill(testUrls.gallica);
    await addButton.click();
    await urlInput.clear();
    
    await urlInput.fill(testUrls.gallica);
    await addButton.click();
    
    // Should still only have one item
    const queueItems = page.locator('[data-testid="queue-item"]');
    await expect(queueItems).toHaveCount(1);
    
    // Should show duplicate error message
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('already exists');
  });
});