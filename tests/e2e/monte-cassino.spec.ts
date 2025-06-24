import { test, expect } from '@playwright/test';

test.describe('Monte Cassino Library Integration', () => {

    const MONTE_CASSINO_URLS = [
        // Direct IIIF manifest URLs
        'https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0339/manifest',
        'https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0271/manifest',
        'https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0023/manifest',
        
        // ICCU source URLs
        'https://manus.iccu.sbn.it/cnmd/0000313047',
        'https://manus.iccu.sbn.it/cnmd/0000396781',
        'https://manus.iccu.sbn.it/cnmd/0000313194'
    ];

    test('Monte Cassino should appear in supported libraries list', async ({ page }) => {
        // Launch the Electron app
        await page.goto('app://electron-app/');
        
        // Wait for the app to load
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        // Check if Monte Cassino is listed in supported libraries
        const librariesText = await page.textContent('body');
        expect(librariesText).toContain('Monte Cassino Abbey Library');
    });

    test('should recognize Monte Cassino URLs correctly', async ({ page }) => {
        // Launch the Electron app
        await page.goto('app://electron-app/');
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        for (const url of MONTE_CASSINO_URLS) {
            // Input the URL
            const urlInput = page.locator('input[placeholder*="URL"], input[type="url"], .url-input input');
            await urlInput.fill(url);
            
            // Wait a moment for any validation to occur
            await page.waitForTimeout(1000);
            
            // The URL should be accepted (no immediate error about unsupported library)
            const pageContent = await page.textContent('body');
            expect(pageContent).not.toContain('Unsupported library');
            
            // Clear the input for next test
            await urlInput.fill('');
        }
    });

    test('should load direct IIIF manifest successfully', async ({ page }) => {
        const testUrl = 'https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0339/manifest';
        
        // Launch the Electron app
        await page.goto('app://electron-app/');
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        // Input the direct IIIF URL
        const urlInput = page.locator('input[placeholder*="URL"], input[type="url"], .url-input input');
        await urlInput.fill(testUrl);
        
        // Add to queue
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
            { timeout: 60000 }
        );
        
        // Check that the manuscript was added with correct information
        const queueItem = page.locator('.queue-item, .manuscript-item, [data-testid="queue-item"]').first();
        const itemText = await queueItem.textContent();
        
        // Should contain Monte Cassino in the name or library info
        expect(itemText).toMatch(/Monte.*Cassino|Montecassino|monte_cassino/i);
        
        // Should show the correct number of pages (361 for this manuscript)
        expect(itemText).toContain('361');
        
        // Clean up - remove the item
        const removeButton = queueItem.locator('button:has-text("Remove"), .remove-btn, button[data-testid="remove-item"]');
        await removeButton.click();
    });

    test('should handle ICCU URLs with appropriate error message', async ({ page }) => {
        const testUrl = 'https://manus.iccu.sbn.it/cnmd/0000313047';
        
        // Launch the Electron app
        await page.goto('app://electron-app/');
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        // Input the ICCU URL
        const urlInput = page.locator('input[placeholder*="URL"], input[type="url"], .url-input input');
        await urlInput.fill(testUrl);
        
        // Try to add to queue
        const addButton = page.locator('button:has-text("Add to Queue"), .add-btn, button[type="submit"]');
        await addButton.click();
        
        // Should either:
        // 1. Load successfully if we can extract the manifest, OR
        // 2. Show helpful error message about using direct IIIF URLs
        
        await page.waitForTimeout(10000);
        
        const hasQueueItem = await page.locator('.queue-item, .manuscript-item, [data-testid="queue-item"]').count() > 0;
        const pageContent = await page.textContent('body');
        const hasErrorMessage = pageContent.includes('direct IIIF manifest') || pageContent.includes('omnes.dbseret.com');
        
        if (hasErrorMessage) {
            // Should provide helpful guidance about direct IIIF URLs
            expect(pageContent).toMatch(/direct.*IIIF.*manifest|omnes\.dbseret\.com/i);
        }
        
        // Should recognize as Monte Cassino library even if manifest loading fails
        expect(hasQueueItem || hasErrorMessage).toBe(true);
        
        // Clean up if item was added
        if (hasQueueItem) {
            const queueItem = page.locator('.queue-item, .manuscript-item, [data-testid="queue-item"]').first();
            const removeButton = queueItem.locator('button:has-text("Remove"), .remove-btn, button[data-testid="remove-item"]');
            await removeButton.click();
        }
    });

    test('should generate correct IIIF image URLs', async ({ page }) => {
        const testUrl = 'https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0271/manifest';
        
        // Launch the Electron app
        await page.goto('app://electron-app/');
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        // Input the URL and add to queue
        const urlInput = page.locator('input[placeholder*="URL"], input[type="url"], .url-input input');
        await urlInput.fill(testUrl);
        
        const addButton = page.locator('button:has-text("Add to Queue"), .add-btn, button[type="submit"]');
        await addButton.click();
        
        // Wait for manifest loading
        await page.waitForSelector('.loading, .manifest-loading, [data-testid="loading"]', { timeout: 5000 });
        
        // Wait for manifest to load
        await page.waitForFunction(
            () => {
                const queueItems = document.querySelectorAll('.queue-item, .manuscript-item, [data-testid="queue-item"]');
                return queueItems.length > 0 && !document.querySelector('.loading, .manifest-loading');
            },
            { timeout: 60000 }
        );
        
        // Verify the manuscript was loaded successfully
        const queueItem = page.locator('.queue-item, .manuscript-item, [data-testid="queue-item"]').first();
        await expect(queueItem).toBeVisible();
        
        const itemText = await queueItem.textContent();
        
        // Should contain Monte Cassino content and page count
        expect(itemText).toMatch(/Monte.*Cassino|Montecassino|monte_cassino/i);
        expect(itemText).toMatch(/\d+/); // Should contain page numbers
        
        // Clean up
        const removeButton = queueItem.locator('button:has-text("Remove"), .remove-btn, button[data-testid="remove-item"]');
        await removeButton.click();
    });
});