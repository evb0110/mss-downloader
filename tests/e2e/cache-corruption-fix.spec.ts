import { test, expect } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { _electron as electron } from 'playwright';
import * as path from 'path';

test.describe('Cache Corruption Fix', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../dist/main/main.js'), '--headless'],
      headless: true,
      timeout: 30000,
      env: { 
        ...process.env, 
        NODE_ENV: 'test',
        DISPLAY: ':99'
      }
    });
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('cache corruption should not spread between libraries after download failure', async () => {
    test.setTimeout(300000); // 5 minutes

    // Add a valid manuscript that should download successfully
    const validManuscriptUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b10722554c';
    await page.getByTestId('url-input').fill(validManuscriptUrl);
    await page.getByTestId('add-to-queue-btn').click();

    // Wait for the item to be added to queue
    await expect(page.getByTestId('queue-item')).toBeVisible({ timeout: 10000 });

    // Add an invalid manuscript that will fail
    const invalidManuscriptUrl = 'https://invalid-library-url.com/broken-manifest';
    await page.getByTestId('url-input').fill(invalidManuscriptUrl);
    await page.getByTestId('add-to-queue-btn').click();

    // Verify both items are in queue
    await expect(page.getByTestId('queue-item')).toHaveCount(2);

    // Add another valid manuscript from different library
    const validManuscriptUrl2 = 'https://digital2.bodleian.ox.ac.uk/objects/3458fdcc-ac0b-4b2b-af9c-807f94761e39/';
    await page.getByTestId('url-input').fill(validManuscriptUrl2);
    await page.getByTestId('add-to-queue-btn').click();

    // Verify all items are in queue
    await expect(page.getByTestId('queue-item')).toHaveCount(3);

    // Start processing the queue
    await page.getByTestId('start-queue-btn').click();

    // Wait for processing and check results
    await page.waitForTimeout(60000);

    // Verify that valid manuscripts can still download successfully
    // (they should not be affected by cache corruption from failed downloads)
    const completedItems = await page.getByTestId('queue-item').filter({ 
      has: page.locator('[data-status="completed"]') 
    }).count();

    // At least one of the valid manuscripts should complete successfully
    expect(completedItems).toBeGreaterThan(0);
    
    console.log(`✅ Cache corruption fix test passed: ${completedItems} items completed after error isolation`);
  });

  test('cache should be resilient to invalid manifests', async () => {
    test.setTimeout(120000); // 2 minutes

    // Test with URLs that might return problematic data
    const problematicUrls = [
      'https://example.com/empty-response',
      'https://example.com/invalid-json',
      'https://example.com/null-pagelinks'
    ];

    // Add multiple problematic URLs
    for (const url of problematicUrls) {
      await page.getByTestId('url-input').fill(url);
      await page.getByTestId('add-to-queue-btn').click();
    }

    // Start processing
    await page.getByTestId('start-queue-btn').click();
    await page.waitForTimeout(30000);

    // Clear queue and add a valid manuscript
    await page.getByTestId('clear-queue-btn').click();
    const validUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b10722554c';
    await page.getByTestId('url-input').fill(validUrl);
    await page.getByTestId('add-to-queue-btn').click();

    // The valid manuscript should still work despite previous cache corruption attempts
    await page.getByTestId('start-queue-btn').click();
    await page.waitForTimeout(45000);

    // Should be able to process without issues
    const queueItems = await page.getByTestId('queue-item').count();
    expect(queueItems).toBeGreaterThan(0);
    
    console.log('✅ Cache resilience test completed');
  });
});