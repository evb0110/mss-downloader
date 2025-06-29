import { test, expect } from '@playwright/test';

test.describe('e-manuscripta.ch Library', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5173');
        await page.waitForLoadState('networkidle');
    });

    test('should support e-manuscripta.ch URLs and load manifest', async ({ page }) => {
        const testUrl = 'https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497';
        
        // Add URL to queue
        await page.fill('input[type="text"]', testUrl);
        await page.click('button:has-text("Add to Queue")');
        
        // Wait for manifest to load
        await page.waitForSelector('.queue-item', { timeout: 30000 });
        
        // Check that the item was added with correct library detection
        const queueItem = page.locator('.queue-item').first();
        await expect(queueItem).toBeVisible();
        
        // Verify the URL is recognized as e-manuscripta
        const libraryInfo = await queueItem.locator('.library-badge, .library-tag, [class*="library"]').textContent();
        expect(libraryInfo).toContain('e-manuscripta');
        
        // Check that pages were detected
        const pageCount = await queueItem.locator('[class*="page"], [class*="total"]').textContent();
        expect(pageCount).toMatch(/\d+/); // Should contain numbers
        
        console.log('✅ e-manuscripta.ch URL successfully added to queue');
    });

    test('should detect multiple e-manuscripta URLs from different libraries', async ({ page }) => {
        const testUrls = [
            'https://www.e-manuscripta.ch/bau/content/zoom/4184794',
            'https://www.e-manuscripta.ch/zuz/content/zoom/1460717'
        ];
        
        for (const url of testUrls) {
            // Add each URL
            await page.fill('input[type="text"]', url);
            await page.click('button:has-text("Add to Queue")');
            
            // Wait for item to appear
            await page.waitForSelector('.queue-item', { timeout: 10000 });
        }
        
        // Verify both items are in the queue
        const queueItems = page.locator('.queue-item');
        await expect(queueItems).toHaveCount(2);
        
        console.log('✅ Multiple e-manuscripta.ch URLs successfully added');
    });

    test('should load manifest with page count for e-manuscripta', async ({ page }) => {
        const testUrl = 'https://www.e-manuscripta.ch/bau/content/zoom/4592715';
        
        // Add URL and wait for manifest loading
        await page.fill('input[type="text"]', testUrl);
        await page.click('button:has-text("Add to Queue")');
        
        // Wait for manifest to load (look for page count indicator)
        await page.waitForFunction(() => {
            const items = document.querySelectorAll('.queue-item');
            return Array.from(items).some(item => {
                const text = item.textContent || '';
                return text.includes('pages') || text.match(/\d+\/\d+/) || text.match(/\d+\s+pages/);
            });
        }, { timeout: 30000 });
        
        const queueItem = page.locator('.queue-item').first();
        const itemText = await queueItem.textContent();
        
        // Should contain page information
        expect(itemText).toMatch(/\d+/);
        
        console.log('✅ e-manuscripta.ch manifest loaded with page count');
    });

    test('should handle e-manuscripta URL format correctly', async ({ page }) => {
        // Test URL pattern recognition
        const validUrls = [
            'https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497',
            'https://www.e-manuscripta.ch/bau/content/zoom/4184794',
            'https://www.e-manuscripta.ch/zuz/content/zoom/1460717'
        ];
        
        for (let i = 0; i < validUrls.length; i++) {
            const url = validUrls[i];
            
            await page.fill('input[type="text"]', url);
            await page.click('button:has-text("Add to Queue")');
            
            // Wait for the item to be added
            await page.waitForSelector(`.queue-item:nth-child(${i + 1})`, { timeout: 10000 });
            
            // Verify no error messages
            const errorElement = page.locator('.error, .alert-error, [class*="error"]');
            const errorCount = await errorElement.count();
            expect(errorCount).toBe(0);
        }
        
        console.log('✅ All e-manuscripta.ch URL formats handled correctly');
    });
});