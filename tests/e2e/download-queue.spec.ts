import { test, expect } from './helpers/electron';

test.describe('Download Queue Management', () => {
  test('should launch application and show download queue interface', async ({ page }) => {
    await expect(page).toHaveTitle(/Manuscript Downloader/);
    
    // Check if main components are visible
    await expect(page.locator('[data-testid="download-queue"]')).toBeVisible();
    await expect(page.locator('[data-testid="url-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="add-button"]')).toBeVisible();
  });

  test('should display empty queue initially', async ({ page }) => {
    const queueItems = page.locator('[data-testid="queue-item"]');
    await expect(queueItems).toHaveCount(0);
    
    const emptyMessage = page.locator('[data-testid="empty-queue-message"]');
    await expect(emptyMessage).toBeVisible();
  });

  test('should show queue statistics', async ({ page }) => {
    const statsPanel = page.locator('[data-testid="queue-stats"]');
    await expect(statsPanel).toBeVisible();
    
    const totalItems = page.locator('[data-testid="total-items"]');
    const completedItems = page.locator('[data-testid="completed-items"]');
    const progressBar = page.locator('[data-testid="progress-bar"]');
    
    await expect(totalItems).toBeVisible();
    await expect(completedItems).toBeVisible();
    await expect(progressBar).toBeVisible();
  });
});