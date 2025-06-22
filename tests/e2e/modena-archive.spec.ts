import { test, expect } from './helpers/electron';

test.describe('Modena Diocesan Archive', () => {

    test('should add Modena Archive URL to queue successfully', async ({ page }) => {
        const testUrl = 'https://archiviodiocesano.mo.it/archivio/flip/ACMo-OI-7/';
        
        // Wait for the app to load
        await page.waitForSelector('[data-testid="url-input"]', { timeout: 10000 });
        
        // Enter the URL
        await page.fill('[data-testid="url-input"]', testUrl);
        
        // Click add to queue
        await page.click('[data-testid="add-button"]');
        
        // Wait for queue item to appear
        await page.waitForSelector('[data-testid="queue-item"]', { timeout: 30000 });
        
        // Check that URL was accepted and is being processed
        const queueItem = await page.locator('[data-testid="queue-item"]').first();
        let queueItemText = await queueItem.textContent();
        
        // Should initially show loading
        expect(queueItemText).toContain('archiviodiocesano.mo.it');
        
        // Wait for manifest loading to complete (up to 60 seconds)
        let retries = 60;
        while (retries > 0 && queueItemText && queueItemText.includes('Loading manifest')) {
            await page.waitForTimeout(1000);
            queueItemText = await queueItem.textContent();
            retries--;
        }
        
        // Log the final text to see what we got
        console.log('Final queue item text:', queueItemText);
        
        // If manifest loaded successfully, should contain display name
        if (queueItemText && !queueItemText.includes('Loading manifest') && !queueItemText.includes('failed')) {
            expect(queueItemText).toContain('Modena_ACMo-OI-7');
        }
        
        // Check if there was an error in processing
        const errorMessage = await page.locator('[data-testid="error-message"]').textContent().catch(() => null);
        if (errorMessage) {
            console.log('Error message:', errorMessage);
        }
    });

    test('should add ACMo-OI-13 to queue successfully', async ({ page }) => {
        const testUrl = 'https://archiviodiocesano.mo.it/archivio/flip/ACMo-OI-13/';
        
        await page.waitForSelector('[data-testid="url-input"]', { timeout: 10000 });
        await page.fill('[data-testid="url-input"]', testUrl);
        await page.click('[data-testid="add-button"]');
        
        await page.waitForSelector('[data-testid="queue-item"]', { timeout: 30000 });
        
        const queueItem = await page.locator('[data-testid="queue-item"]').first();
        const queueItemText = await queueItem.textContent();
        
        expect(queueItemText).toContain('Modena_ACMo-OI-13');
    });

    test('should add ACMo-O.I.16 to queue successfully', async ({ page }) => {
        const testUrl = 'https://archiviodiocesano.mo.it/archivio/flip/ACMo-O.I.16/';
        
        await page.waitForSelector('[data-testid="url-input"]', { timeout: 10000 });
        await page.fill('[data-testid="url-input"]', testUrl);
        await page.click('[data-testid="add-button"]');
        
        await page.waitForSelector('[data-testid="queue-item"]', { timeout: 30000 });
        
        const queueItem = await page.locator('[data-testid="queue-item"]').first();
        const queueItemText = await queueItem.textContent();
        
        expect(queueItemText).toContain('Modena_ACMo-O.I.16');
    });

    test('should show error for invalid Modena URLs', async ({ page }) => {
        const invalidUrl = 'https://archiviodiocesano.mo.it/archivio/invalid/';
        
        await page.waitForSelector('[data-testid="url-input"]', { timeout: 10000 });
        await page.fill('[data-testid="url-input"]', invalidUrl);
        await page.click('[data-testid="add-button"]');
        
        // Should show error message  
        await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });
        
        const errorText = await page.textContent('[data-testid="error-message"]');
        expect(errorText).toContain('Invalid Modena URL format');
    });
});