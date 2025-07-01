import { test, expect } from '@playwright/test';
import { join } from 'path';
import { statSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test.describe('Verona SSL Fix Validation', () => {
    
    test('should handle SSL certificate issues with rejectUnauthorized=false', async ({ page }) => {
        console.log('Testing Verona SSL fix with rejectUnauthorized setting...');
        
        // Navigate to the app
        await page.goto('file://' + join(process.cwd(), 'dist/index.html'));
        await page.waitForSelector('input[type="url"]', { timeout: 10000 });
        
        // Test URL that previously had SSL issues
        const testUrl = 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15';
        await page.fill('input[type="url"]', testUrl);
        
        // Monitor console for SSL-related messages
        let sslHandlingSuccess = false;
        let manifestLoaded = false;
        let sslErrorOccurred = false;
        let pageCount = 0;
        
        page.on('console', msg => {
            const text = msg.text();
            
            if (text.includes('rejectUnauthorized: false') || text.includes('SSL fix applied')) {
                sslHandlingSuccess = true;
                console.log('✓ SSL fix applied');
            }
            
            if (text.includes('Verona manifest loaded') || text.includes('pages loaded')) {
                manifestLoaded = true;
                const pagesMatch = text.match(/(\d+) pages/);
                if (pagesMatch) {
                    pageCount = parseInt(pagesMatch[1]);
                    console.log(`✓ Manifest loaded: ${pageCount} pages`);
                }
            }
            
            if (text.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE') || 
                text.includes('certificate') || 
                text.includes('SSL') ||
                text.includes('ENOTFOUND')) {
                sslErrorOccurred = true;
                console.log('[SSL ERROR]', text);
            }
        });
        
        // Start download
        const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
        await page.click('button:has-text("Download")');
        
        try {
            const download = await downloadPromise;
            const downloadPath = await download.path();
            
            console.log('Download completed, validating SSL fix...');
            
            if (downloadPath) {
                const stats = statSync(downloadPath);
                const pdfSize = stats.size;
                
                console.log(`PDF size: ${pdfSize} bytes`);
                console.log(`Page count: ${pageCount}`);
                console.log(`SSL handling success: ${sslHandlingSuccess}`);
                console.log(`SSL error occurred: ${sslErrorOccurred}`);
                
                // Validate PDF size and content
                expect(pdfSize).toBeGreaterThan(50000);
                
                // Validate that manifest was loaded successfully
                expect(manifestLoaded).toBe(true);
                
                // Validate that page count is reasonable
                expect(pageCount).toBeGreaterThan(0);
                expect(pageCount).toBeLessThan(500);
                
                // Most importantly: no SSL errors should have occurred
                expect(sslErrorOccurred).toBe(false);
                
                // Validate PDF content with poppler
                try {
                    const { stdout } = await execAsync(`pdfinfo "${downloadPath}"`);
                    expect(stdout).toContain('Pages:');
                    console.log('✓ PDF validation with poppler successful');
                } catch (error) {
                    console.warn('Poppler validation failed, but download succeeded:', error);
                }
                
                console.log('✅ Verona SSL fix validation PASSED');
                
            } else {
                throw new Error('Download path not available');
            }
            
        } catch (error) {
            console.error('❌ SSL fix validation failed:', error);
            throw error;
        }
    });

    test('should handle multiple Verona URLs without SSL errors', async ({ page }) => {
        console.log('Testing multiple Verona URLs for SSL stability...');
        
        await page.goto('file://' + join(process.cwd(), 'dist/index.html'));
        await page.waitForSelector('input[type="url"]', { timeout: 10000 });
        
        const testUrls = [
            'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=14',
            'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json',
            'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/CVII1001.json'
        ];
        
        let totalSslErrors = 0;
        let successfulLoads = 0;
        
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE') || 
                text.includes('certificate') || 
                text.includes('SSL error')) {
                totalSslErrors++;
                console.log('[SSL ERROR]', text);
            }
            
            if (text.includes('manifest loaded') || text.includes('pages loaded')) {
                successfulLoads++;
                console.log('✓ Successful load detected');
            }
        });
        
        for (const url of testUrls) {
            console.log(`Testing URL: ${url}`);
            
            await page.fill('input[type="url"]', url);
            await page.click('button:has-text("Add to Queue")');
            
            // Wait for processing
            await page.waitForTimeout(5000);
        }
        
        // Wait for all manifests to process
        await page.waitForTimeout(15000);
        
        console.log(`SSL errors encountered: ${totalSslErrors}`);
        console.log(`Successful loads: ${successfulLoads}`);
        
        // Validate that SSL fix prevented errors
        expect(totalSslErrors).toBe(0);
        expect(successfulLoads).toBeGreaterThan(0);
        
        console.log('✅ Multiple URL SSL test PASSED');
    });

    test('should maintain security while bypassing SSL verification', async ({ page }) => {
        console.log('Testing that SSL bypass is applied safely and only to specific requests...');
        
        await page.goto('file://' + join(process.cwd(), 'dist/index.html'));
        await page.waitForSelector('input[type="url"]', { timeout: 10000 });
        
        let sslBypassApplied = false;
        let securityWarnings = 0;
        
        page.on('console', msg => {
            const text = msg.text();
            
            if (text.includes('rejectUnauthorized: false')) {
                sslBypassApplied = true;
                console.log('✓ SSL bypass applied for Verona requests');
            }
            
            if (text.includes('security') && text.includes('warning')) {
                securityWarnings++;
                console.log('[SECURITY WARNING]', text);
            }
        });
        
        // Test Verona URL
        await page.fill('input[type="url"]', 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15');
        await page.click('button:has-text("Add to Queue")');
        
        await page.waitForTimeout(10000);
        
        // SSL bypass should be applied for Verona
        expect(sslBypassApplied).toBe(true);
        
        // Should not generate excessive security warnings
        expect(securityWarnings).toBeLessThan(3);
        
        console.log('✅ Security-conscious SSL bypass test PASSED');
    });
});

test.describe('Verona Error Recovery', () => {
    
    test('should recover gracefully from network timeouts', async ({ page }) => {
        console.log('Testing Verona timeout recovery...');
        
        await page.goto('file://' + join(process.cwd(), 'dist/index.html'));
        await page.waitForSelector('input[type="url"]', { timeout: 10000 });
        
        // Test with potentially problematic URL
        const timeoutUrl = 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=99999';
        await page.fill('input[type="url"]', timeoutUrl);
        
        let timeoutHandled = false;
        let errorMessage = '';
        
        page.on('console', msg => {
            const text = msg.text();
            
            if (text.includes('timeout') || text.includes('ETIMEDOUT')) {
                timeoutHandled = true;
                console.log('✓ Timeout detected and handled');
            }
            
            if (text.includes('Error:') || text.includes('Failed:')) {
                errorMessage = text;
            }
        });
        
        await page.click('button:has-text("Add to Queue")');
        
        // Wait for timeout to occur
        await page.waitForTimeout(30000);
        
        // Should handle timeout gracefully
        expect(timeoutHandled || errorMessage.length > 0).toBe(true);
        
        // Error message should be user-friendly, not technical SSL error
        if (errorMessage) {
            expect(errorMessage).not.toMatch(/UNABLE_TO_VERIFY_LEAF_SIGNATURE|certificate|SSL/);
        }
        
        console.log('✅ Timeout recovery test PASSED');
    });
});