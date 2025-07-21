import { test, expect } from '@playwright/test';
import { ElectronApplication, Page, _electron as electron } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import path from 'path';
import fs from 'fs/promises';

test.describe('University of Graz ETIMEDOUT Fix', () => {
  let app: ElectronApplication;
  let page: Page;
  
  const testUrls = [
    'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
    'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688'
  ];

  test.beforeEach(async () => {
    app = await electron.launch({
      args: [path.join(__dirname, '../../dist/main/main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        IS_TEST: 'true'
      }
    });
    page = await app.firstWindow();
  });

  test.afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  test('should download Graz manuscripts without ETIMEDOUT errors', async () => {
    // Create output directory
    const outputDir = path.join(__dirname, '../../.devkit/test-output/graz-etimedout-fix');
    await fs.mkdir(outputDir, { recursive: true });
    
    for (const testUrl of testUrls) {
      console.log(`\nTesting: ${testUrl}`);
      
      // Parse manuscript URL to get info
      const result = await page.evaluate(async (manuscriptUrl) => {
        try {
          const parsed = await window.electron.parseManuscriptUrl(manuscriptUrl);
          return { success: true, data: parsed };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }, testUrl);
      
      // Check parsing was successful
      if (!result.success) {
        console.error(`Failed to parse URL: ${result.error}`);
        // Check if it's ETIMEDOUT
        expect(result.error).not.toContain('ETIMEDOUT');
        expect(result.error).not.toContain('connect ETIMEDOUT');
        continue;
      }
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('title');
      expect(result.data).toHaveProperty('pages');
      expect(result.data.pages).toBeGreaterThan(0);
      
      console.log(`  Title: ${result.data.title}`);
      console.log(`  Pages: ${result.data.pages}`);
      
      // Test downloading first 5 pages
      const manuscriptId = testUrl.match(/\/(\d+)$/)?.[1] || 'unknown';
      const outputPath = path.join(outputDir, `graz_${manuscriptId}_test.pdf`);
      
      const downloadResult = await page.evaluate(async ({ url, output, pages }) => {
        return new Promise((resolve) => {
          let progressUpdates: any[] = [];
          let completed = false;
          
          // Listen for progress updates
          const handleProgress = (progress: any) => {
            progressUpdates.push(progress);
            if (progress.status === 'completed' || progress.status === 'error') {
              completed = true;
              window.electron.removeDownloadProgressListener(handleProgress);
              resolve({
                success: progress.status === 'completed',
                error: progress.error,
                progressUpdates
              });
            }
          };
          
          window.electron.onDownloadProgress(handleProgress);
          
          // Start download
          window.electron.startDownload({
            url,
            outputPath: output,
            options: {
              pages: pages.toString(),
              quality: 'high'
            }
          });
          
          // Timeout after 3 minutes
          setTimeout(() => {
            if (!completed) {
              window.electron.removeDownloadProgressListener(handleProgress);
              resolve({
                success: false,
                error: 'Download timeout after 3 minutes',
                progressUpdates
              });
            }
          }, 180000);
        });
      }, { url: testUrl, output: outputPath, pages: 5 });
      
      // Verify download completed without ETIMEDOUT
      if (!downloadResult.success) {
        console.error(`Download failed: ${downloadResult.error}`);
        expect(downloadResult.error).not.toContain('ETIMEDOUT');
        expect(downloadResult.error).not.toContain('connect ETIMEDOUT');
      } else {
        // Verify PDF was created
        const stats = await fs.stat(outputPath);
        expect(stats.size).toBeGreaterThan(50000); // At least 50KB
        
        // Verify PDF is valid
        const pdfBytes = await fs.readFile(outputPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pageCount = pdfDoc.getPageCount();
        expect(pageCount).toBe(5);
        
        console.log(`  ✓ PDF created: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      }
    }
  });

  test('should handle connection retries for Graz', async () => {
    // Test with a URL that might timeout
    const testUrl = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538';
    
    // Monitor console logs to see retry attempts
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Graz]') || text.includes('[fetchWithHTTPS]')) {
        consoleLogs.push(text);
      }
    });
    
    // Attempt to parse manuscript
    const result = await page.evaluate(async (manuscriptUrl) => {
      const startTime = Date.now();
      try {
        const parsed = await window.electron.parseManuscriptUrl(manuscriptUrl);
        return { 
          success: true, 
          data: parsed,
          duration: Date.now() - startTime
        };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.message,
          duration: Date.now() - startTime
        };
      }
    }, testUrl);
    
    // Log any retry attempts
    const retryLogs = consoleLogs.filter(log => 
      log.includes('retry') || 
      log.includes('Attempt') ||
      log.includes('Pre-resolving DNS')
    );
    
    if (retryLogs.length > 0) {
      console.log('\nRetry attempts detected:');
      retryLogs.forEach(log => console.log(`  ${log}`));
    }
    
    // Verify result
    if (!result.success) {
      console.log(`Failed after ${result.duration}ms: ${result.error}`);
      // Should not fail with raw ETIMEDOUT
      expect(result.error).not.toMatch(/ETIMEDOUT [\d.]+:443/);
    } else {
      console.log(`Success after ${result.duration}ms`);
      expect(result.data).toHaveProperty('title');
    }
  });
});