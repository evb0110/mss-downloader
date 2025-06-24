import { test, expect } from './helpers/electron.js';

test.describe('Vallicelliana Library Integration', () => {

    test('should successfully detect and load Vallicelliana Library manuscript', async ({ page }) => {
        // Wait for the app to load
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        // Test with DAM manifest URL
        const testUrl = 'https://dam.iccu.sbn.it/mol_46/containers/avQYjLe/manifest';
        
        // Find and fill the URL input
        const urlInput = page.locator('input[placeholder*="URL"], input[type="url"], .url-input input');
        await urlInput.fill(testUrl);
        
        // Add the manuscript to queue
        const addButton = page.locator('button:has-text("Add to Queue"), .add-btn, button[type="submit"]');
        await addButton.click();
        
        // Wait for manifest loading to begin
        await page.waitForSelector('.loading, .manifest-loading, [data-testid="loading"]', { timeout: 5000 });
        
        // Wait for manifest to load
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
        
        // Check that the title contains Vallicelliana
        const titleElement = queueItem.locator('.title, .manuscript-title, [data-testid="manuscript-title"]');
        const titleText = await titleElement.textContent();
        console.log('📄 Loaded Vallicelliana manuscript:', titleText);
        
        // Verify it's recognized as Vallicelliana library
        expect(titleText).toBeTruthy();
        expect(titleText).toContain('Vallicelliana');
        
        // Check that page count is detected
        const pageInfo = queueItem.locator('.page-count, .pages, [data-testid="page-count"]');
        const pageText = await pageInfo.textContent();
        console.log('📊 Page count:', pageText);
        
        // Should have at least 1 page
        expect(pageText).toBeTruthy();
        expect(pageText).toMatch(/\d+/); // Should contain numbers
    });
    
    test('should handle multiple Vallicelliana manuscripts', async ({ page }) => {
        // Wait for the app to load
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        const testManifests = [
            'https://dam.iccu.sbn.it/mol_46/containers/avQYk0e/manifest',
            'https://dam.iccu.sbn.it/mol_46/containers/egpkGYa/manifest',
        ];

        for (const manifestUrl of testManifests) {
            const urlInput = page.locator('input[placeholder*="URL"], input[type="url"], .url-input input');
            await urlInput.fill(manifestUrl);
            
            const addButton = page.locator('button:has-text("Add to Queue"), .add-btn, button[type="submit"]');
            await addButton.click();
            
            // Wait a bit between additions
            await page.waitForTimeout(3000);
        }

        // Wait for manifests to load
        await page.waitForFunction(
            () => {
                const queueItems = document.querySelectorAll('.queue-item, .manuscript-item, [data-testid="queue-item"]');
                return queueItems.length >= 2 && !document.querySelector('.loading, .manifest-loading');
            },
            { timeout: 45000 }
        );
        
        // Should have at least 2 queue items
        const queueItems = page.locator('.queue-item, .manuscript-item, [data-testid="queue-item"]');
        await expect(queueItems).toHaveCountAtLeast(2);
        
        // Check that the manuscripts loaded
        for (let i = 0; i < 2; i++) {
            const item = queueItems.nth(i);
            const titleElement = item.locator('.title, .manuscript-title, [data-testid="manuscript-title"]');
            const titleText = await titleElement.textContent();
            console.log(`📄 Loaded manuscript ${i + 1}:`, titleText);
            expect(titleText).toContain('Vallicelliana');
        }
    });
});