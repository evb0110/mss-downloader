import { test, expect } from '@playwright/test';
import { join } from 'path';
import { statSync } from 'fs';

test('University of Graz timeout fix - prevent 331-byte blank PDFs', async ({ page }) => {
    console.log('Testing University of Graz timeout fix to prevent blank PDFs...');
    
    // Navigate to the app
    await page.goto('file://' + join(process.cwd(), 'dist/index.html'));
    await page.waitForSelector('input[type="url"]', { timeout: 10000 });
    
    // Test URL - University of Graz manuscript
    const testUrl = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538';
    await page.fill('input[type="url"]', testUrl);
    
    // Monitor for timeout and download progress
    let manifestLoaded = false;
    let downloadStarted = false;
    let timeoutDetected = false;
    let totalPages = 0;
    let successfulDownloads = 0;
    
    page.on('console', msg => {
        const text = msg.text();
        
        // Manifest loading
        if (text.includes('University of Graz manifest loaded')) {
            manifestLoaded = true;
            const pagesMatch = text.match(/(\d+) pages/);
            if (pagesMatch) {
                totalPages = parseInt(pagesMatch[1]);
                console.log(`✓ Manifest loaded: ${totalPages} pages`);
            }
        }
        
        // Download progress
        if (text.includes('Downloading') || text.includes('page')) {
            downloadStarted = true;
        }
        
        // Successful downloads
        if (text.includes('✓') && (text.includes('download') || text.includes('page'))) {
            successfulDownloads++;
        }
        
        // Timeout detection
        if (text.includes('timeout') || text.includes('60000') || text.includes('AbortError')) {
            timeoutDetected = true;
            console.log('[TIMEOUT]', text);
        }
        
        // Error detection
        if (text.includes('❌') || text.includes('Failed')) {
            console.log('[ERROR]', text);
        }
    });
    
    // Start download with extended timeout to accommodate the fix
    const downloadPromise = page.waitForEvent('download', { timeout: 180000 }); // 3 minutes
    await page.click('button:has-text("Download")');
    
    try {
        const download = await downloadPromise;
        const downloadPath = await download.path();
        
        console.log('Download completed, analyzing results...');
        
        if (downloadPath) {
            const stats = statSync(downloadPath);
            const pdfSize = stats.size;
            
            console.log(`PDF size: ${pdfSize} bytes`);
            console.log(`Total pages in manifest: ${totalPages}`);
            console.log(`Successful downloads: ${successfulDownloads}`);
            
            // Main assertion: PDF should not be 331 bytes (blank PDF)
            expect(pdfSize).not.toBe(331);
            
            // PDF should be reasonably large for a multi-page manuscript
            expect(pdfSize).toBeGreaterThan(50000); // At least 50KB
            
            // Manifest should have loaded successfully
            expect(manifestLoaded).toBe(true);
            
            // At least some pages should be larger than 0
            expect(totalPages).toBeGreaterThan(0);
            
            // Download should have started
            expect(downloadStarted).toBe(true);
            
            console.log('✅ University of Graz timeout fix test PASSED');
            console.log(`   - PDF size: ${pdfSize} bytes (not 331 blank PDF)`);
            console.log(`   - Pages processed: ${totalPages}`);
            console.log(`   - Timeout fix working: ${!timeoutDetected || pdfSize > 50000}`);
            
        } else {
            throw new Error('Download path not available');
        }
        
    } catch (error) {
        console.error('❌ Download test failed:', error);
        
        // If download timed out, this might indicate the fix isn't working
        if (error.message.includes('timeout')) {
            console.error('❌ Download timed out - timeout fix may not be working properly');
        }
        
        throw error;
    }
});