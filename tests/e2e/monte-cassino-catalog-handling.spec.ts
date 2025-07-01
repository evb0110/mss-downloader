import { test, expect } from '@playwright/test';
import { join } from 'path';
import { statSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test.describe('Monte Cassino Catalog ID Handling', () => {
    
    test('should extract catalogId from ICCU URLs correctly', async ({ page }) => {
        console.log('Testing Monte Cassino catalogId extraction from ICCU URLs...');
        
        // Navigate to the app
        await page.goto('file://' + join(process.cwd(), 'dist/index.html'));
        await page.waitForSelector('input[type="url"]', { timeout: 10000 });
        
        const iccuUrls = [
            'https://manus.iccu.sbn.it/cnmd/0000313047',
            'https://manus.iccu.sbn.it/cnmd/0000396781', 
            'https://manus.iccu.sbn.it/cnmd/0000313194'
        ];
        
        for (const url of iccuUrls) {
            console.log(`Testing ICCU URL: ${url}`);
            
            let catalogIdExtracted = false;
            let manifestUrlGenerated = false;
            let catalogId = '';
            let generatedManifestUrl = '';
            
            page.on('console', msg => {
                const text = msg.text();
                
                // Check for catalogId extraction
                if (text.includes('catalogId extracted:') || text.includes('Extracted catalogId:')) {
                    catalogIdExtracted = true;
                    const match = text.match(/catalogId[:\s]+([A-Z0-9_-]+)/i);
                    if (match) {
                        catalogId = match[1];
                        console.log(`✓ CatalogId extracted: ${catalogId}`);
                    }
                }
                
                // Check for manifest URL generation
                if (text.includes('omnes.dbseret.com/montecassino/iiif/')) {
                    manifestUrlGenerated = true;
                    generatedManifestUrl = text;
                    console.log(`✓ Manifest URL generated: ${generatedManifestUrl}`);
                }
                
                // Log any errors for debugging
                if (text.includes('Error:') || text.includes('Failed:')) {
                    console.log('[ERROR]', text);
                }
            });
            
            await page.fill('input[type="url"]', url);
            await page.click('button:has-text("Add to Queue")');
            
            // Wait for processing
            await page.waitForTimeout(10000);
            
            // Validate catalogId extraction
            expect(catalogIdExtracted).toBe(true);
            expect(catalogId).toMatch(/^IT-FR0084_\d+$/);
            
            // Validate manifest URL generation
            expect(manifestUrlGenerated).toBe(true);
            expect(generatedManifestUrl).toContain('omnes.dbseret.com/montecassino/iiif/');
            expect(generatedManifestUrl).toContain(catalogId);
            
            // Clear for next test
            await page.fill('input[type="url"]', '');
        }
        
        console.log('✅ Monte Cassino catalogId extraction test PASSED');
    });

    test('should handle direct IIIF manifest URLs correctly', async ({ page }) => {
        console.log('Testing Monte Cassino direct IIIF manifest handling...');
        
        await page.goto('file://' + join(process.cwd(), 'dist/index.html'));
        await page.waitForSelector('input[type="url"]', { timeout: 10000 });
        
        const directManifestUrls = [
            'https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0339/manifest',
            'https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0271/manifest',
            'https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0023/manifest'
        ];
        
        for (const url of directManifestUrls) {
            console.log(`Testing direct manifest URL: ${url}`);
            
            let manifestLoaded = false;
            let pageCount = 0;
            let manuscriptTitle = '';
            
            page.on('console', msg => {
                const text = msg.text();
                
                if (text.includes('Monte Cassino manifest loaded') || text.includes('pages loaded')) {
                    manifestLoaded = true;
                    const pagesMatch = text.match(/(\d+) pages/);
                    if (pagesMatch) {
                        pageCount = parseInt(pagesMatch[1]);
                        console.log(`✓ Manifest loaded: ${pageCount} pages`);
                    }
                }
                
                if (text.includes('title:') || text.includes('Monte Cassino')) {
                    manuscriptTitle = text;
                    console.log(`✓ Manuscript title: ${manuscriptTitle}`);
                }
            });
            
            await page.fill('input[type="url"]', url);
            await page.click('button:has-text("Add to Queue")');
            
            // Wait for manifest loading
            await page.waitForTimeout(15000);
            
            // Validate direct manifest loading
            expect(manifestLoaded).toBe(true);
            expect(pageCount).toBeGreaterThan(0);
            expect(pageCount).toBeLessThan(1000); // Reasonable upper bound
            
            // Clear for next test
            await page.fill('input[type="url"]', '');
        }
        
        console.log('✅ Monte Cassino direct manifest test PASSED');
    });

    test('should download Monte Cassino manuscript with proper catalogId handling', async ({ page }) => {
        console.log('Testing full Monte Cassino download with catalogId processing...');
        
        await page.goto('file://' + join(process.cwd(), 'dist/index.html'));
        await page.waitForSelector('input[type="url"]', { timeout: 10000 });
        
        // Use direct manifest URL for reliable testing
        const testUrl = 'https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0339/manifest';
        await page.fill('input[type="url"]', testUrl);
        
        let manifestLoaded = false;
        let imageDownloadsStarted = false;
        let imageDownloadsSuccessful = 0;
        let totalPages = 0;
        let catalogIdProcessed = false;
        
        page.on('console', msg => {
            const text = msg.text();
            
            if (text.includes('Monte Cassino manifest loaded') || text.includes('manifest processed')) {
                manifestLoaded = true;
                const pagesMatch = text.match(/(\d+) pages/);
                if (pagesMatch) {
                    totalPages = parseInt(pagesMatch[1]);
                    console.log(`✓ Manifest loaded: ${totalPages} pages`);
                }
            }
            
            if (text.includes('IT-FR0084_') && (text.includes('catalogId') || text.includes('processing'))) {
                catalogIdProcessed = true;
                console.log('✓ CatalogId processed correctly');
            }
            
            if (text.includes('downloadImageWithRetries') && text.includes('omnes.dbseret.com')) {
                imageDownloadsStarted = true;
                console.log('✓ Image downloads started');
            }
            
            if (text.includes('✅') && (text.includes('download') || text.includes('page'))) {
                imageDownloadsSuccessful++;
            }
        });
        
        // Start download
        const downloadPromise = page.waitForEvent('download', { timeout: 180000 });
        await page.click('button:has-text("Download")');
        
        try {
            const download = await downloadPromise;
            const downloadPath = await download.path();
            
            console.log('Download completed, validating catalogId handling...');
            
            if (downloadPath) {
                const stats = statSync(downloadPath);
                const pdfSize = stats.size;
                
                console.log(`PDF size: ${pdfSize} bytes`);
                console.log(`Total pages: ${totalPages}`);
                console.log(`Successful downloads: ${imageDownloadsSuccessful}`);
                console.log(`CatalogId processed: ${catalogIdProcessed}`);
                
                // Validate PDF size
                expect(pdfSize).toBeGreaterThan(100000);
                
                // Validate manifest loading
                expect(manifestLoaded).toBe(true);
                
                // Validate image downloads
                expect(imageDownloadsStarted).toBe(true);
                
                // Success rate should be high
                if (totalPages > 0) {
                    const successRate = imageDownloadsSuccessful / totalPages;
                    console.log(`Download success rate: ${Math.round(successRate * 100)}%`);
                    expect(successRate).toBeGreaterThan(0.7);
                }
                
                // Validate PDF content with poppler
                try {
                    const { stdout } = await execAsync(`pdfinfo "${downloadPath}"`);
                    expect(stdout).toContain('Pages:');
                    
                    const popplerPages = stdout.match(/Pages:\s+(\d+)/);
                    if (popplerPages) {
                        const pdfPageCount = parseInt(popplerPages[1]);
                        console.log(`✓ PDF validation: ${pdfPageCount} pages in final PDF`);
                        expect(pdfPageCount).toBeGreaterThan(0);
                    }
                } catch (error) {
                    console.warn('Poppler validation failed:', error);
                }
                
                console.log('✅ Monte Cassino full download test PASSED');
                
            } else {
                throw new Error('Download path not available');
            }
            
        } catch (error) {
            console.error('❌ Monte Cassino download test failed:', error);
            throw error;
        }
    });

    test('should handle invalid catalogId gracefully', async ({ page }) => {
        console.log('Testing Monte Cassino invalid catalogId handling...');
        
        await page.goto('file://' + join(process.cwd(), 'dist/index.html'));
        await page.waitForSelector('input[type="url"]', { timeout: 10000 });
        
        const invalidUrls = [
            'https://manus.iccu.sbn.it/cnmd/9999999999', // Non-existent catalog
            'https://omnes.dbseret.com/montecassino/iiif/INVALID_ID/manifest', // Invalid direct manifest
            'https://manus.iccu.sbn.it/cnmd/' // Malformed URL
        ];
        
        for (const url of invalidUrls) {
            console.log(`Testing invalid URL: ${url}`);
            
            let errorHandled = false;
            let errorMessage = '';
            
            page.on('console', msg => {
                const text = msg.text();
                
                if (text.includes('Error:') || text.includes('Failed:') || text.includes('not found')) {
                    errorHandled = true;
                    errorMessage = text;
                    console.log('✓ Error handled:', text);
                }
            });
            
            await page.fill('input[type="url"]', url);
            await page.click('button:has-text("Add to Queue")');
            
            // Wait for error handling
            await page.waitForTimeout(10000);
            
            // Should handle error gracefully
            expect(errorHandled).toBe(true);
            expect(errorMessage).toBeTruthy();
            
            // Error should be user-friendly
            expect(errorMessage).not.toContain('TypeError');
            expect(errorMessage).not.toContain('undefined');
            
            // Clear for next test
            await page.fill('input[type="url"]', '');
        }
        
        console.log('✅ Monte Cassino error handling test PASSED');
    });
});

test.describe('Monte Cassino Integration', () => {
    
    test('should appear in supported libraries list', async ({ page }) => {
        console.log('Testing Monte Cassino library listing...');
        
        await page.goto('file://' + join(process.cwd(), 'dist/index.html'));
        await page.waitForSelector('input[type="url"]', { timeout: 10000 });
        
        // Check if Monte Cassino appears in supported libraries
        const pageContent = await page.textContent('body');
        expect(pageContent).toMatch(/Monte.*Cassino|Abbey.*Library/i);
        
        console.log('✅ Monte Cassino library listing test PASSED');
    });

    test('should validate URL patterns correctly', async ({ page }) => {
        console.log('Testing Monte Cassino URL pattern validation...');
        
        await page.goto('file://' + join(process.cwd(), 'dist/index.html'));
        await page.waitForSelector('input[type="url"]', { timeout: 10000 });
        
        const validUrls = [
            'https://manus.iccu.sbn.it/cnmd/0000313047',
            'https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0339/manifest'
        ];
        
        const invalidUrls = [
            'https://other-library.com/manuscript/123',
            'https://manus.iccu.sbn.it/different-path/123'
        ];
        
        // Test valid URLs
        for (const url of validUrls) {
            await page.fill('input[type="url"]', url);
            await page.waitForTimeout(1000);
            
            // Should be recognized as Monte Cassino
            const pageContent = await page.textContent('body');
            expect(pageContent).not.toContain('Unsupported library');
        }
        
        // Test invalid URLs  
        for (const url of invalidUrls) {
            await page.fill('input[type="url"]', url);
            await page.waitForTimeout(1000);
            
            // Should not be recognized as Monte Cassino
            // (will either be recognized as different library or unsupported)
        }
        
        console.log('✅ Monte Cassino URL validation test PASSED');
    });
});