import { test, expect } from './helpers/electron';

test.describe('Czech Digital Library', () => {
    test('should detect Czech library URL correctly', async ({ page }) => {
        const czechUrl = 'https://dig.vkol.cz/dig/mii87/0001rx.htm';
        
        // Test library detection
        const result = await page.evaluate(async (url) => {
            try {
                const manifest = await window.electronAPI.parseManuscriptUrl(url);
                return {
                    success: true,
                    library: manifest.library,
                    displayName: manifest.displayName,
                    totalPages: manifest.totalPages,
                    pageLinksCount: manifest.pageLinks.length
                };
            } catch (error: any) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }, czechUrl);

        if (!result.success) {
            console.log('Czech library test error:', result.error);
        }

        expect(result.success).toBe(true);
        expect(result.library).toBe('czech');
        expect(result.totalPages).toBeGreaterThan(0);
        expect(result.pageLinksCount).toBeGreaterThan(0);
        expect(result.displayName).toMatch(/Graduale cisterciense|Czech Manuscript/); // Should extract proper title or use fallback
    });

    test('should generate correct image URLs for Czech library', async ({ page }) => {
        const czechUrl = 'https://dig.vkol.cz/dig/mii87/0001rx.htm';
        
        const result = await page.evaluate(async (url) => {
            try {
                const manifest = await window.electronAPI.parseManuscriptUrl(url);
                return {
                    success: true,
                    firstPageUrl: manifest.pageLinks[0],
                    secondPageUrl: manifest.pageLinks[1],
                    lastPageUrl: manifest.pageLinks[manifest.pageLinks.length - 1],
                    sampleUrls: manifest.pageLinks.slice(0, 6) // First 6 URLs for pattern verification
                };
            } catch (error: any) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }, czechUrl);

        expect(result.success).toBe(true);
        
        // Verify URL patterns
        expect(result.firstPageUrl).toBe('https://dig.vkol.cz/dig/mii87/inet/0001r.jpg');
        expect(result.secondPageUrl).toBe('https://dig.vkol.cz/dig/mii87/inet/0001v.jpg');
        
        // Check alternating recto/verso pattern
        result.sampleUrls?.forEach((url: string, index: number) => {
            const folioNum = Math.floor(index / 2) + 1;
            const paddedNum = folioNum.toString().padStart(4, '0');
            const side = index % 2 === 0 ? 'r' : 'v';
            const expectedUrl = `https://dig.vkol.cz/dig/mii87/inet/${paddedNum}${side}.jpg`;
            expect(url).toBe(expectedUrl);
        });
    });

    test('should be listed in supported libraries', async ({ page }) => {
        const libraries = await page.evaluate(async () => {
            return await window.electronAPI.getSupportedLibraries();
        });

        const czechLibrary = libraries.find(lib => lib.name.includes('Czech'));
        expect(czechLibrary).toBeDefined();
        expect(czechLibrary?.name).toBe('Czech Digital Library (VKOL)');
        expect(czechLibrary?.example).toBe('https://dig.vkol.cz/dig/mii87/0001rx.htm');
        expect(czechLibrary?.description).toContain('Experimental');
    });

    test('should handle URL parsing correctly', async ({ page }) => {
        const czechUrl = 'https://dig.vkol.cz/dig/mii87/0001rx.htm';
        
        const result = await page.evaluate(async (url) => {
            try {
                const manifest = await window.electronAPI.parseManuscriptUrl(url);
                return {
                    success: true,
                    library: manifest.library,
                    manuscriptId: url.includes('mii87') ? 'mii87' : 'unknown',
                    urlParsing: true
                };
            } catch (error: any) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }, czechUrl);

        expect(result.success).toBe(true);
        expect(result.library).toBe('czech');
        expect(result.manuscriptId).toBe('mii87');
        expect(result.urlParsing).toBe(true);
    });
});