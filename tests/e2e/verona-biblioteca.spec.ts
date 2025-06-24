import { test, expect } from './helpers/electron';

/**
 * Verona Biblioteca Manoscritta Test Suite
 * Tests implementation for Nuova Biblioteca Manoscritta - NBM (Veneto Region)
 */

test.describe('Verona Biblioteca Manoscritta', () => {

    test('should detect Verona library for complex interface URLs', async ({ page }) => {
        
        // Test interface URLs
        const testUrls = [
            'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
            'https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/visualizza.html?codiceDigital=15&volume=1',
            'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=14',
            'https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/visualizza.html?codiceDigital=14&volume=1'
        ];
        
        for (const url of testUrls) {
            // Fill the URL input
            await page.fill('input[type="url"]', url);
            
            // The library should be automatically detected as Verona
            // Check if the library indicator shows Verona
            await page.waitForTimeout(1000); // Wait for detection
            
            const libraryText = await page.locator('.library-indicator, .detected-library').textContent();
            expect(libraryText).toContain('Verona');
        }
    });

    test('should detect Verona library for direct IIIF manifest URLs', async ({ page }) => {
        
        const iiifUrls = [
            'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json',
            'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/CVII1001.json'
        ];
        
        for (const url of iiifUrls) {
            await page.fill('input[type="url"]', url);
            await page.waitForTimeout(1000);
            
            const libraryText = await page.locator('.library-indicator, .detected-library').textContent();
            expect(libraryText).toContain('Verona');
        }
    });

    test('should display Verona in supported libraries list', async ({ page }) => {
        
        // Look for supported libraries section or modal
        const supportedLibrariesButton = page.locator('button:has-text("Supported Libraries"), .supported-libraries');
        if (await supportedLibrariesButton.isVisible()) {
            await supportedLibrariesButton.click();
        }
        
        // Check if Verona library is listed
        const veronaLibrary = page.locator('text=Verona Biblioteca Manoscritta');
        await expect(veronaLibrary).toBeVisible();
        
        // Check if example URL is present
        const exampleUrl = page.locator('text=nuovabibliotecamanoscritta.it');
        await expect(exampleUrl).toBeVisible();
    });

    test('should load LXXXIX(84) manuscript manifest successfully', async ({ page }) => {
        
        // Test with codice=15 (LXXXIX 84)
        const testUrl = 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15';
        
        await page.fill('input[type="url"]', testUrl);
        
        // Trigger manifest loading (look for Load Manifest button or similar)
        const loadButton = page.locator('button:has-text("Load"), button:has-text("Analyze"), button:has-text("Add to Queue")');
        await loadButton.first().click();
        
        // Wait for manifest loading to complete
        await page.waitForSelector('.manifest-loaded, .pages-count, .manuscript-info', { timeout: 30000 });
        
        // Check that manuscript information is displayed
        const manuscriptInfo = page.locator('.manuscript-info, .manuscript-details');
        await expect(manuscriptInfo).toBeVisible();
        
        // Check for page count (should be around 50 pages based on the manifest)
        const pageCount = page.locator('text=/\\d+\\s+pages?/i');
        await expect(pageCount).toBeVisible();
        
        const pageCountText = await pageCount.textContent();
        const pages = parseInt(pageCountText?.match(/\\d+/)?.[0] || '0');
        expect(pages).toBeGreaterThan(0);
        expect(pages).toBeLessThan(200); // Reasonable upper bound
        
        // Check for display name containing LXXXIX or 84
        const displayName = page.locator('.display-name, .manuscript-title');
        if (await displayName.isVisible()) {
            const nameText = await displayName.textContent();
            expect(nameText).toMatch(/LXXXIX|84|Verona/);
        }
    });

    test('should load CVII(100) manuscript manifest successfully', async ({ page }) => {
        
        // Test with codice=14 (CVII 100)
        const testUrl = 'https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/visualizza.html?codiceDigital=14&volume=1';
        
        await page.fill('input[type="url"]', testUrl);
        
        const loadButton = page.locator('button:has-text("Load"), button:has-text("Analyze"), button:has-text("Add to Queue")');
        await loadButton.first().click();
        
        await page.waitForSelector('.manifest-loaded, .pages-count, .manuscript-info', { timeout: 30000 });
        
        // Check for page count
        const pageCount = page.locator('text=/\\d+\\s+pages?/i');
        await expect(pageCount).toBeVisible();
        
        const pageCountText = await pageCount.textContent();
        const pages = parseInt(pageCountText?.match(/\\d+/)?.[0] || '0');
        expect(pages).toBeGreaterThan(0);
        
        // Check for display name containing CVII or 100
        const displayName = page.locator('.display-name, .manuscript-title');
        if (await displayName.isVisible()) {
            const nameText = await displayName.textContent();
            expect(nameText).toMatch(/CVII|100|Verona/);
        }
    });

    test('should handle direct IIIF manifest URL correctly', async ({ page }) => {
        
        // Test direct IIIF manifest
        const iiifUrl = 'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json';
        
        await page.fill('input[type="url"]', iiifUrl);
        
        const loadButton = page.locator('button:has-text("Load"), button:has-text("Analyze"), button:has-text("Add to Queue")');
        await loadButton.first().click();
        
        await page.waitForSelector('.manifest-loaded, .pages-count, .manuscript-info', { timeout: 20000 });
        
        // Verify manifest loaded successfully
        const successIndicator = page.locator('.success, .loaded, .manifest-loaded');
        await expect(successIndicator).toBeVisible();
        
        // Check page count is reasonable
        const pageCount = page.locator('text=/\\d+\\s+pages?/i');
        await expect(pageCount).toBeVisible();
    });

    test('should show appropriate error for invalid Verona URL', async ({ page }) => {
        
        // Test invalid URL
        const invalidUrl = 'https://www.nuovabibliotecamanoscritta.it/invalid/path';
        
        await page.fill('input[type="url"]', invalidUrl);
        
        const loadButton = page.locator('button:has-text("Load"), button:has-text("Analyze"), button:has-text("Add to Queue")');
        await loadButton.first().click();
        
        // Should show error message
        await page.waitForSelector('.error, .error-message', { timeout: 15000 });
        
        const errorMessage = page.locator('.error, .error-message');
        await expect(errorMessage).toBeVisible();
        
        const errorText = await errorMessage.textContent();
        expect(errorText).toMatch(/codice|parameter|format/i);
    });

    test('should create queue item for Verona manuscript', async ({ page }) => {
        
        const testUrl = 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15';
        
        await page.fill('input[type="url"]', testUrl);
        
        // Add to queue
        const addToQueueButton = page.locator('button:has-text("Add to Queue"), button:has-text("Queue")');
        await addToQueueButton.click();
        
        // Wait for queue item to appear
        await page.waitForSelector('.queue-item, .queued-manuscript', { timeout: 30000 });
        
        // Check queue item details
        const queueItem = page.locator('.queue-item, .queued-manuscript').first();
        await expect(queueItem).toBeVisible();
        
        // Verify library is shown as Verona
        const libraryLabel = queueItem.locator('.library, .library-name');
        if (await libraryLabel.isVisible()) {
            const libraryText = await libraryLabel.textContent();
            expect(libraryText).toContain('verona');
        }
        
        // Check that display name includes Verona
        const displayName = queueItem.locator('.display-name, .manuscript-name');
        if (await displayName.isVisible()) {
            const nameText = await displayName.textContent();
            expect(nameText).toMatch(/Verona|LXXXIX/);
        }
    });

    test('should apply Verona-specific optimization settings', async ({ page }) => {
        
        const testUrl = 'https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/visualizza.html?codiceDigital=14&volume=1';
        
        await page.fill('input[type="url"]', testUrl);
        await page.locator('button:has-text("Add to Queue"), button:has-text("Queue")').click();
        
        await page.waitForSelector('.queue-item', { timeout: 30000 });
        
        // Look for optimization indicators or settings
        const queueItem = page.locator('.queue-item').first();
        
        // Check if optimization description is visible
        const optimizationText = page.locator('text=/optimization|concurrent|timeout/i');
        if (await optimizationText.isVisible()) {
            const text = await optimizationText.textContent();
            expect(text).toMatch(/3\\s+concurrent|extended\\s+timeout|complex\\s+interface/i);
        }
    });

});

test.describe('Verona Error Handling', () => {

    test('should handle SSL certificate issues gracefully', async ({ page }) => {
        
        // Test URL that might have SSL issues
        const testUrl = 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15';
        
        await page.fill('input[type="url"]', testUrl);
        await page.locator('button:has-text("Load"), button:has-text("Analyze")').first().click();
        
        // Should either succeed or show a clear error (not a generic SSL error)
        await page.waitForTimeout(20000);
        
        const hasError = await page.locator('.error').isVisible();
        const hasSuccess = await page.locator('.manifest-loaded, .pages-count').isVisible();
        
        expect(hasError || hasSuccess).toBeTruthy();
        
        if (hasError) {
            const errorText = await page.locator('.error').textContent();
            expect(errorText).not.toMatch(/SSL|certificate|ENOTFOUND/i);
        }
    });

    test('should handle network timeouts appropriately', async ({ page }) => {
        
        // This test verifies that timeouts are handled gracefully
        const testUrl = 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=99999'; // Non-existent codice
        
        await page.fill('input[type="url"]', testUrl);
        await page.locator('button:has-text("Load")').first().click();
        
        // Wait for timeout/error
        await page.waitForSelector('.error, .timeout', { timeout: 45000 });
        
        const errorMessage = page.locator('.error, .timeout');
        await expect(errorMessage).toBeVisible();
    });

});