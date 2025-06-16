import { test, expect } from '@playwright/test';

test.describe('Cambridge CUDL Bug Fix', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('[data-testid="app-ready"]')).toBeVisible({ timeout: 30000 });
    });

    const cudlTestUrls = [
        {
            url: 'https://cudl.lib.cam.ac.uk/view/MS-II-00006-00032/1',
            expectedPages: 175,
            name: 'MS-II-00006-00032'
        },
        {
            url: 'https://cudl.lib.cam.ac.uk/view/MS-ADD-00451/301',
            expectedPages: 500,
            name: 'MS-ADD-00451'  
        },
        {
            url: 'https://cudl.lib.cam.ac.uk/view/MS-KK-00001-00024/131',
            expectedPages: 235,
            name: 'MS-KK-00001-00024'
        }
    ];

    for (const { url, expectedPages, name } of cudlTestUrls) {
        test(`Cambridge CUDL ${name} should load manifest without hanging on calculating`, async ({ page }) => {
            // Add the URL to the queue
            await page.locator('[data-testid="url-input"]').fill(url);
            await page.locator('[data-testid="add-to-queue"]').click();

            // Wait for the item to appear in the queue
            const queueItem = page.locator('[data-testid="queue-item"]').first();
            await expect(queueItem).toBeVisible({ timeout: 10000 });

            // Start the download to trigger manifest loading
            await page.locator('[data-testid="start-queue"]').click();

            // The bug was that it would hang on "calculating..." stage
            // With the fix, it should quickly move past calculating to show proper page count
            await expect(queueItem.locator('[data-testid="item-status"]')).toContainText('downloading', { timeout: 30000 });
            
            // Verify the total pages were loaded correctly (not stuck on calculating)
            const totalPagesText = await queueItem.locator('[data-testid="total-pages"]').textContent();
            const totalPages = parseInt(totalPagesText?.match(/\d+/)?.[0] || '0');
            expect(totalPages).toBe(expectedPages);

            // Verify library type is detected correctly
            await expect(queueItem.locator('[data-testid="library-type"]')).toContainText('cudl');

            // Stop the download (we don't need to complete it for this test)
            await page.locator('[data-testid="stop-queue"]').click();
        });
    }

    test('Cambridge CUDL should not return 403 Forbidden errors', async ({ page }) => {
        // This test verifies that the HTTP headers fix prevents 403 errors
        const testUrl = 'https://cudl.lib.cam.ac.uk/view/MS-II-00006-00032/1';
        
        await page.locator('[data-testid="url-input"]').fill(testUrl);
        await page.locator('[data-testid="add-to-queue"]').click();

        const queueItem = page.locator('[data-testid="queue-item"]').first();
        await expect(queueItem).toBeVisible({ timeout: 10000 });

        await page.locator('[data-testid="start-queue"]').click();

        // Should not show any 403 Forbidden errors in the status
        await expect(queueItem.locator('[data-testid="item-status"]')).not.toContainText('403', { timeout: 30000 });
        await expect(queueItem.locator('[data-testid="item-status"]')).not.toContainText('Forbidden', { timeout: 30000 });
        await expect(queueItem.locator('[data-testid="item-status"]')).not.toContainText('Failed to fetch CUDL manifest', { timeout: 30000 });

        // Should successfully load the manifest
        await expect(queueItem.locator('[data-testid="item-status"]')).toContainText('downloading', { timeout: 30000 });

        await page.locator('[data-testid="stop-queue"]').click();
    });
});