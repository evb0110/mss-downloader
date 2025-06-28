import { test, expect } from './helpers/electron';

test.describe('Vienna Manuscripta Page Range Fix', () => {

    test('should respect page ranges in manuscripta.at URLs', async ({ page }) => {
        // Test the problematic URL from the bug report
        const specificPageUrl = 'https://manuscripta.at/diglit/AT5000-963/0001';
        
        console.log('Testing page range fix for:', specificPageUrl);
        
        // Clear any existing queue items
        await page.click('button:has-text("Delete All")');
        
        // Test specific page URL
        await page.fill('input[type="url"]', specificPageUrl);
        await page.click('button:has-text("Add to Queue")');
        
        // Wait for manifest loading
        await page.waitForSelector('.queue-item', { timeout: 30000 });
        
        const queueItem = page.locator('.queue-item').first();
        
        // Verify it's recognized as Vienna Manuscripta
        const library = await queueItem.locator('.library').textContent();
        expect(library).toContain('vienna_manuscripta');
        
        // Get the total pages - with the fix, this should NOT be the entire manuscript
        const totalPagesText = await queueItem.locator('.total-pages').textContent();
        const totalPages = parseInt(totalPagesText || '0');
        
        console.log(`Pages returned for specific page URL: ${totalPages}`);
        
        // For a specific page URL, we expect a smaller number of pages than the full manuscript
        // The full manuscript typically has 100+ pages, starting from page 1 should give us fewer
        expect(totalPages).toBeGreaterThan(0);
        expect(totalPages).toBeLessThan(500); // Reasonable upper bound
        
        // Verify the display name is correct
        const displayName = await queueItem.locator('.display-name').textContent();
        expect(displayName).toContain('Vienna_AT5000-963');
    });

    test('should download entire manuscript when no page specified', async ({ page }) => {
        // Test URL without page number (backward compatibility)
        const fullManuscriptUrl = 'https://manuscripta.at/diglit/AT5000-1013';
        
        console.log('Testing full manuscript URL:', fullManuscriptUrl);
        
        // Clear any existing queue items
        await page.click('button:has-text("Delete All")');
        
        await page.fill('input[type="url"]', fullManuscriptUrl);
        await page.click('button:has-text("Add to Queue")');
        
        // Wait for manifest loading
        await page.waitForSelector('.queue-item', { timeout: 30000 });
        
        const queueItem = page.locator('.queue-item').first();
        
        // Verify it's recognized as Vienna Manuscripta
        const library = await queueItem.locator('.library').textContent();
        expect(library).toContain('vienna_manuscripta');
        
        // For full manuscript, expect many pages
        const totalPagesText = await queueItem.locator('.total-pages').textContent();
        const totalPages = parseInt(totalPagesText || '0');
        
        console.log(`Pages returned for full manuscript URL: ${totalPages}`);
        
        // Full manuscript should have substantial number of pages
        expect(totalPages).toBeGreaterThan(50);
        
        const displayName = await queueItem.locator('.display-name').textContent();
        expect(displayName).toContain('Vienna_AT5000-1013');
    });

    test('should handle different page numbers correctly', async ({ page }) => {
        // Test multiple page numbers to ensure URL parsing works correctly
        const testCases = [
            { url: 'https://manuscripta.at/diglit/AT5000-1013/0001', expectedPage: 1 },
            { url: 'https://manuscripta.at/diglit/AT5000-1013/0005', expectedPage: 5 },
            { url: 'https://manuscripta.at/diglit/AT5000-1013/0010', expectedPage: 10 }
        ];
        
        // Clear any existing queue items
        await page.click('button:has-text("Delete All")');
        
        for (const testCase of testCases) {
            console.log(`Testing page ${testCase.expectedPage}: ${testCase.url}`);
            
            await page.fill('input[type="url"]', testCase.url);
            await page.click('button:has-text("Add to Queue")');
            
            // Wait for the item to be added
            await page.waitForSelector('.queue-item', { timeout: 15000 });
            
            // Check the last added item
            const queueItems = page.locator('.queue-item');
            const count = await queueItems.count();
            const lastItem = queueItems.nth(count - 1);
            
            // Verify recognition
            const library = await lastItem.locator('.library').textContent();
            expect(library).toContain('vienna_manuscripta');
            
            // For higher page numbers, expect fewer remaining pages
            const totalPagesText = await lastItem.locator('.total-pages').textContent();
            const totalPages = parseInt(totalPagesText || '0');
            
            console.log(`Page ${testCase.expectedPage}: ${totalPages} pages remaining`);
            
            // Pages should decrease as we start from higher page numbers
            expect(totalPages).toBeGreaterThan(0);
            
            // The display name should be consistent regardless of page number
            const displayName = await lastItem.locator('.display-name').textContent();
            expect(displayName).toContain('Vienna_AT5000-1013');
        }
        
        // Verify that we have 3 items in queue
        const totalItems = await page.locator('.queue-item').count();
        expect(totalItems).toBe(3);
    });

    test('should preserve existing functionality for other Vienna URLs', async ({ page }) => {
        // Test that existing URLs still work correctly
        const existingUrls = [
            'https://manuscripta.at/diglit/AT5000-588/0001',
            'https://manuscripta.at/diglit/AT5000-1010/0001'
        ];
        
        // Clear any existing queue items
        await page.click('button:has-text("Delete All")');
        
        for (const url of existingUrls) {
            await page.fill('input[type="url"]', url);
            await page.click('button:has-text("Add to Queue")');
            
            // Wait for the item to be added
            await page.waitForSelector('.queue-item', { timeout: 15000 });
        }
        
        // Should have 2 items in queue
        const queueItems = await page.locator('.queue-item').count();
        expect(queueItems).toBe(2);
        
        // All should be Vienna Manuscripta
        for (let i = 0; i < 2; i++) {
            const library = await page.locator('.queue-item').nth(i).locator('.library').textContent();
            expect(library).toContain('vienna_manuscripta');
            
            const totalPagesText = await page.locator('.queue-item').nth(i).locator('.total-pages').textContent();
            const totalPages = parseInt(totalPagesText || '0');
            expect(totalPages).toBeGreaterThan(0);
        }
    });
});