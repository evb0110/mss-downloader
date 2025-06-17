import { test, expect } from './helpers/electron';

test.describe('RBME Library Support', () => {
  test('should launch app and show basic interface', async ({ page }) => {
    // Wait for the app to load
    await expect(page).toHaveTitle(/Manuscript Downloader/);
    await expect(page.locator('[data-testid="download-queue"]')).toBeVisible();
    await expect(page.locator('[data-testid="url-input"]')).toBeVisible();
  });

  test('should process RBME URL', async ({ page }) => {
    // Wait for app to load  
    await expect(page).toHaveTitle(/Manuscript Downloader/);
    await expect(page.locator('[data-testid="url-input"]')).toBeVisible();
    
    // Enter a RBME URL
    const testUrl = 'https://rbme.patrimonionacional.es/s/rbme/item/14374';
    await page.fill('[data-testid="url-input"]', testUrl);
    
    // Wait a moment for the UI to update
    await page.waitForTimeout(1000);
    
    // Take a screenshot to see current state
    await page.screenshot({ path: 'test-results/rbme-state.png' });
  });
});