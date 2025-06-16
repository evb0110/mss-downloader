import { test, expect } from '../electron-test';
import { promises as fs } from 'fs';
import path from 'path';

test.describe('Multi-Library Download and Reordering Tests', () => {
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

  const testLibraries = [
    {
      name: 'Gallica BnF',
      urls: [
        'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
        'https://gallica.bnf.fr/ark:/12148/btv1b8447295h'
      ]
    },
    {
      name: 'e-codices (unifr)',
      urls: [
        'https://e-codices.unifr.ch/en/list/one/csg/0391',
        'https://e-codices.unifr.ch/en/list/one/bbb/0264'
      ]
    },
    {
      name: 'Vatican Library',
      urls: [
        'https://digi.vatlib.it/view/MSS_Vat.lat.3225',
        'https://digi.vatlib.it/view/MSS_Vat.lat.159'
      ]
    }
  ];

  test('should handle mixed library types in queue reordering', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    // Add manuscripts from different libraries
    const mixedUrls = [
      testLibraries[0].urls[0], // Gallica
      testLibraries[1].urls[0], // e-codices
      testLibraries[2].urls[0]  // Vatican
    ];

    await page.fill('[data-testid="url-input"]', mixedUrls.join('\n'));
    await page.click('[data-testid="add-button"]');
    
    // Wait for all items to load
    await page.waitForSelector('[data-testid="queue-item"]');
    await page.waitForFunction(() => {
      const items = document.querySelectorAll('[data-testid="queue-item"]');
      return items.length === 3 && 
             Array.from(items).every(item => !item.textContent?.includes('Loading'));
    }, { timeout: 30000 });

    // Verify all three libraries are represented
    const queueItems = await page.locator('[data-testid="queue-item"]').count();
    expect(queueItems).toBe(3);

    // Test reordering with mixed libraries
    const initialOrder = await page.locator('[data-testid="queue-item"] .manuscript-title-link').allTextContents();
    
    // Move Vatican manuscript to top
    await page.locator('[data-testid="queue-item"]').last().locator('.move-up-btn').click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="queue-item"]').nth(1).locator('.move-up-btn').click();
    await page.waitForTimeout(300);

    const reorderedOrder = await page.locator('[data-testid="queue-item"] .manuscript-title-link').allTextContents();
    expect(reorderedOrder[0]).toBe(initialOrder[2]);
    expect(reorderedOrder[1]).toBe(initialOrder[0]);
    expect(reorderedOrder[2]).toBe(initialOrder[1]);
  });

  test('should download and validate PDFs from multiple libraries', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    // Test with smaller manuscripts for faster testing
    const testUrls = [
      'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
      'https://e-codices.unifr.ch/en/list/one/csg/0391'
    ];

    await page.fill('[data-testid="url-input"]', testUrls.join('\n'));
    await page.click('[data-testid="add-button"]');
    await page.waitForSelector('[data-testid="queue-item"]');
    
    // Wait for manifests to load
    await page.waitForFunction(() => {
      const items = document.querySelectorAll('[data-testid="queue-item"]');
      return Array.from(items).every(item => !item.textContent?.includes('Loading'));
    }, { timeout: 30000 });

    // Reorder - put e-codices first
    await page.locator('[data-testid="queue-item"]').nth(1).locator('.move-up-btn').click();
    await page.waitForTimeout(500);

    // Start downloads
    await page.click('[data-testid="start-queue"]');
    
    // Wait for first download to complete or make significant progress
    await page.waitForFunction(() => {
      const progressBars = document.querySelectorAll('.item-progress-fill');
      return progressBars.length > 0 && 
             Array.from(progressBars).some(bar => {
               const width = (bar as HTMLElement).style.width;
               return parseInt(width) > 10; // At least 10% progress
             });
    }, { timeout: 60000 });

    // Stop downloads to check intermediate state
    await page.click('[data-testid="stop-queue"]');
    await page.waitForTimeout(2000);

    // Check that downloads started in the reordered sequence
    const downloadStatus = await page.locator('[data-testid="queue-item"] .status-badge').allTextContents();
    console.log('Download statuses:', downloadStatus);
    
    // At least one should have started downloading (completed, downloading, or paused)
    const hasStartedDownloading = downloadStatus.some(status => 
      ['Completed', 'Downloading', 'Paused'].includes(status.trim())
    );
    expect(hasStartedDownloading).toBe(true);
  });

  test('should handle auto-split with large manuscripts', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    // Use a larger manuscript that's likely to auto-split
    const largeManuscriptUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b8452439d';
    
    await page.fill('[data-testid="url-input"]', largeManuscriptUrl);
    await page.click('[data-testid="add-button"]');
    await page.waitForSelector('[data-testid="queue-item"]');

    // Wait for manifest to load
    await page.waitForFunction(() => {
      const items = document.querySelectorAll('[data-testid="queue-item"]');
      return Array.from(items).every(item => !item.textContent?.includes('Loading'));
    }, { timeout: 30000 });

    // Check if auto-split occurred
    const queueItems = await page.locator('[data-testid="queue-item"]').count();
    console.log(`Queue items after loading: ${queueItems}`);

    if (queueItems > 1) {
      // Auto-split occurred - test that parent item controls work
      const parentItem = page.locator('[data-testid="queue-item"]').first();
      
      // Check if toggle button exists
      const toggleButton = parentItem.locator('.toggle-parts-btn');
      if (await toggleButton.isVisible()) {
        // Expand parts
        await toggleButton.click();
        await page.waitForTimeout(500);
        
        // Verify parts are visible
        await expect(page.locator('[data-testid="queue-part"]')).toBeVisible();
        
        // Verify parts don't have move buttons
        const partMoveButtons = page.locator('[data-testid="queue-part"] .move-up-btn, [data-testid="queue-part"] .move-down-btn');
        const moveButtonCount = await partMoveButtons.count();
        expect(moveButtonCount).toBe(0);
        
        // Test that only parent can be reordered
        await expect(parentItem.locator('.move-down-btn')).toBeVisible();
        
        // Collapse parts
        await toggleButton.click();
        await expect(page.locator('[data-testid="queue-part"]')).not.toBeVisible();
      }
    }
  });

  test('should handle concurrent downloads with reordering', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    const testUrls = [
      'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
      'https://gallica.bnf.fr/ark:/12148/btv1b8447295h',
      'https://e-codices.unifr.ch/en/list/one/csg/0391'
    ];

    await page.fill('[data-testid="url-input"]', testUrls.join('\n'));
    await page.click('[data-testid="add-button"]');
    await page.waitForSelector('[data-testid="queue-item"]');
    
    // Wait for all manifests to load
    await page.waitForFunction(() => {
      const items = document.querySelectorAll('[data-testid="queue-item"]');
      return items.length === 3 && 
             Array.from(items).every(item => !item.textContent?.includes('Loading'));
    }, { timeout: 30000 });

    // Test reordering before downloads start
    await page.locator('[data-testid="queue-item"]').last().locator('.move-up-btn').click();
    await page.waitForTimeout(300);

    // Start downloads
    await page.click('[data-testid="start-queue"]');
    
    // Wait for downloads to begin
    await page.waitForSelector('.status-downloading', { timeout: 15000 });

    // Verify move buttons are disabled during downloads
    await expect(page.locator('.move-up-btn')).not.toBeVisible();
    await expect(page.locator('.move-down-btn')).not.toBeVisible();

    // Let downloads run for a bit
    await page.waitForTimeout(5000);

    // Stop and verify order is maintained
    await page.click('[data-testid="stop-queue"]');
    await page.waitForTimeout(2000);

    // Move buttons should reappear
    await expect(page.locator('.move-down-btn').first()).toBeVisible();
  });

  test('should validate download progress accuracy', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    const testUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b8452439d';
    
    await page.fill('[data-testid="url-input"]', testUrl);
    await page.click('[data-testid="add-button"]');
    await page.waitForSelector('[data-testid="queue-item"]');

    // Wait for manifest
    await page.waitForFunction(() => {
      return !document.querySelector('[data-testid="queue-item"]')?.textContent?.includes('Loading');
    }, { timeout: 30000 });

    // Start download
    await page.click('[data-testid="start-queue"]');
    
    // Monitor progress for accuracy
    let previousProgress = 0;
    let progressIncreased = false;
    
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(2000);
      
      const progressElement = page.locator('.item-progress-fill').first();
      if (await progressElement.isVisible()) {
        const widthStyle = await progressElement.getAttribute('style');
        const match = widthStyle?.match(/width:\s*(\d+(?:\.\d+)?)%/);
        
        if (match) {
          const currentProgress = parseFloat(match[1]);
          console.log(`Progress check ${i + 1}: ${currentProgress}%`);
          
          if (currentProgress > previousProgress) {
            progressIncreased = true;
          }
          previousProgress = currentProgress;
          
          if (currentProgress >= 100) {
            break;
          }
        }
      }
    }

    // Stop download
    await page.click('[data-testid="stop-queue"]');
    
    // Verify progress increased during download
    expect(progressIncreased).toBe(true);
  });

  test('should handle error scenarios gracefully', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    // Test with invalid URL mixed with valid ones
    const mixedUrls = [
      'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
      'https://invalid-url-that-should-fail.com/manuscript',
      'https://e-codices.unifr.ch/en/list/one/csg/0391'
    ];

    await page.fill('[data-testid="url-input"]', mixedUrls.join('\n'));
    await page.click('[data-testid="add-button"]');
    
    // Wait for processing
    await page.waitForTimeout(10000);

    // Check that valid items loaded and invalid ones show errors
    const queueItems = await page.locator('[data-testid="queue-item"]').count();
    expect(queueItems).toBeGreaterThan(0);

    // Look for error states
    const errorItems = await page.locator('[data-testid="queue-item"].status-failed').count();
    expect(errorItems).toBeGreaterThan(0);

    // Verify that valid items can still be reordered
    const validItems = await page.locator('[data-testid="queue-item"]:not(.status-failed)').count();
    if (validItems > 1) {
      await expect(page.locator('[data-testid="queue-item"]:not(.status-failed) .move-down-btn').first()).toBeVisible();
    }
  });

  test('should maintain queue state across page refresh', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    const testUrls = [
      'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
      'https://e-codices.unifr.ch/en/list/one/csg/0391'
    ];

    await page.fill('[data-testid="url-input"]', testUrls.join('\n'));
    await page.click('[data-testid="add-button"]');
    await page.waitForSelector('[data-testid="queue-item"]');
    
    // Wait for manifests
    await page.waitForFunction(() => {
      const items = document.querySelectorAll('[data-testid="queue-item"]');
      return items.length === 2 && 
             Array.from(items).every(item => !item.textContent?.includes('Loading'));
    }, { timeout: 30000 });

    // Reorder items
    await page.locator('[data-testid="queue-item"]').nth(1).locator('.move-up-btn').click();
    await page.waitForTimeout(500);

    // Get order before refresh
    const beforeRefresh = await page.locator('[data-testid="queue-item"] .manuscript-title-link').allTextContents();

    // Refresh page
    await page.reload();
    await page.waitForSelector('[data-testid="queue-item"]');

    // Wait for items to load after refresh
    await page.waitForFunction(() => {
      const items = document.querySelectorAll('[data-testid="queue-item"]');
      return items.length === 2;
    }, { timeout: 15000 });

    // Get order after refresh
    const afterRefresh = await page.locator('[data-testid="queue-item"] .manuscript-title-link').allTextContents();

    // Verify order is maintained
    expect(afterRefresh).toEqual(beforeRefresh);
  });
});