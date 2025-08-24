import { test, expect } from './helpers/electron.js';

// Issue #58: Morgan URL with objectId loses segment leading to 404 when fetching /thumbs
// Repro URL from issue body: https://www.themorgan.org/collection/gospel-book/143812/thumbs

test.describe('Morgan Library objectId URL', () => {
  test('loads manifest from slug/objectId/thumbs without 404', async ({ page }) => {
    const url = 'https://www.themorgan.org/collection/gospel-book/143812/thumbs';

    // Ensure clean queue
    const deleteAllButton = page.locator('button:has-text("Delete All")');
    if (await deleteAllButton.isVisible() && await deleteAllButton.isEnabled()) {
      await deleteAllButton.click();
      await page.waitForTimeout(400);
      const confirmButton = page.locator('[data-testid="confirm-delete"]').first();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await page.waitForTimeout(800);
      }
    }

    // Add URL
    const addMoreButton = page.locator('button:has-text("Add More Documents")');
    if (await addMoreButton.isVisible()) {
      await addMoreButton.click();
      await page.waitForTimeout(300);
    }

    const urlInput = page.locator('[data-testid="url-input"], textarea').first();
    const addButton = page.locator('[data-testid="add-button"], button:has-text("Add"):not([disabled])').first();

    await urlInput.fill(url);
    await addButton.click();

    // Wait for processing and ensure no 404 failure text appears
    const queueItem = page.locator('[data-testid="queue-item"]').first();

    // Poll the title/text for success and absence of error
    let loaded = false;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      const title = await queueItem.locator('strong').textContent();
      const status = await queueItem.locator('.status-badge').textContent();
      if (title && !title.includes('Loading manifest') && !title.includes('Failed') && !title.includes('Error')) {
        loaded = true;
        break;
      }
      if ((status || '').toLowerCase().includes('failed')) {
        await page.screenshot({ path: 'test-results/morgan-objectid-failed.png', fullPage: true });
        throw new Error('Morgan objectId manifest failed: ' + status);
      }
    }

    expect(loaded).toBe(true);

    // Start download to ensure pages are discoverable
    const startButton = page.locator('button.start-btn, button:has-text("Resume Queue")').first();
    await expect(startButton).toBeVisible();
    await expect(startButton).toBeEnabled();

    await startButton.click();

    // Observe some progress
    let sawProgress = false;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1500);
      const hasProgress = await queueItem.locator('*').filter({ hasText: /(\d+\s*of\s*\d+|\d+%|Downloading\s+\d+|Calculating)/ }).count() > 0;
      if (hasProgress) { sawProgress = true; break; }
      const status = await queueItem.locator('.status-badge').textContent();
      if ((status || '').toLowerCase().includes('failed')) {
        await page.screenshot({ path: 'test-results/morgan-objectid-download-failed.png', fullPage: true });
        throw new Error('Morgan objectId download failed: ' + status);
      }
    }

    expect(sawProgress).toBe(true);

    await page.screenshot({ path: 'test-results/morgan-objectid-success.png', fullPage: true });
  });
});

