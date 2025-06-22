import { test, expect } from './helpers/electron';

test.describe('Czech Digital Library Download Test', () => {
    test.skip('should download a few pages from Czech library (manual test)', async ({ page }) => {
        // This test is skipped by default as it requires actual downloading
        // Remove .skip to run manually
        
        const czechUrl = 'https://dig.vkol.cz/dig/mii87/0001rx.htm';
        
        const result = await page.evaluate(async (url) => {
            return new Promise((resolve) => {
                const callbacks = {
                    onProgress: (progress: any) => {
                        console.log(`Czech download progress: ${progress.percentage}%`);
                        // Stop after downloading just a few pages for testing
                        if (progress.downloadedPages >= 5) {
                            resolve({
                                success: true,
                                downloadedPages: progress.downloadedPages,
                                totalPages: progress.totalPages,
                                message: 'Test stopped after 5 pages'
                            });
                        }
                    },
                    onStatusChange: (status: any) => {
                        console.log(`Czech download status: ${status.phase} - ${status.message}`);
                        if (status.phase === 'error') {
                            resolve({
                                success: false,
                                error: status.message
                            });
                        }
                        if (status.phase === 'completed') {
                            resolve({
                                success: true,
                                message: 'Download completed successfully'
                            });
                        }
                    },
                    onError: (error: string) => {
                        resolve({
                            success: false,
                            error: error
                        });
                    }
                };

                // Start download with limited page range for testing
                window.electronAPI.downloadManuscript(url, callbacks).catch((error) => {
                    resolve({
                        success: false,
                        error: error.message
                    });
                });

                // Timeout after 2 minutes
                setTimeout(() => {
                    resolve({
                        success: false,
                        error: 'Test timeout after 2 minutes'
                    });
                }, 120000);
            });
        }, czechUrl);

        console.log('Czech download test result:', result);
        expect(result.success).toBe(true);
    });

    test('should validate Czech image URLs return proper images', async ({ page }) => {
        const czechUrl = 'https://dig.vkol.cz/dig/mii87/0001rx.htm';
        
        const result = await page.evaluate(async (url) => {
            try {
                const manifest = await window.electronAPI.parseManuscriptUrl(url);
                
                // Test first few image URLs to see if they're accessible
                const testUrls = manifest.pageLinks.slice(0, 3);
                const testResults = [];
                
                for (const imageUrl of testUrls) {
                    try {
                        const response = await fetch(imageUrl, { method: 'HEAD' });
                        testResults.push({
                            url: imageUrl,
                            status: response.status,
                            contentType: response.headers.get('content-type'),
                            accessible: response.ok
                        });
                    } catch (error: any) {
                        testResults.push({
                            url: imageUrl,
                            error: error.message,
                            accessible: false
                        });
                    }
                }
                
                return {
                    success: true,
                    testResults,
                    totalUrls: manifest.pageLinks.length
                };
            } catch (error: any) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }, czechUrl);

        expect(result.success).toBe(true);
        expect(result.testResults).toBeDefined();
        expect(result.totalUrls).toBeGreaterThan(0);
        
        // Check if at least some images are accessible
        const accessibleImages = result.testResults?.filter((r: any) => r.accessible) || [];
        console.log('Czech image accessibility test:', {
            total: result.testResults?.length || 0,
            accessible: accessibleImages.length,
            results: result.testResults
        });
        
        // Expect at least one image to be accessible (some might fail due to network/server issues)
        expect(accessibleImages.length).toBeGreaterThan(0);
        
        // Check content types for accessible images
        accessibleImages.forEach((img: any) => {
            expect(img.contentType).toMatch(/image\/(jpeg|jpg|png)/i);
        });
    });
});