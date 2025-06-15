import { test, expect } from './helpers/electron';

test.describe('Queue Management Operations', () => {
  const testUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b8427295m';

  test.beforeEach(async ({ page }) => {
    // Add a test item to the queue
    const urlInput = page.locator('[data-testid="url-input"]');
    const addButton = page.locator('[data-testid="add-button"]');
    
    await urlInput.fill(testUrl);
    await addButton.click();
  });

  test('should pause and resume individual queue items', async ({ page }) => {
    const queueItem = page.locator('[data-testid="queue-item"]').first();
    const pauseButton = queueItem.locator('[data-testid="pause-button"]');
    const resumeButton = queueItem.locator('[data-testid="resume-button"]');
    
    // Initially should show pause button
    await expect(pauseButton).toBeVisible();
    await expect(resumeButton).not.toBeVisible();
    
    // Pause the item
    await pauseButton.click();
    
    // Should now show resume button
    await expect(resumeButton).toBeVisible();
    await expect(pauseButton).not.toBeVisible();
    
    // Resume the item
    await resumeButton.click();
    
    // Should show pause button again
    await expect(pauseButton).toBeVisible();
    await expect(resumeButton).not.toBeVisible();
  });

  test('should delete queue items', async ({ page }) => {
    const queueItem = page.locator('[data-testid="queue-item"]').first();
    const deleteButton = queueItem.locator('[data-testid="delete-button"]');
    
    await expect(queueItem).toBeVisible();
    
    // Delete the item
    await deleteButton.click();
    
    // Confirm deletion if modal appears
    const confirmButton = page.locator('[data-testid="confirm-delete"]');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
    
    // Item should be removed
    const queueItems = page.locator('[data-testid="queue-item"]');
    await expect(queueItems).toHaveCount(0);
    
    // Should show empty queue message
    const emptyMessage = page.locator('[data-testid="empty-queue-message"]');
    await expect(emptyMessage).toBeVisible();
  });

  test('should edit queue item options', async ({ page }) => {
    const queueItem = page.locator('[data-testid="queue-item"]').first();
    const editButton = queueItem.locator('[data-testid="edit-button"]');
    
    await editButton.click();
    
    // Should open edit modal
    const editModal = page.locator('[data-testid="edit-modal"]');
    await expect(editModal).toBeVisible();
    
    // Test page range editing
    const pageRangeInput = editModal.locator('[data-testid="page-range-input"]');
    await pageRangeInput.fill('1-10');
    
    // Test concurrency editing
    const concurrencyInput = editModal.locator('[data-testid="concurrency-input"]');
    await concurrencyInput.fill('3');
    
    // Save changes
    const saveButton = editModal.locator('[data-testid="save-button"]');
    await saveButton.click();
    
    // Modal should close
    await expect(editModal).not.toBeVisible();
    
    // Item should reflect changes
    await expect(queueItem).toContainText('1-10');
    await expect(queueItem).toContainText('3 concurrent');
  });

  test('should control entire queue (start/pause/stop)', async ({ page }) => {
    // Add multiple items to queue
    const urlInput = page.locator('[data-testid="url-input"]');
    const addButton = page.locator('[data-testid="add-button"]');
    
    await urlInput.fill('https://www.e-codices.unifr.ch/en/csg/0391');
    await addButton.click();
    
    const queueControls = page.locator('[data-testid="queue-controls"]');
    const startQueueButton = queueControls.locator('[data-testid="start-queue"]');
    const pauseQueueButton = queueControls.locator('[data-testid="pause-queue"]');
    const stopQueueButton = queueControls.locator('[data-testid="stop-queue"]');
    
    // Initially should show start button
    await expect(startQueueButton).toBeVisible();
    await expect(pauseQueueButton).not.toBeVisible();
    
    // Start queue
    await startQueueButton.click();
    
    // Should now show pause and stop buttons
    await expect(pauseQueueButton).toBeVisible();
    await expect(stopQueueButton).toBeVisible();
    await expect(startQueueButton).not.toBeVisible();
    
    // Pause queue
    await pauseQueueButton.click();
    
    // Should show resume (start) button
    await expect(startQueueButton).toBeVisible();
    await expect(pauseQueueButton).not.toBeVisible();
    
    // Stop queue
    await stopQueueButton.click();
    
    // Should reset to initial state
    await expect(startQueueButton).toBeVisible();
    await expect(pauseQueueButton).not.toBeVisible();
    await expect(stopQueueButton).not.toBeVisible();
  });

  test('should clear completed items', async ({ page }) => {
    // Simulate completed items by adding multiple items
    const urlInput = page.locator('[data-testid="url-input"]');
    const addButton = page.locator('[data-testid="add-button"]');
    
    const urls = [
      'https://www.e-codices.unifr.ch/en/csg/0391',
      'https://digi.vatlib.it/view/MSS_Vat.lat.3225'
    ];
    
    for (const url of urls) {
      await urlInput.fill(url);
      await addButton.click();
      await urlInput.clear();
    }
    
    // Should have 3 total items now
    const queueItems = page.locator('[data-testid="queue-item"]');
    await expect(queueItems).toHaveCount(3);
    
    // Look for clear completed button
    const clearCompletedButton = page.locator('[data-testid="clear-completed"]');
    
    if (await clearCompletedButton.isVisible()) {
      await clearCompletedButton.click();
      
      // Confirm if modal appears
      const confirmButton = page.locator('[data-testid="confirm-clear"]');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
  });
});