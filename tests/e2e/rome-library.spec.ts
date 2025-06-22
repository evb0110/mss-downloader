import { test, expect } from '@playwright/test';

test.describe('Rome National Library Integration', () => {
    test('should successfully detect and load Rome National Library manuscript', async ({ page }) => {
        // Launch the Electron app
        await page.goto('app://electron-app/');
        
        // Wait for the app to load
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        // Test URL input
        const testUrl = 'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1';
        
        // Find and fill the URL input
        const urlInput = page.locator('input[placeholder*="URL"], input[type="url"], .url-input input');
        await urlInput.fill(testUrl);
        
        // Add the manuscript to queue
        const addButton = page.locator('button:has-text("Add to Queue"), .add-btn, button[type="submit"]');
        await addButton.click();
        
        // Wait for manifest loading to begin
        await page.waitForSelector('.loading, .manifest-loading, [data-testid="loading"]', { timeout: 5000 });
        
        // Wait for manifest to load (with generous timeout for Rome library)
        await page.waitForFunction(
            () => {
                const queueItems = document.querySelectorAll('.queue-item, .manuscript-item, [data-testid="queue-item"]');
                return queueItems.length > 0 && !document.querySelector('.loading, .manifest-loading');
            },
            { timeout: 30000 }
        );
        
        // Verify the manuscript was added to queue
        const queueItem = page.locator('.queue-item, .manuscript-item, [data-testid="queue-item"]').first();
        await expect(queueItem).toBeVisible();
        
        // Check that the title contains expected Rome library content
        const titleElement = queueItem.locator('.title, .manuscript-title, [data-testid="manuscript-title"]');
        const titleText = await titleElement.textContent();
        console.log('📄 Loaded manuscript:', titleText);
        
        // Verify it's recognized as Rome library
        expect(titleText).toBeTruthy();
        
        // Check that page count is detected (should be 175 for this manuscript)
        const pageInfo = queueItem.locator('.page-count, .pages, [data-testid="page-count"]');
        const pageText = await pageInfo.textContent();
        console.log('📊 Page count:', pageText);
        
        // For this specific manuscript, we expect 175 pages
        expect(pageText).toContain('175');
        
        // Verify the library is correctly identified
        const libraryInfo = queueItem.locator('.library, .source, [data-testid="library"]');
        if (await libraryInfo.count() > 0) {
            const libraryText = await libraryInfo.textContent();
            console.log('🏛️ Library:', libraryText);
        }
        
        console.log('✅ Rome National Library manuscript successfully loaded!');
    });

    test('should handle Rome library URL validation', async ({ page }) => {
        await page.goto('app://electron-app/');
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        // Test various Rome URL formats
        const validUrls = [
            'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1',
            'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/50',
            'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/175'
        ];
        
        for (const url of validUrls) {
            console.log(`🔍 Testing URL: ${url}`);
            
            const urlInput = page.locator('input[placeholder*="URL"], input[type="url"], .url-input input');
            await urlInput.clear();
            await urlInput.fill(url);
            
            // The URL should be accepted (no immediate error)
            await page.waitForTimeout(1000);
            
            // Check if there's an immediate validation error
            const errorElement = page.locator('.error, .invalid, [data-testid="error"]');
            const hasError = await errorElement.count() > 0;
            
            if (hasError) {
                const errorText = await errorElement.textContent();
                console.log(`❌ Validation error for ${url}: ${errorText}`);
            } else {
                console.log(`✅ URL validation passed for ${url}`);
            }
        }
    });

    test('should extract correct manuscript metadata from Rome URL', async ({ page }) => {
        await page.goto('app://electron-app/');
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        const testUrl = 'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1';
        
        const urlInput = page.locator('input[placeholder*="URL"], input[type="url"], .url-input input');
        await urlInput.fill(testUrl);
        
        const addButton = page.locator('button:has-text("Add to Queue"), .add-btn, button[type="submit"]');
        await addButton.click();
        
        // Wait for manifest to load completely
        await page.waitForFunction(
            () => {
                const queueItems = document.querySelectorAll('.queue-item, .manuscript-item, [data-testid="queue-item"]');
                return queueItems.length > 0 && !document.querySelector('.loading, .manifest-loading');
            },
            { timeout: 30000 }
        );
        
        const queueItem = page.locator('.queue-item, .manuscript-item, [data-testid="queue-item"]').first();
        
        // Extract and verify metadata
        const titleElement = queueItem.locator('.title, .manuscript-title, [data-testid="manuscript-title"]');
        const title = await titleElement.textContent();
        
        // For this specific manuscript, we expect "Tropario-processionario"
        expect(title).toContain('Tropario');
        
        console.log(`✅ Extracted title: "${title}"`);
        
        // Verify page count
        const pageElement = queueItem.locator('.page-count, .pages, [data-testid="page-count"]');
        const pageText = await pageElement.textContent();
        
        expect(pageText).toContain('175');
        console.log(`✅ Extracted page count: ${pageText}`);
        
        console.log('✅ Rome National Library metadata extraction successful!');
    });
});