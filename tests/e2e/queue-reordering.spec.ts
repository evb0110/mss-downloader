import { test, expect } from '../electron-test';

test.describe('Queue Reordering Functionality', () => {
  test.beforeEach(async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    
    // Clear any existing queue items first
    const hasQueueItems = await page.locator('[data-testid="queue-item"]').count() > 0;
    if (hasQueueItems) {
      // Click Delete All button
      await page.click('.clear-queue-btn');
      
      // Handle confirmation modal if it appears
      try {
        await page.waitForSelector('.modal-overlay', { timeout: 2000 });
        
        // Click the confirm delete button
        await page.click('[data-testid="confirm-delete"]');
        
        // Wait for modal to disappear
        await page.waitForSelector('.modal-overlay', { state: 'hidden', timeout: 5000 });
      } catch (e) {
        console.log('Modal handling error:', e.message);
        // No modal appeared or couldn't handle it
      }
      
      // Wait for queue to be empty
      await page.waitForSelector('[data-testid="empty-queue-message"]', { timeout: 10000 });
    } else {
      // Already empty, just wait for the message
      await page.waitForSelector('[data-testid="empty-queue-message"]', { timeout: 10000 });
    }
  });

  test('should display move buttons for pending items', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    // Add multiple test manuscripts
    const testUrls = [
      'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
      'https://gallica.bnf.fr/ark:/12148/btv1b8447295h',
      'https://gallica.bnf.fr/ark:/12148/btv1b8432687g'
    ];

    await page.fill('[data-testid="url-input"]', testUrls.join('\n'));
    await page.click('[data-testid="add-button"]');

    // Wait for items to be added
    await page.waitForSelector('[data-testid="queue-item"]');
    
    // Check that there are 3 items
    const queueItems = await page.locator('[data-testid="queue-item"]').count();
    expect(queueItems).toBe(3);

    // First item should have move-down button only
    const firstItem = page.locator('[data-testid="queue-item"]').first();
    await expect(firstItem.locator('.move-up-btn')).not.toBeVisible();
    await expect(firstItem.locator('.move-down-btn')).toBeVisible();

    // Second item should have both buttons
    const secondItem = page.locator('[data-testid="queue-item"]').nth(1);
    await expect(secondItem.locator('.move-up-btn')).toBeVisible();
    await expect(secondItem.locator('.move-down-btn')).toBeVisible();

    // Last item should have move-up button only
    const lastItem = page.locator('[data-testid="queue-item"]').last();
    await expect(lastItem.locator('.move-up-btn')).toBeVisible();
    await expect(lastItem.locator('.move-down-btn')).not.toBeVisible();
  });

  test('should reorder items when move buttons are clicked', async ({ page }) => {
    const testUrls = [
      'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
      'https://gallica.bnf.fr/ark:/12148/btv1b8447295h'
    ];

    await page.fill('[data-testid="url-input"]', testUrls.join('\n'));
    await page.click('[data-testid="add-button"]');
    await page.waitForSelector('[data-testid="queue-item"]');

    // Get initial order
    const initialFirstTitle = await page.locator('[data-testid="queue-item"]').first().locator('.manuscript-title-link').textContent();
    const initialSecondTitle = await page.locator('[data-testid="queue-item"]').nth(1).locator('.manuscript-title-link').textContent();

    // Move second item up
    await page.locator('[data-testid="queue-item"]').nth(1).locator('.move-up-btn').click();

    // Wait for reordering
    await page.waitForTimeout(500);

    // Check new order
    const newFirstTitle = await page.locator('[data-testid="queue-item"]').first().locator('.manuscript-title-link').textContent();
    const newSecondTitle = await page.locator('[data-testid="queue-item"]').nth(1).locator('.manuscript-title-link').textContent();

    expect(newFirstTitle).toBe(initialSecondTitle);
    expect(newSecondTitle).toBe(initialFirstTitle);
  });

  test('should disable move buttons when downloads are active', async ({ page }) => {
    const testUrls = [
      'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
      'https://gallica.bnf.fr/ark:/12148/btv1b8447295h'
    ];

    await page.fill('[data-testid="url-input"]', testUrls.join('\n'));
    await page.click('[data-testid="add-button"]');
    await page.waitForSelector('[data-testid="queue-item"]');

    // Start the queue
    await page.click('[data-testid="start-queue"]');

    // Wait for download to start
    await page.waitForSelector('.status-downloading', { timeout: 10000 });

    // Check that move buttons are not visible
    await expect(page.locator('.move-up-btn')).not.toBeVisible();
    await expect(page.locator('.move-down-btn')).not.toBeVisible();

    // Stop the queue
    await page.click('[data-testid="stop-queue"]');
    await page.waitForTimeout(1000);

    // Move buttons should be visible again
    await expect(page.locator('.move-down-btn').first()).toBeVisible();
  });

  test('should handle auto-split parts correctly', async ({ page }) => {
    // Use a larger manuscript that might get auto-split
    const largeManuscriptUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b8452439d';
    
    await page.fill('[data-testid="url-input"]', largeManuscriptUrl);
    await page.click('[data-testid="add-button"]');
    await page.waitForSelector('[data-testid="queue-item"]');

    // Check if toggle button appears for auto-split items
    const toggleButton = page.locator('.toggle-parts-btn');
    if (await toggleButton.isVisible()) {
      // Click to expand parts
      await toggleButton.click();
      
      // Check that parts are visible
      await expect(page.locator('[data-testid="queue-part"]')).toBeVisible();
      
      // Verify that parts don't have move buttons
      const partControls = page.locator('[data-testid="queue-part"] .queue-item-controls');
      await expect(partControls.locator('.move-up-btn')).not.toBeVisible();
      await expect(partControls.locator('.move-down-btn')).not.toBeVisible();
      
      // Collapse parts
      await toggleButton.click();
      await expect(page.locator('[data-testid="queue-part"]')).not.toBeVisible();
    }
  });

  test('should show overall progress for grouped items', async ({ page }) => {
    const testUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b8452439d';
    
    await page.fill('[data-testid="url-input"]', testUrl);
    await page.click('[data-testid="add-button"]');
    await page.waitForSelector('[data-testid="queue-item"]');

    // Start download
    await page.click('[data-testid="start-queue"]');
    
    // Wait for progress to appear
    await page.waitForSelector('.item-progress', { timeout: 15000 });
    
    // Check that progress is displayed
    await expect(page.locator('.item-progress-header')).toBeVisible();
    await expect(page.locator('.item-progress-bar')).toBeVisible();
    
    // If there are parts, check overall progress
    const toggleButton = page.locator('.toggle-parts-btn');
    if (await toggleButton.isVisible()) {
      await expect(page.locator('.group-progress')).toBeVisible();
    }

    // Stop the queue
    await page.click('[data-testid="stop-queue"]');
  });

  test('should maintain correct order after queue processing', async ({ page }) => {
    const testUrls = [
      'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
      'https://gallica.bnf.fr/ark:/12148/btv1b8447295h',
      'https://gallica.bnf.fr/ark:/12148/btv1b8432687g'
    ];

    await page.fill('[data-testid="url-input"]', testUrls.join('\n'));
    await page.click('[data-testid="add-button"]');
    await page.waitForSelector('[data-testid="queue-item"]');

    // Reorder: move last item to first
    await page.locator('[data-testid="queue-item"]').last().locator('.move-up-btn').click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="queue-item"]').nth(1).locator('.move-up-btn').click();
    await page.waitForTimeout(300);

    // Get the reordered titles
    const reorderedTitles = await page.locator('[data-testid="queue-item"] .manuscript-title-link').allTextContents();

    // Start processing for a short time
    await page.click('[data-testid="start-queue"]');
    await page.waitForTimeout(3000);
    await page.click('[data-testid="stop-queue"]');
    await page.waitForTimeout(1000);

    // Check that order is maintained
    const finalTitles = await page.locator('[data-testid="queue-item"] .manuscript-title-link').allTextContents();
    expect(finalTitles).toEqual(reorderedTitles);
  });

  test('should handle group operations correctly', async ({ page }) => {
    const testUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b8452439d';
    
    await page.fill('[data-testid="url-input"]', testUrl);
    await page.click('[data-testid="add-button"]');
    await page.waitForSelector('[data-testid="queue-item"]');

    // Start download
    await page.click('[data-testid="start-queue"]');
    await page.waitForTimeout(2000);

    // Test pause group
    if (await page.locator('.pause-item-btn').isVisible()) {
      await page.locator('.pause-item-btn').click();
      await page.waitForTimeout(500);
      await expect(page.locator('.resume-item-btn')).toBeVisible();
    }

    // Stop the queue
    await page.click('[data-testid="stop-queue"]');
  });

  test('should handle delete group functionality', async ({ page }) => {
    const testUrls = [
      'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
      'https://gallica.bnf.fr/ark:/12148/btv1b8447295h'
    ];

    await page.fill('[data-testid="url-input"]', testUrls.join('\n'));
    await page.click('[data-testid="add-button"]');
    await page.waitForSelector('[data-testid="queue-item"]');

    const initialCount = await page.locator('[data-testid="queue-item"]').count();
    expect(initialCount).toBe(2);

    // Delete first item
    await page.locator('[data-testid="queue-item"]').first().locator('[data-testid="delete-button"]').click();
    
    // Confirm deletion in modal
    await page.waitForSelector('.modal-confirm');
    await page.click('.confirm-btn');
    
    // Wait for item to be removed
    await page.waitForTimeout(500);
    
    const finalCount = await page.locator('[data-testid="queue-item"]').count();
    expect(finalCount).toBe(1);
  });
});