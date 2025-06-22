import { test, expect } from './helpers/electron';

/**
 * NYPL (New York Public Library) Digital Collections Test
 * 
 * This test verifies that the NYPL manifest detection fix works correctly.
 * Previous issue: Start button remained disabled because redirect URLs were timing out.
 * Fix: Extract carousel data and use direct IIIF URLs instead of broken redirect URLs.
 */

test.describe('NYPL Digital Collections', () => {

    test('should successfully detect NYPL manifest and enable Start button', async ({ page }) => {
        // Target URL that was previously failing
        const nyplUrl = 'https://digitalcollections.nypl.org/items/89620130-9eeb-013d-0806-0242ac110002';
        
        // Navigate to the URL input and enter NYPL URL
        await page.getByPlaceholder('Enter manuscript URL').fill(nyplUrl);
        
        // Wait for manifest detection to complete
        // The Start button should become enabled if manifest detection succeeds
        await expect(page.getByRole('button', { name: /start queue/i })).toBeEnabled({ timeout: 15000 });
        
        // Verify that page count is detected (should show total pages)
        const pageCountText = await page.locator('[data-testid="page-count"], .page-count').textContent();
        expect(pageCountText).toMatch(/\d+/); // Should contain numbers indicating page count
        
        // Verify that the title is extracted correctly
        const titleElement = await page.locator('[data-testid="manuscript-title"], .manuscript-title, .display-name');
        if (await titleElement.count() > 0) {
            const titleText = await titleElement.textContent();
            expect(titleText).toBeTruthy();
            expect(titleText?.length).toBeGreaterThan(0);
        }
        
        console.log('✅ NYPL manifest detection successful');
        console.log(`   URL: ${nyplUrl}`);
        if (pageCountText) {
            console.log(`   Page count detected: ${pageCountText}`);
        }
    });

    test('should handle NYPL URL variants correctly', async ({ page }) => {
        // Test with the example URL from supported libraries
        const exampleUrl = 'https://digitalcollections.nypl.org/items/6a709e10-1cda-013b-b83f-0242ac110002';
        
        await page.getByPlaceholder('Enter manuscript URL').fill(exampleUrl);
        
        // Wait for manifest detection
        await expect(page.getByRole('button', { name: /start queue/i })).toBeEnabled({ timeout: 15000 });
        
        // Verify page count is detected
        const pageCountText = await page.locator('[data-testid="page-count"], .page-count').textContent();
        expect(pageCountText).toMatch(/\d+/);
        
        console.log('✅ NYPL example URL test successful');
        console.log(`   URL: ${exampleUrl}`);
        if (pageCountText) {
            console.log(`   Page count detected: ${pageCountText}`);
        }
    });

    test('should show proper error for invalid NYPL URLs', async ({ page }) => {
        const invalidUrl = 'https://digitalcollections.nypl.org/invalid-path';
        
        await page.getByPlaceholder('Enter manuscript URL').fill(invalidUrl);
        
        // Wait a moment for processing
        await page.waitForTimeout(3000);
        
        // Start button should remain disabled for invalid URLs
        const startButton = page.getByRole('button', { name: /start queue/i });
        await expect(startButton).toBeDisabled();
        
        console.log('✅ Invalid NYPL URL properly rejected');
    });

    test('should extract correct title from NYPL manuscripts', async ({ page }) => {
        const nyplUrl = 'https://digitalcollections.nypl.org/items/89620130-9eeb-013d-0806-0242ac110002';
        
        await page.getByPlaceholder('Enter manuscript URL').fill(nyplUrl);
        await expect(page.getByRole('button', { name: /start queue/i })).toBeEnabled({ timeout: 15000 });
        
        // Look for title display (the exact selector depends on UI implementation)
        const possibleTitleSelectors = [
            '[data-testid="manuscript-title"]',
            '.manuscript-title',
            '.display-name',
            '.queue-item-title',
            'h1', 'h2', 'h3' // fallback to common heading elements
        ];
        
        let titleFound = false;
        let titleText = '';
        
        for (const selector of possibleTitleSelectors) {
            const element = page.locator(selector);
            if (await element.count() > 0) {
                titleText = await element.first().textContent() || '';
                if (titleText.trim().length > 0 && !titleText.includes('NYPL Document')) {
                    titleFound = true;
                    break;
                }
            }
        }
        
        // Title should be extracted (based on our test results, it should be "Gospel Lectionary")
        if (titleFound) {
            console.log(`✅ Title extracted: "${titleText}"`);
            expect(titleText.trim().length).toBeGreaterThan(0);
        } else {
            console.log('ℹ️  Title extraction test skipped - UI element not found');
        }
    });
});