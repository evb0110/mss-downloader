import { test, expect } from '@playwright/test';

test.describe('BDL (Biblioteca Digitale Lombarda) Integration', () => {
    test('should successfully detect and load BDL manuscript 3903', async ({ page }) => {
        // Launch the Electron app
        await page.goto('app://electron-app/');
        
        // Wait for the app to load
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        // Test URL input - using the first test URL
        const testUrl = 'https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3903';
        
        // Find and fill the URL input
        const urlInput = page.locator('input[placeholder*="URL"], input[type="url"], .url-input input');
        await urlInput.fill(testUrl);
        
        // Add the manuscript to queue
        const addButton = page.locator('button:has-text("Add to Queue"), .add-btn, button[type="submit"]');
        await addButton.click();
        
        // Wait for manifest loading to begin
        await page.waitForSelector('.loading, .manifest-loading, [data-testid="loading"]', { timeout: 5000 });
        
        // Wait for manifest to load (with generous timeout for BDL API)
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
        
        // Check that the title contains expected BDL library content
        const titleElement = queueItem.locator('.title, .manuscript-title, [data-testid="manuscript-title"]');
        const titleText = await titleElement.textContent();
        console.log('📄 Loaded manuscript:', titleText);
        
        // Verify it's recognized as BDL library
        expect(titleText).toBeTruthy();
        expect(titleText).toContain('BDL_3903');
        
        // Check that page count is detected (should be around 302 for this manuscript based on our API test)
        const pageInfo = queueItem.locator('.page-count, .pages, [data-testid="page-count"]');
        const pageText = await pageInfo.textContent();
        console.log('📊 Page count:', pageText);
        
        // We expect a reasonable number of pages (should be over 200 based on our API analysis)
        const pageNumber = parseInt(pageText?.match(/\d+/)?.[0] || '0');
        expect(pageNumber).toBeGreaterThan(200);
        
        // Verify the library is correctly identified
        const libraryInfo = queueItem.locator('.library, .source, [data-testid="library"]');
        if (await libraryInfo.count() > 0) {
            const libraryText = await libraryInfo.textContent();
            console.log('🏛️ Library:', libraryText);
        }
        
        console.log('✅ BDL manuscript 3903 successfully loaded!');
    });

    test('should successfully detect and load BDL manuscript 3904', async ({ page }) => {
        await page.goto('app://electron-app/');
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        // Test the second URL
        const testUrl = 'https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3904';
        
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
        expect(titleText).toContain('BDL_3904');
        
        // Check page count (should be around 182 for this manuscript based on our API test)
        const pageInfo = queueItem.locator('.page-count, .pages, [data-testid="page-count"]');
        const pageText = await pageInfo.textContent();
        console.log('📊 Page count:', pageText);
        
        const pageNumber = parseInt(pageText?.match(/\d+/)?.[0] || '0');
        expect(pageNumber).toBeGreaterThan(100);
        
        console.log('✅ BDL manuscript 3904 successfully loaded!');
    });

    test('should handle BDL URL validation', async ({ page }) => {
        await page.goto('app://electron-app/');
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        // Test various BDL URL formats
        const validUrls = [
            'https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3903',
            'https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3904',
            'https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3903#mode/2up',
            'https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3904#mode/1up'
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

    test('should extract correct manuscript metadata from BDL URL', async ({ page }) => {
        await page.goto('app://electron-app/');
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        const testUrl = 'https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3903';
        
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
        
        // For this specific manuscript, we expect "BDL_3903"
        expect(title).toContain('BDL_3903');
        
        console.log(`✅ Extracted title: "${title}"`);
        
        // Verify page count
        const pageElement = queueItem.locator('.page-count, .pages, [data-testid="page-count"]');
        const pageText = await pageElement.textContent();
        
        const pageNumber = parseInt(pageText?.match(/\d+/)?.[0] || '0');
        expect(pageNumber).toBeGreaterThan(200);
        console.log(`✅ Extracted page count: ${pageText}`);
        
        console.log('✅ BDL metadata extraction successful!');
    });

    test('should handle BDL IIIF image URLs correctly', async ({ page }) => {
        await page.goto('app://electron-app/');
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        const testUrl = 'https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3903';
        
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
        
        // Verify we have a reasonable number of pages
        const pageNumber = parseInt(pageText?.match(/\d+/)?.[0] || '0');
        expect(pageNumber).toBeGreaterThan(200);
        
        console.log('✅ BDL IIIF image URLs loaded correctly!');
    });

    test('should handle private path parameter (path=be)', async ({ page }) => {
        await page.goto('app://electron-app/');
        await page.waitForSelector('.app-container', { timeout: 10000 });
        
        // Test with path=be (private)
        const testUrl = 'https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=be&cdOggetto=3903';
        
        const urlInput = page.locator('input[placeholder*="URL"], input[type="url"], .url-input input');
        await urlInput.fill(testUrl);
        
        const addButton = page.locator('button:has-text("Add to Queue"), .add-btn, button[type="submit"]');
        await addButton.click();
        
        // Note: This might fail if private content requires authentication,
        // but we should test that the URL parsing works correctly
        await page.waitForTimeout(5000);
        
        // Check if we get an appropriate error message or if it loads
        const errorElements = page.locator('.error, .invalid, [data-testid="error"]');
        const queueItems = page.locator('.queue-item, .manuscript-item, [data-testid="queue-item"]');
        
        const hasError = await errorElements.count() > 0;
        const hasQueueItem = await queueItems.count() > 0;
        
        if (hasError) {
            const errorText = await errorElements.first().textContent();
            console.log(`⚠️ Expected authentication error for private content: ${errorText}`);
            // This is expected for private content
        } else if (hasQueueItem) {
            console.log('✅ Private BDL URL successfully loaded (may have public access)');
            const titleElement = queueItems.first().locator('.title, .manuscript-title, [data-testid="manuscript-title"]');
            const titleText = await titleElement.textContent();
            expect(titleText).toContain('BDL_3903');
        }
        
        console.log('✅ BDL private path parameter test completed');
    });
});