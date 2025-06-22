import { test, expect } from './helpers/electron';

test.describe('Vienna Manuscripta.at Integration', () => {

    const testUrls = [
        'https://manuscripta.at/diglit/AT5000-1013/0001',
        'https://manuscripta.at/diglit/AT5000-1010/0001',
        'https://manuscripta.at/diglit/AT5000-588/0001'
    ];

    test('should detect Vienna Manuscripta URLs correctly', async ({ page }) => {
        for (const url of testUrls) {
            // Test URL input
            await page.fill('input[type="url"]', url);
            
            // The app should recognize it as Vienna Manuscripta
            const libraryText = await page.locator('.library-info').textContent();
            expect(libraryText).toContain('Vienna Manuscripta');
        }
    });

    test('should load Vienna Manuscripta manifest successfully', async ({ page }) => {
        const testUrl = testUrls[0]; // Use first URL for detailed testing
        
        await page.fill('input[type="url"]', testUrl);
        await page.click('button:has-text("Add to Queue")');
        
        // Wait for manifest loading to complete
        await page.waitForSelector('.queue-item', { timeout: 30000 });
        
        // Check that the item was added with correct information
        const queueItem = page.locator('.queue-item').first();
        
        const displayName = await queueItem.locator('.display-name').textContent();
        expect(displayName).toContain('Vienna_AT5000-1013');
        
        const library = await queueItem.locator('.library').textContent();
        expect(library).toContain('vienna_manuscripta');
        
        // Check that total pages is reasonable (Vienna manuscripts typically have many pages)
        const totalPages = await queueItem.locator('.total-pages').textContent();
        expect(parseInt(totalPages || '0')).toBeGreaterThan(10);
    });

    test('should handle all three test URLs', async ({ page }) => {
        // Clear queue first
        await page.click('button:has-text("Delete All")');
        
        for (const url of testUrls) {
            await page.fill('input[type="url"]', url);
            await page.click('button:has-text("Add to Queue")');
            
            // Wait for the item to be added
            await page.waitForSelector('.queue-item', { timeout: 15000 });
        }
        
        // Should have 3 items in queue
        const queueItems = await page.locator('.queue-item').count();
        expect(queueItems).toBe(3);
        
        // All should be Vienna Manuscripta
        for (let i = 0; i < 3; i++) {
            const library = await page.locator('.queue-item').nth(i).locator('.library').textContent();
            expect(library).toContain('vienna_manuscripta');
        }
    });

    test('should show correct optimizations for Vienna Manuscripta', async ({ page }) => {
        const testUrl = testUrls[0];
        
        await page.fill('input[type="url"]', testUrl);
        await page.click('button:has-text("Add to Queue")');
        
        // Wait for item to be added
        await page.waitForSelector('.queue-item');
        
        // Check if optimization information is displayed
        const optimizationInfo = await page.locator('.optimization-info').textContent();
        expect(optimizationInfo).toContain('Vienna Manuscripta optimizations');
        expect(optimizationInfo).toContain('2 concurrent downloads');
        expect(optimizationInfo).toContain('extended timeouts');
    });

    test('should handle Vienna Manuscripta URLs with different page numbers', async ({ page }) => {
        // Test that URLs with different page numbers are normalized correctly
        const urlVariations = [
            'https://manuscripta.at/diglit/AT5000-1013/0001',
            'https://manuscripta.at/diglit/AT5000-1013/0005',
            'https://manuscripta.at/diglit/AT5000-1013/0050'
        ];
        
        for (const url of urlVariations) {
            await page.fill('input[type="url"]', url);
            
            // All should be detected as the same manuscript
            const libraryInfo = await page.locator('.library-info').textContent();
            expect(libraryInfo).toContain('Vienna Manuscripta');
            
            // The display name should be consistent regardless of page number
            await page.click('button:has-text("Add to Queue")');
            await page.waitForSelector('.queue-item');
            
            const displayName = await page.locator('.queue-item').last().locator('.display-name').textContent();
            expect(displayName).toContain('Vienna_AT5000-1013');
        }
    });
});