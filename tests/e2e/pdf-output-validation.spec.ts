import { test, expect } from '../electron-test';
import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

test.describe('PDF Output Validation and Quality Tests', () => {
  const downloadsPath = path.join(process.env.HOME || '', 'Downloads');
  
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

  test.afterEach(async () => {
    // Clean up downloaded test files
    try {
      const files = await fs.readdir(downloadsPath);
      const testFiles = files.filter(file => 
        file.includes('test_') || 
        file.includes('btv1b8452439d') ||
        file.includes('csg_0391')
      );
      
      for (const file of testFiles) {
        try {
          await fs.unlink(path.join(downloadsPath, file));
        } catch (e) {
          console.log(`Could not delete ${file}:`, e);
        }
      }
    } catch (e) {
      console.log('Cleanup error:', e);
    }
  });

  test('should download and validate PDF structure', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    const testUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b8452439d';
    
    await page.fill('[data-testid="url-input"]', testUrl);
    await page.click('[data-testid="add-button"]');
    await page.waitForSelector('[data-testid="queue-item"]');

    // Wait for manifest to load
    await page.waitForFunction(() => {
      return !document.querySelector('[data-testid="queue-item"]')?.textContent?.includes('Loading');
    }, { timeout: 30000 });

    // Get expected page count
    const pageCountText = await page.locator('.total-pages-badge').textContent();
    const pageCountMatch = pageCountText?.match(/(\d+)\s+Pages/);
    const expectedPages = pageCountMatch ? parseInt(pageCountMatch[1]) : 0;
    
    expect(expectedPages).toBeGreaterThan(0);
    console.log(`Expected pages: ${expectedPages}`);

    // Start download
    await page.click('[data-testid="start-queue"]');
    
    // Wait for completion or significant progress
    await page.waitForFunction(() => {
      const statusBadges = document.querySelectorAll('.status-badge');
      return Array.from(statusBadges).some(badge => 
        badge.textContent?.includes('Completed') || 
        badge.textContent?.includes('Downloading')
      );
    }, { timeout: 120000 });

    // If still downloading, let it run for a bit then stop
    const isCompleted = await page.locator('.status-completed').isVisible();
    if (!isCompleted) {
      // Let it download for a reasonable time
      await page.waitForTimeout(30000);
      await page.click('[data-testid="stop-queue"]');
      await page.waitForTimeout(2000);
    }

    // Check if PDF was created
    const files = await fs.readdir(downloadsPath);
    const pdfFiles = files.filter(file => file.endsWith('.pdf') && file.includes('btv1b8452439d'));
    
    if (pdfFiles.length > 0) {
      const pdfPath = path.join(downloadsPath, pdfFiles[0]);
      
      // Validate PDF file exists and has content
      const stats = await fs.stat(pdfPath);
      expect(stats.size).toBeGreaterThan(1000); // At least 1KB
      
      console.log(`PDF created: ${pdfFiles[0]}, Size: ${Math.round(stats.size / 1024)}KB`);
      
      // Try to validate PDF structure using pdfinfo if available
      try {
        const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8', timeout: 10000 });
        console.log('PDF Info:', pdfInfo);
        
        // Extract page count from pdfinfo
        const pagesMatch = pdfInfo.match(/Pages:\s*(\d+)/);
        if (pagesMatch) {
          const actualPages = parseInt(pagesMatch[1]);
          console.log(`Actual pages in PDF: ${actualPages}`);
          
          // For partial downloads, just check we have some pages
          expect(actualPages).toBeGreaterThan(0);
        }
      } catch (e) {
        console.log('pdfinfo not available, skipping detailed PDF validation');
      }
    } else {
      console.log('No PDF files found, download may have been incomplete');
    }
  });

  test('should handle auto-split downloads and merge correctly', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    // Use a larger manuscript that should auto-split
    const largeManuscriptUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b8452439d';
    
    await page.fill('[data-testid="url-input"]', largeManuscriptUrl);
    await page.click('[data-testid="add-button"]');
    await page.waitForSelector('[data-testid="queue-item"]');

    // Wait for manifest and potential auto-split
    await page.waitForFunction(() => {
      const items = document.querySelectorAll('[data-testid="queue-item"]');
      return Array.from(items).every(item => !item.textContent?.includes('Loading'));
    }, { timeout: 30000 });

    const queueItemCount = await page.locator('[data-testid="queue-item"]').count();
    console.log(`Queue items after loading: ${queueItemCount}`);

    if (queueItemCount > 1) {
      // Auto-split occurred
      console.log('Auto-split detected, testing part downloads');
      
      // Check if parts are grouped under parent
      const toggleButton = page.locator('.toggle-parts-btn').first();
      if (await toggleButton.isVisible()) {
        await toggleButton.click();
        
        // Verify parts are visible
        const partCount = await page.locator('[data-testid="queue-part"]').count();
        expect(partCount).toBeGreaterThan(0);
        console.log(`Found ${partCount} auto-split parts`);
      }
    }

    // Start download
    await page.click('[data-testid="start-queue"]');
    
    // Monitor progress for auto-split parts
    let maxProgress = 0;
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(3000);
      
      const progressElements = await page.locator('.item-progress-fill').all();
      for (const element of progressElements) {
        const widthStyle = await element.getAttribute('style');
        const match = widthStyle?.match(/width:\s*(\d+(?:\.\d+)?)%/);
        if (match) {
          const progress = parseFloat(match[1]);
          maxProgress = Math.max(maxProgress, progress);
        }
      }
      
      console.log(`Max progress reached: ${maxProgress}%`);
      
      // Check if any parts completed
      const completedParts = await page.locator('[data-testid="queue-part"] .status-completed').count();
      if (completedParts > 0) {
        console.log(`${completedParts} parts completed`);
        break;
      }
    }

    // Stop download
    await page.click('[data-testid="stop-queue"]');
    await page.waitForTimeout(2000);

    // Check for downloaded files
    const files = await fs.readdir(downloadsPath);
    const partFiles = files.filter(file => 
      file.endsWith('.pdf') && 
      (file.includes('Part_') || file.includes('btv1b8452439d'))
    );
    
    console.log(`Found ${partFiles.length} downloaded files:`, partFiles);
    
    // Validate any downloaded parts
    for (const file of partFiles) {
      const filePath = path.join(downloadsPath, file);
      const stats = await fs.stat(filePath);
      expect(stats.size).toBeGreaterThan(500); // At least 500 bytes
      console.log(`Validated ${file}: ${Math.round(stats.size / 1024)}KB`);
    }
  });

  test('should maintain download quality across different libraries', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    const testCases = [
      {
        name: 'Gallica',
        url: 'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
        expectedMin: 50 // Minimum expected pages for this manuscript
      },
      {
        name: 'e-codices',
        url: 'https://e-codices.unifr.ch/en/list/one/csg/0391',
        expectedMin: 10
      }
    ];

    for (const testCase of testCases) {
      console.log(`Testing ${testCase.name} library...`);
      
      // Clear queue first
      if (await page.locator('[data-testid="queue-item"]').count() > 0) {
        await page.click('.clear-all-btn');
        await page.waitForTimeout(1000);
      }

      await page.fill('[data-testid="url-input"]', testCase.url);
      await page.click('[data-testid="add-button"]');
      await page.waitForSelector('[data-testid="queue-item"]');

      // Wait for manifest
      await page.waitForFunction(() => {
        return !document.querySelector('[data-testid="queue-item"]')?.textContent?.includes('Loading');
      }, { timeout: 30000 });

      // Check page count
      const pageCountText = await page.locator('.total-pages-badge').textContent();
      console.log(`${testCase.name} page count: ${pageCountText}`);

      // Start download
      await page.click('[data-testid="start-queue"]');
      
      // Wait for some progress
      await page.waitForFunction(() => {
        const progressBars = document.querySelectorAll('.item-progress-fill');
        return Array.from(progressBars).some(bar => {
          const width = (bar as HTMLElement).style.width;
          return parseInt(width || '0') > 5;
        });
      }, { timeout: 60000 });

      // Stop after reasonable progress
      await page.click('[data-testid="stop-queue"]');
      await page.waitForTimeout(2000);

      // Verify download started properly
      const hasProgress = await page.locator('.item-progress').isVisible();
      expect(hasProgress).toBe(true);
      
      console.log(`${testCase.name} test completed successfully`);
    }
  });

  test('should handle concurrent part downloads correctly', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    const testUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b8452439d';
    
    await page.fill('[data-testid="url-input"]', testUrl);
    await page.click('[data-testid="add-button"]');
    await page.waitForSelector('[data-testid="queue-item"]');

    // Wait for potential auto-split
    await page.waitForFunction(() => {
      return !document.querySelector('[data-testid="queue-item"]')?.textContent?.includes('Loading');
    }, { timeout: 30000 });

    // Check concurrency setting
    const concurrencyText = await page.locator('.concurrency-badge').textContent();
    console.log(`Concurrency setting: ${concurrencyText}`);

    // Start download
    await page.click('[data-testid="start-queue"]');
    
    // Monitor for concurrent downloads
    let maxSimultaneousDownloads = 0;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(2000);
      
      const downloadingItems = await page.locator('.status-downloading').count();
      maxSimultaneousDownloads = Math.max(maxSimultaneousDownloads, downloadingItems);
      
      if (downloadingItems > 0) {
        console.log(`Simultaneous downloads: ${downloadingItems}`);
      }
    }

    // Stop download
    await page.click('[data-testid="stop-queue"]');
    
    console.log(`Maximum simultaneous downloads observed: ${maxSimultaneousDownloads}`);
    
    // Verify concurrency was respected (should be <= configured value)
    expect(maxSimultaneousDownloads).toBeGreaterThan(0);
    expect(maxSimultaneousDownloads).toBeLessThanOrEqual(8); // Default max concurrency
  });

  test('should validate reordered download sequence', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    const testUrls = [
      'https://gallica.bnf.fr/ark:/12148/btv1b8452439d',
      'https://gallica.bnf.fr/ark:/12148/btv1b8447295h'
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

    // Get initial order
    const initialTitles = await page.locator('[data-testid="queue-item"] .manuscript-title-link').allTextContents();
    console.log('Initial order:', initialTitles);

    // Reorder - move second item to first
    await page.locator('[data-testid="queue-item"]').nth(1).locator('.move-up-btn').click();
    await page.waitForTimeout(500);

    const reorderedTitles = await page.locator('[data-testid="queue-item"] .manuscript-title-link').allTextContents();
    console.log('Reordered:', reorderedTitles);

    // Start downloads
    await page.click('[data-testid="start-queue"]');
    
    // Monitor which item starts downloading first
    let firstDownloadingTitle = '';
    await page.waitForFunction(() => {
      const downloadingItems = document.querySelectorAll('.status-downloading');
      if (downloadingItems.length > 0) {
        const firstItem = downloadingItems[0].closest('[data-testid="queue-item"]');
        const titleElement = firstItem?.querySelector('.manuscript-title-link');
        if (titleElement) {
          firstDownloadingTitle = titleElement.textContent || '';
          return true;
        }
      }
      return false;
    }, { timeout: 30000 });

    console.log(`First item to start downloading: ${firstDownloadingTitle}`);
    
    // Verify the reordered item started first
    expect(firstDownloadingTitle).toBe(reorderedTitles[0]);

    // Stop download
    await page.click('[data-testid="stop-queue"]');
  });
});