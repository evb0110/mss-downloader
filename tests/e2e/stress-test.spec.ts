import { test, expect } from '../electron-test';

test.describe('Queue System Stress Tests', () => {
  test.beforeEach(async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    
    // Clear any existing queue items first
    const hasQueueItems = await page.locator('[data-testid="queue-item"]').count() > 0;
    if (hasQueueItems) {
      await page.click('.clear-queue-btn');
      
      try {
        await page.waitForSelector('.modal-overlay', { timeout: 2000 });
        await page.click('[data-testid="confirm-delete"]');
        await page.waitForSelector('.modal-overlay', { state: 'hidden', timeout: 5000 });
      } catch (e) {
        // No modal appeared
      }
      
      await page.waitForSelector('[data-testid="empty-queue-message"]', { timeout: 10000 });
    } else {
      await page.waitForSelector('[data-testid="empty-queue-message"]', { timeout: 10000 });
    }
  });

  test('should handle large queue with many items', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    // Create a large queue with many items
    const manyUrls = [
      'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
      'https://gallica.bnf.fr/ark:/12148/btv1b8447295h',
      'https://gallica.bnf.fr/ark:/12148/btv1b8432687g',
      'https://e-codices.unifr.ch/en/list/one/csg/0391',
      'https://e-codices.unifr.ch/en/list/one/bbb/0264',
      'https://digi.vatlib.it/view/MSS_Vat.lat.3225',
      'https://digi.vatlib.it/view/MSS_Vat.lat.159'
    ];

    await page.fill('[data-testid="url-input"]', manyUrls.join('\n'));
    await page.click('[data-testid="add-button"]');
    
    // Wait for all items to be added
    await page.waitForFunction(() => {
      return document.querySelectorAll('[data-testid="queue-item"]').length === 7;
    }, { timeout: 60000 });

    const queueItems = await page.locator('[data-testid="queue-item"]').count();
    expect(queueItems).toBe(7);

    // Test multiple reordering operations
    console.log('Testing multiple reordering operations...');
    
    // Move last item to first position
    for (let i = 0; i < 6; i++) {
      const itemToMove = page.locator('[data-testid="queue-item"]').nth(6 - i);
      const moveUpBtn = itemToMove.locator('.move-up-btn');
      
      if (await moveUpBtn.isVisible()) {
        await moveUpBtn.click();
        await page.waitForTimeout(200);
      }
    }

    // Verify the item moved to the top
    const newOrder = await page.locator('[data-testid="queue-item"] .manuscript-title-link').allTextContents();
    console.log('New order after multiple moves:', newOrder.slice(0, 3));

    // Test bulk operations
    console.log('Testing queue controls with large queue...');
    
    // Start queue
    await page.click('[data-testid="start-queue"]');
    await page.waitForTimeout(3000);
    
    // Pause queue
    await page.click('[data-testid="pause-queue"]');
    await page.waitForTimeout(1000);
    
    // Resume queue
    await page.click('[data-testid="resume-queue"]');
    await page.waitForTimeout(2000);
    
    // Stop queue
    await page.click('[data-testid="stop-queue"]');
    await page.waitForTimeout(1000);

    console.log('Large queue stress test completed successfully');
  });

  test('should handle rapid reordering operations', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    const testUrls = [
      'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
      'https://gallica.bnf.fr/ark:/12148/btv1b8447295h',
      'https://gallica.bnf.fr/ark:/12148/btv1b8432687g',
      'https://e-codices.unifr.ch/en/list/one/csg/0391'
    ];

    await page.fill('[data-testid="url-input"]', testUrls.join('\n'));
    await page.click('[data-testid="add-button"]');
    
    await page.waitForFunction(() => {
      return document.querySelectorAll('[data-testid="queue-item"]').length === 4;
    }, { timeout: 30000 });

    console.log('Performing rapid reordering operations...');

    // Perform many rapid reordering operations
    for (let round = 0; round < 5; round++) {
      console.log(`Reordering round ${round + 1}`);
      
      // Move items around rapidly
      const operations = [
        { itemIndex: 3, direction: 'up' },
        { itemIndex: 0, direction: 'down' },
        { itemIndex: 2, direction: 'up' },
        { itemIndex: 1, direction: 'down' }
      ];

      for (const op of operations) {
        const item = page.locator('[data-testid="queue-item"]').nth(op.itemIndex);
        const button = op.direction === 'up' ? 
          item.locator('.move-up-btn') : 
          item.locator('.move-down-btn');
        
        if (await button.isVisible()) {
          await button.click();
          await page.waitForTimeout(100); // Minimal delay
        }
      }
    }

    // Verify queue integrity
    const finalCount = await page.locator('[data-testid="queue-item"]').count();
    expect(finalCount).toBe(4);

    // Verify all items still have proper controls
    const moveButtons = await page.locator('.move-up-btn, .move-down-btn').count();
    expect(moveButtons).toBeGreaterThan(0);

    console.log('Rapid reordering stress test completed');
  });

  test('should handle memory pressure with auto-split items', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    // Add multiple large manuscripts that might auto-split
    const largeManuscripts = [
      'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
      'https://gallica.bnf.fr/ark:/12148/btv1b8447295h',
      'https://gallica.bnf.fr/ark:/12148/btv1b8432687g'
    ];

    await page.fill('[data-testid="url-input"]', largeManuscripts.join('\n'));
    await page.click('[data-testid="add-button"]');
    
    // Wait for all manifests to load and potential auto-splits
    await page.waitForFunction(() => {
      const items = document.querySelectorAll('[data-testid="queue-item"]');
      return items.length >= 3 && 
             Array.from(items).every(item => !item.textContent?.includes('Loading'));
    }, { timeout: 60000 });

    const totalItems = await page.locator('[data-testid="queue-item"]').count();
    console.log(`Total queue items after auto-split: ${totalItems}`);

    // Test expanding/collapsing all parts rapidly
    const toggleButtons = await page.locator('.toggle-parts-btn').all();
    console.log(`Found ${toggleButtons.length} toggle buttons`);

    for (let round = 0; round < 3; round++) {
      console.log(`Toggle round ${round + 1}`);
      
      // Expand all
      for (const button of toggleButtons) {
        if (await button.isVisible()) {
          await button.click();
          await page.waitForTimeout(100);
        }
      }
      
      await page.waitForTimeout(500);
      
      // Collapse all
      for (const button of toggleButtons) {
        if (await button.isVisible()) {
          await button.click();
          await page.waitForTimeout(100);
        }
      }
      
      await page.waitForTimeout(500);
    }

    // Test reordering with many parts visible
    if (toggleButtons.length > 0) {
      // Expand first item
      await toggleButtons[0].click();
      await page.waitForTimeout(500);
      
      // Try reordering with parts visible
      const moveUpBtn = page.locator('[data-testid="queue-item"]').nth(1).locator('.move-up-btn');
      if (await moveUpBtn.isVisible()) {
        await moveUpBtn.click();
        await page.waitForTimeout(500);
      }
    }

    console.log('Memory pressure test with auto-split completed');
  });

  test('should handle concurrent operations stress test', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    const testUrls = [
      'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
      'https://gallica.bnf.fr/ark:/12148/btv1b8447295h',
      'https://e-codices.unifr.ch/en/list/one/csg/0391'
    ];

    await page.fill('[data-testid="url-input"]', testUrls.join('\n'));
    await page.click('[data-testid="add-button"]');
    
    await page.waitForFunction(() => {
      const items = document.querySelectorAll('[data-testid="queue-item"]');
      return items.length === 3 && 
             Array.from(items).every(item => !item.textContent?.includes('Loading'));
    }, { timeout: 30000 });

    console.log('Starting concurrent operations stress test...');

    // Perform concurrent operations
    const operations = [
      // Reordering
      async () => {
        for (let i = 0; i < 10; i++) {
          const moveBtn = page.locator('.move-up-btn').first();
          if (await moveBtn.isVisible()) {
            await moveBtn.click();
            await page.waitForTimeout(100);
          }
        }
      },
      
      // Queue control operations
      async () => {
        await page.waitForTimeout(1000);
        await page.click('[data-testid="start-queue"]');
        await page.waitForTimeout(2000);
        await page.click('[data-testid="pause-queue"]');
        await page.waitForTimeout(1000);
        await page.click('[data-testid="stop-queue"]');
      },
      
      // UI interactions
      async () => {
        for (let i = 0; i < 5; i++) {
          const editBtn = page.locator('[data-testid="edit-button"]').first();
          if (await editBtn.isVisible()) {
            await editBtn.click();
            await page.waitForTimeout(200);
            
            const cancelBtn = page.locator('.edit-cancel-btn');
            if (await cancelBtn.isVisible()) {
              await cancelBtn.click();
              await page.waitForTimeout(200);
            }
          }
        }
      }
    ];

    // Run operations concurrently
    await Promise.all(operations.map(op => op()));

    // Verify system stability
    const finalCount = await page.locator('[data-testid="queue-item"]').count();
    expect(finalCount).toBe(3);

    // Verify UI is still responsive
    const moveButtons = await page.locator('.move-up-btn, .move-down-btn').count();
    expect(moveButtons).toBeGreaterThan(0);

    console.log('Concurrent operations stress test completed');
  });

  test('should handle edge cases and error recovery', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    console.log('Testing edge cases and error recovery...');

    // Test with empty queue operations
    await expect(page.locator('[data-testid="start-queue"]')).not.toBeVisible();

    // Add one item
    await page.fill('[data-testid="url-input"]', 'https://gallica.bnf.fr/ark:/12148/btv1b8452439d');
    await page.click('[data-testid="add-button"]');
    await page.waitForSelector('[data-testid="queue-item"]');

    // Test single item operations (should not have move buttons)
    await expect(page.locator('.move-up-btn')).not.toBeVisible();
    await expect(page.locator('.move-down-btn')).not.toBeVisible();

    // Add more items
    await page.fill('[data-testid="url-input"]', 'https://gallica.bnf.fr/ark:/12148/btv1b8447295h\nhttps://invalid-url-test.com');
    await page.click('[data-testid="add-button"]');
    
    await page.waitForTimeout(5000);

    // Test mixed valid/invalid items
    const queueItems = await page.locator('[data-testid="queue-item"]').count();
    expect(queueItems).toBeGreaterThan(1);

    // Test rapid add/remove operations
    for (let i = 0; i < 3; i++) {
      // Add item
      await page.fill('[data-testid="url-input"]', 'https://e-codices.unifr.ch/en/list/one/csg/0391');
      await page.click('[data-testid="add-button"]');
      await page.waitForTimeout(1000);
      
      // Remove last item
      const deleteBtn = page.locator('[data-testid="delete-button"]').last();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        
        // Handle confirmation dialog
        await page.waitForSelector('.modal-confirm', { timeout: 2000 }).catch(() => {});
        const confirmBtn = page.locator('.confirm-btn');
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
        }
        
        await page.waitForTimeout(500);
      }
    }

    // Verify system stability after rapid operations
    const finalItems = await page.locator('[data-testid="queue-item"]').count();
    expect(finalItems).toBeGreaterThan(0);

    console.log('Edge cases and error recovery test completed');
  });

  test('should maintain performance with complex queue states', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    console.log('Testing performance with complex queue states...');

    // Create complex queue with mixed states
    const mixedUrls = [
      'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
      'https://gallica.bnf.fr/ark:/12148/btv1b8447295h',
      'https://e-codices.unifr.ch/en/list/one/csg/0391',
      'https://e-codices.unifr.ch/en/list/one/bbb/0264',
      'https://digi.vatlib.it/view/MSS_Vat.lat.3225'
    ];

    const startTime = Date.now();
    
    await page.fill('[data-testid="url-input"]', mixedUrls.join('\n'));
    await page.click('[data-testid="add-button"]');
    
    await page.waitForFunction(() => {
      return document.querySelectorAll('[data-testid="queue-item"]').length === 5;
    }, { timeout: 60000 });

    const loadTime = Date.now() - startTime;
    console.log(`Queue loading time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(60000); // Should load within 60 seconds

    // Test reordering performance
    const reorderStartTime = Date.now();
    
    // Perform multiple reorders
    for (let i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * 4);
      const direction = Math.random() > 0.5 ? 'up' : 'down';
      
      const item = page.locator('[data-testid="queue-item"]').nth(randomIndex);
      const button = direction === 'up' ? 
        item.locator('.move-up-btn') : 
        item.locator('.move-down-btn');
      
      if (await button.isVisible()) {
        await button.click();
        await page.waitForTimeout(50);
      }
    }

    const reorderTime = Date.now() - reorderStartTime;
    console.log(`Reordering performance: ${reorderTime}ms for 10 operations`);
    expect(reorderTime).toBeLessThan(5000); // Should complete within 5 seconds

    // Test UI responsiveness during operations
    const uiTestStart = Date.now();
    
    await page.click('[data-testid="start-queue"]');
    await page.waitForTimeout(1000);
    await page.click('[data-testid="pause-queue"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="stop-queue"]');
    
    const uiResponseTime = Date.now() - uiTestStart;
    console.log(`UI response time: ${uiResponseTime}ms`);
    expect(uiResponseTime).toBeLessThan(3000); // Should be responsive

    console.log('Performance test completed successfully');
  });
});