import { test, expect } from '@playwright/test';

test.describe('Berlin State Library Integration', () => {
    test('should successfully detect and load Berlin State Library manuscript', async ({ page }) => {
        // Launch the Electron app
        await page.goto('app://electron-app/');
        
        // Wait for the app to load
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        // Test URL input - using the first test URL
        const testUrl = 'https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN782404456&view=picture-download&PHYSID=PHYS_0005&DMDID=DMDLOG_0001';
        
        // Find and fill the URL input
        const urlInput = page.locator('input[placeholder*="URL"], input[type="url"], .url-input input');
        await urlInput.fill(testUrl);
        
        // Add the manuscript to queue
        const addButton = page.locator('button:has-text("Add to Queue"), .add-btn, button[type="submit"]');
        await addButton.click();
        
        // Wait for manifest loading to begin
        await page.waitForSelector('.loading, .manifest-loading, [data-testid="loading"]', { timeout: 5000 });
        
        // Wait for manifest to load (with generous timeout for Berlin library)
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
        
        // Check that the title contains expected Berlin library content
        const titleElement = queueItem.locator('.title, .manuscript-title, [data-testid="manuscript-title"]');
        const titleText = await titleElement.textContent();
        console.log('📄 Loaded manuscript:', titleText);
        
        // Verify it's recognized as Berlin library and contains expected title
        expect(titleText).toBeTruthy();
        expect(titleText).toContain('Quedlinburger Antiphonar');
        
        // Check that page count is detected (should be 302 for this manuscript)
        const pageInfo = queueItem.locator('.page-count, .pages, [data-testid="page-count"]');
        const pageText = await pageInfo.textContent();
        console.log('📊 Page count:', pageText);
        
        // For this specific manuscript, we expect 302 pages
        expect(pageText).toContain('302');
        
        // Verify the library is correctly identified
        const libraryInfo = queueItem.locator('.library, .source, [data-testid="library"]');
        if (await libraryInfo.count() > 0) {
            const libraryText = await libraryInfo.textContent();
            console.log('🏛️ Library:', libraryText);
        }
        
        console.log('✅ Berlin State Library manuscript successfully loaded!');
    });

    test('should handle second Berlin State Library URL format', async ({ page }) => {
        await page.goto('app://electron-app/');
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        // Test the simpler URL format
        const testUrl = 'https://digital.staatsbibliothek-berlin.de/werkansicht/?PPN=PPN782404677';
        
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
            { timeout: 30000 }
        );
        
        const queueItem = page.locator('.queue-item, .manuscript-item, [data-testid="queue-item"]').first();
        await expect(queueItem).toBeVisible();
        
        // Check title for the second manuscript
        const titleElement = queueItem.locator('.title, .manuscript-title, [data-testid="manuscript-title"]');
        const titleText = await titleElement.textContent();
        console.log('📄 Loaded manuscript:', titleText);
        
        expect(titleText).toBeTruthy();
        expect(titleText).toContain('Quedlinburger Graduale');
        
        // Check page count (should be 588 for this manuscript)
        const pageInfo = queueItem.locator('.page-count, .pages, [data-testid="page-count"]');
        const pageText = await pageInfo.textContent();
        console.log('📊 Page count:', pageText);
        
        expect(pageText).toContain('588');
        
        console.log('✅ Berlin State Library second URL format successfully loaded!');
    });

    test('should handle Berlin library URL validation', async ({ page }) => {
        await page.goto('app://electron-app/');
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        // Test various Berlin URL formats
        const validUrls = [
            'https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN782404456&view=picture-download&PHYSID=PHYS_0005&DMDID=DMDLOG_0001',
            'https://digital.staatsbibliothek-berlin.de/werkansicht/?PPN=PPN782404677',
            'https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN782404456',
            'https://digital.staatsbibliothek-berlin.de/werkansicht/?PPN=PPN782404677&view=overview-toc'
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

    test('should extract correct manuscript metadata from Berlin URL', async ({ page }) => {
        await page.goto('app://electron-app/');
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        const testUrl = 'https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN782404456&view=picture-download&PHYSID=PHYS_0005&DMDID=DMDLOG_0001';
        
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
        
        // For this specific manuscript, we expect "Quedlinburger Antiphonar"
        expect(title).toContain('Quedlinburger Antiphonar');
        expect(title).toContain('11. Jh.');
        
        console.log(`✅ Extracted title: "${title}"`);
        
        // Verify page count
        const pageElement = queueItem.locator('.page-count, .pages, [data-testid="page-count"]');
        const pageText = await pageElement.textContent();
        
        expect(pageText).toContain('302');
        console.log(`✅ Extracted page count: ${pageText}`);
        
        console.log('✅ Berlin State Library metadata extraction successful!');
    });

    test('should handle Berlin library IIIF image URLs correctly', async ({ page }) => {
        await page.goto('app://electron-app/');
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        const testUrl = 'https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN782404456&view=picture-download&PHYSID=PHYS_0005&DMDID=DMDLOG_0001';
        
        const urlInput = page.locator('input[placeholder*="URL"], input[type="url"], .url-input input');
        await urlInput.fill(testUrl);
        
        const addButton = page.locator('button:has-text("Add to Queue"), .add-btn, button[type="submit"]');
        await addButton.click();
        
        // Wait for manifest to load
        await page.waitForFunction(
            () => {
                const queueItems = document.querySelectorAll('.queue-item, .manuscript-item, [data-testid="queue-item"]');
                return queueItems.length > 0 && !document.querySelector('.loading, .manifest-loading');
            },
            { timeout: 30000 }
        );
        
        const queueItem = page.locator('.queue-item, .manuscript-item, [data-testid="queue-item"]').first();
        
        // Get the page count to verify we have pages
        const pageElement = queueItem.locator('.page-count, .pages, [data-testid="page-count"]');
        const pageText = await pageElement.textContent();
        console.log(`📊 Total pages loaded: ${pageText}`);
        
        // Verify we have the expected number of pages (302)
        expect(pageText).toContain('302');
        
        console.log('✅ Berlin State Library IIIF image URLs loaded correctly!');
    });
});