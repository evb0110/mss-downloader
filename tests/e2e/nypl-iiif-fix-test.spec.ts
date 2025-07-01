import { test, expect } from '@playwright/test';
import { ElectronApplication, Page, _electron as electron } from 'playwright';
import path from 'path';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
    electronApp = await electron.launch({
        args: [path.join(__dirname, '../../dist/main/main.js')],
        executablePath: process.env.ELECTRON_PATH,
    });
    
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
    await electronApp.close();
});

test('NYPL IIIF URL fix validation', async () => {
    // Test URL from the task description
    const testUrl = 'https://digitalcollections.nypl.org/items/6a709e10-1cda-013b-b83f-0242ac110002';
    
    // Input the URL
    await page.fill('#url-input', testUrl);
    
    // Click the load manifest button
    await page.click('#load-manifest-btn');
    
    // Wait for manifest to load
    await page.waitForSelector('#manifest-loaded', { timeout: 30000 });
    
    // Check that the library was detected as NYPL
    const libraryElement = await page.locator('#detected-library');
    const libraryText = await libraryElement.textContent();
    expect(libraryText).toContain('NYPL');
    
    // Check that pages were loaded
    const pagesElement = await page.locator('#total-pages');
    const pagesText = await pagesElement.textContent();
    const pageCount = parseInt(pagesText?.replace(/\D/g, '') || '0');
    expect(pageCount).toBeGreaterThan(0);
    
    // Use evaluate to check the URLs in the manifest data
    const manifestData = await page.evaluate(() => {
        return (window as any).lastManifest;
    });
    
    expect(manifestData).toBeDefined();
    expect(manifestData.pageLinks).toBeDefined();
    expect(manifestData.pageLinks.length).toBeGreaterThan(0);
    
    // Validate that all URLs use iiif-prod.nypl.org with t=g parameter
    const firstFewUrls = manifestData.pageLinks.slice(0, 3);
    
    for (const url of firstFewUrls) {
        expect(url).toContain('iiif-prod.nypl.org');
        expect(url).toContain('t=g');
        expect(url).not.toContain('images.nypl.org');
        expect(url).not.toContain('t=w');
    }
    
    console.log('Sample URLs validated:');
    firstFewUrls.forEach((url: string, index: number) => {
        console.log(`${index + 1}. ${url}`);
    });
    
    // Test that the first URL is actually a full-size image by checking its dimensions
    if (firstFewUrls.length > 0) {
        const firstUrl = firstFewUrls[0];
        
        // Create a test image element to check dimensions
        const imageDimensions = await page.evaluate(async (url) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    resolve({
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                        loaded: true
                    });
                };
                img.onerror = () => {
                    resolve({
                        width: 0,
                        height: 0,
                        loaded: false
                    });
                };
                img.src = url;
            });
        }, firstUrl);
        
        expect(imageDimensions.loaded).toBe(true);
        
        // Full-size images should be significantly larger than the old 515x759 resolution
        expect(imageDimensions.width).toBeGreaterThan(515);
        expect(imageDimensions.height).toBeGreaterThan(759);
        
        console.log(`First image dimensions: ${imageDimensions.width} x ${imageDimensions.height}`);
        console.log('✅ Confirmed: Image is full-size (larger than old 515x759 format)');
    }
});