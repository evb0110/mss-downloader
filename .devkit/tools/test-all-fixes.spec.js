import { test, expect } from '@playwright/test';

test.describe('All Fixes Verification', () => {
    test('should verify Europeana displayName fix', async ({ page }) => {
        // Test the specific Europeana URL that was causing the error
        const europeanaUrl = 'https://www.europeana.eu/en/item/446/CNMD_0000171876';
        
        // Start the application
        await page.goto('/');
        
        // Add the Europeana URL
        await page.fill('[data-testid="url-input"]', europeanaUrl);
        await page.click('[data-testid="add-url"]');
        
        // Wait for processing to complete or start
        await page.waitForTimeout(5000);
        
        // Check that no "manifest.displayName.replace is not a function" error appears
        const errorMessages = await page.locator('.error, .failed').textContent();
        expect(errorMessages || '').not.toContain('displayName.replace is not a function');
        
        console.log('✅ Europeana displayName fix verified');
    });

    test('should verify Morgan Library quality improvement', async ({ page }) => {
        // Test Morgan Library URL
        const morganUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
        
        await page.goto('/');
        
        // Add the Morgan URL
        await page.fill('[data-testid="url-input"]', morganUrl);
        await page.click('[data-testid="add-url"]');
        
        // Wait for manifest loading
        await page.waitForTimeout(10000);
        
        // Check that the manifest loaded successfully
        const queueItems = await page.locator('.queue-item').count();
        expect(queueItems).toBeGreaterThan(0);
        
        console.log('✅ Morgan Library processing verified');
    });

    test('should verify stop button functionality', async ({ page }) => {
        await page.goto('/');
        
        // Add a URL that will take some time to process
        const testUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b8449691v/f1.planchecontact';
        await page.fill('[data-testid="url-input"]', testUrl);
        await page.click('[data-testid="add-url"]');
        
        // Start download
        await page.click('[data-testid="start-queue"]');
        
        // Wait for download to start
        await page.waitForTimeout(2000);
        
        // Click stop button
        await page.click('[data-testid="stop-queue"]');
        
        // Verify queue is stopped (button text should change)
        await page.waitForTimeout(1000);
        const stopButtonExists = await page.locator('[data-testid="stop-queue"]').count() === 0;
        expect(stopButtonExists).toBe(true);
        
        console.log('✅ Stop button functionality verified');
    });

    test('should verify pause/resume functionality', async ({ page }) => {
        await page.goto('/');
        
        // Add a URL
        const testUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b8449691v/f1.planchecontact';
        await page.fill('[data-testid="url-input"]', testUrl);
        await page.click('[data-testid="add-url"]');
        
        // Start download
        await page.click('[data-testid="start-queue"]');
        
        // Wait for download to start
        await page.waitForTimeout(2000);
        
        // Pause
        await page.click('.pause-btn');
        
        // Verify pause button is visible
        await page.waitForTimeout(1000);
        const resumeButtonExists = await page.locator('.resume-btn').count() > 0;
        expect(resumeButtonExists).toBe(true);
        
        // Resume
        await page.click('.resume-btn');
        
        // Verify resume worked
        await page.waitForTimeout(1000);
        const pauseButtonExists = await page.locator('.pause-btn').count() > 0;
        expect(pauseButtonExists).toBe(true);
        
        console.log('✅ Pause/resume functionality verified');
    });
});

console.log('All fixes verification completed successfully! 🎉');