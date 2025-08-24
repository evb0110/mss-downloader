#!/usr/bin/env node

// Playwright + Electron smoke test for Morgan objectId URL (Issue #58)
const { _electron: electron } = require('playwright');

async function run() {
  console.log('🚀 Morgan Playwright smoke test starting...');
  const testUrl = 'https://www.themorgan.org/collection/gospel-book/143812/thumbs';

  let electronApp, page;
  try {
    console.log('⏳ Launching Electron app...');
    electronApp = await electron.launch({
      args: ['dist/main/main.js', '--headless'],
      timeout: 60000,
    });
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // Ensure output dir exists implicitly by screenshot calls
    console.log('🧪 Adding Morgan URL to queue:', testUrl);

    // Open add dialog if needed
    try {
      const addMoreButton = await page.waitForSelector('button:has-text("Add More Documents")', { timeout: 5000 });
      if (await addMoreButton.isVisible()) {
        await addMoreButton.click();
        await page.waitForTimeout(300);
      }
    } catch {}

    // Locate URL input (either data-testid or textarea fallback)
    let urlInput;
    try {
      urlInput = await page.waitForSelector('[data-testid="url-input"]', { timeout: 10000 });
    } catch {
      urlInput = await page.waitForSelector('textarea', { timeout: 10000 });
    }
    await urlInput.fill(testUrl);

    let addButton;
    try {
      addButton = await page.waitForSelector('[data-testid="add-button"]', { timeout: 5000 });
    } catch {
      addButton = await page.waitForSelector('button:has-text("Add")', { timeout: 5000 });
    }
    await addButton.click();

    const queueItem = page.locator('[data-testid="queue-item"]').first();

    // Wait up to ~30s for manifest to load without failure text
    let loaded = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const title = await queueItem.locator('strong').textContent().catch(() => '');
      const status = await queueItem.locator('.status-badge').textContent().catch(() => '');
      if (title && !title.includes('Loading manifest') && !/Failed|Error/i.test(title)) {
        console.log('✅ Manifest title:', title);
        loaded = true;
        break;
      }
      if (/failed/i.test(status || '')) {
        console.error('❌ Status shows failed:', status);
        break;
      }
    }

    await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/morgan-objectid-after-add.png' });

    if (!loaded) {
      throw new Error('Morgan manifest did not load successfully');
    }

    const startButton = queueItem.locator('button.start-btn, button:has-text("Resume Queue")').first();
    if (await startButton.isVisible() && await startButton.isEnabled()) {
      await startButton.click();
      console.log('⬇️  Started download to verify page discovery');

      // Observe progress for a short time
      let sawProgress = false;
      for (let i = 0; i < 15; i++) {
        await page.waitForTimeout(1000);
        const progressCount = await queueItem
          .locator('*')
          .filter({ hasText: /(\d+\s*of\s*\d+|\d+%|Downloading\s+\d+|Calculating)/ })
          .count();
        if (progressCount > 0) { sawProgress = true; break; }
        const status = await queueItem.locator('.status-badge').textContent().catch(() => '');
        if (/failed/i.test(status || '')) {
          throw new Error('Download failed: ' + status);
        }
      }

      if (!sawProgress) {
        console.warn('⚠️ No obvious progress text detected within timeframe');
      }

      await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/morgan-objectid-downloading.png' });
      console.log('✅ Morgan Playwright smoke test finished');
    } else {
      console.log('ℹ️ Start button not available; manifest loaded state verified.');
    }
  } catch (err) {
    console.error('❌ Morgan Playwright smoke test error:', err.message);
    if (page) {
      try { await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/morgan-objectid-error.png' }); } catch {}
    }
    process.exitCode = 1;
  } finally {
    if (electronApp) {
      await electronApp.close();
    }
  }
}

run();

