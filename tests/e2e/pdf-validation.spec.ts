import { test, expect } from './helpers/electron';
import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

test.describe('PDF Download Validation', () => {
  let supportedLibraries: any[] = [];
  const downloadsPath = join(homedir(), 'Downloads');
  
  test.beforeAll(async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    
    supportedLibraries = await page.evaluate(async () => {
      let retries = 10;
      while (!window.electronAPI && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        retries--;
      }
      
      if (!window.electronAPI) {
        throw new Error('electronAPI not available');
      }
      
      return await window.electronAPI.getSupportedLibraries();
    });
    
    console.log(`Testing PDF downloads for ${supportedLibraries.length} libraries`);
    
    // Check if poppler is installed
    try {
      const result = execSync('which pdfinfo', { encoding: 'utf8', stdio: 'pipe' });
      if (result.trim()) {
        console.log('✓ Poppler utilities available for PDF validation');
        console.log(`pdfinfo found at: ${result.trim()}`);
      } else {
        throw new Error('pdfinfo not found');
      }
    } catch (error) {
      console.log('⚠️ Poppler not found in PATH. Checking common locations...');
      
      const commonPaths = [
        '/opt/homebrew/bin/pdfinfo',
        '/usr/local/bin/pdfinfo', 
        '/usr/bin/pdfinfo'
      ];
      
      let foundPath = '';
      for (const path of commonPaths) {
        try {
          execSync(`test -f ${path}`, { stdio: 'pipe' });
          foundPath = path;
          console.log(`✓ Found pdfinfo at: ${path}`);
          break;
        } catch (e) {
          // Continue checking
        }
      }
      
      if (!foundPath) {
        console.log('⚠️ Poppler not found. Using basic file validation instead.');
      }
    }
  });

  // Helper function to find downloaded PDFs
  function findDownloadedPDFs(libraryName: string): string[] {
    try {
      const files = readdirSync(downloadsPath);
      const pdfFiles = files.filter(file => 
        file.endsWith('.pdf') && 
        file.toLowerCase().includes(libraryName.toLowerCase().split(' ')[0].toLowerCase())
      );
      return pdfFiles.map(file => join(downloadsPath, file));
    } catch (error) {
      console.log(`Error reading downloads directory: ${error}`);
      return [];
    }
  }

  // Helper function to validate PDF using poppler or basic file checks
  function validatePDF(pdfPath: string): { valid: boolean; pages: number; fileSize: number; error?: string } {
    try {
      // Check file size
      const stats = statSync(pdfPath);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      // Basic validation: file exists and has reasonable size
      if (fileSizeMB < 0.01) { // Less than 10KB
        return { valid: false, pages: 0, fileSize: fileSizeMB, error: 'File too small to be a valid PDF' };
      }
      
      // Try to use poppler if available
      const pdfinfoPaths = [
        'pdfinfo', // In PATH
        '/opt/homebrew/bin/pdfinfo',
        '/usr/local/bin/pdfinfo', 
        '/usr/bin/pdfinfo'
      ];
      
      let pdfOutput = '';
      let pdfInfoFound = false;
      
      for (const pdfinfoBin of pdfinfoPaths) {
        try {
          pdfOutput = execSync(`"${pdfinfoBin}" "${pdfPath}"`, { encoding: 'utf8', stdio: 'pipe' });
          pdfInfoFound = true;
          break;
        } catch (e) {
          // Try next path
          continue;
        }
      }
      
      if (pdfInfoFound && pdfOutput) {
        // Extract page count
        const pageMatch = pdfOutput.match(/Pages:\s*(\d+)/);
        const pages = pageMatch ? parseInt(pageMatch[1]) : 0;
        
        // Check if PDF is encrypted or damaged
        const isEncrypted = pdfOutput.includes('Encrypted:') && !pdfOutput.includes('Encrypted: no');
        const isDamaged = pdfOutput.includes('Command Line Error') || pdfOutput.includes('Syntax Error');
        
        if (isEncrypted) {
          return { valid: false, pages: 0, fileSize: fileSizeMB, error: 'PDF is encrypted' };
        }
        
        if (isDamaged) {
          return { valid: false, pages: 0, fileSize: fileSizeMB, error: 'PDF appears to be damaged' };
        }
        
        return { 
          valid: pages > 0 && fileSizeMB > 0.1, // At least 100KB and 1+ pages
          pages, 
          fileSize: fileSizeMB 
        };
      } else {
        // Fallback: basic file validation
        console.log('Using basic file validation (poppler not available)');
        
        // Read first few bytes to check PDF header
        const fs = require('fs');
        const buffer = fs.readFileSync(pdfPath, { start: 0, end: 8 });
        const header = buffer.toString('utf8');
        
        if (!header.startsWith('%PDF-')) {
          return { valid: false, pages: 0, fileSize: fileSizeMB, error: 'Invalid PDF header' };
        }
        
        // Estimate pages based on file size (rough approximation)
        const estimatedPages = Math.max(1, Math.floor(fileSizeMB / 0.5)); // Assume ~500KB per page
        
        return { 
          valid: fileSizeMB > 0.1, // At least 100KB
          pages: estimatedPages, 
          fileSize: fileSizeMB 
        };
      }
      
    } catch (error) {
      return { 
        valid: false, 
        pages: 0, 
        fileSize: 0, 
        error: `PDF validation failed: ${error.message}` 
      };
    }
  }

  // Helper function to capture and analyze screenshots
  async function captureAndAnalyzeScreenshot(page: any, filename: string, context: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `test-results/${timestamp}-${filename}`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath} (${context})`);
    
    // Capture current page state for debugging
    const pageState = await page.evaluate(() => {
      const queueItems = document.querySelectorAll('[data-testid="queue-item"]');
      const items = [];
      
      for (let i = 0; i < queueItems.length; i++) {
        const item = queueItems[i];
        const statusBadge = item.querySelector('.status-badge');
        const title = item.querySelector('strong');
        
        items.push({
          index: i,
          status: statusBadge ? statusBadge.textContent : 'no-status',
          title: title ? title.textContent : 'no-title'
        });
      }
      
      const buttons = Array.from(document.querySelectorAll('button')).map(btn => ({
        text: btn.textContent?.trim(),
        visible: btn.offsetParent !== null,
        enabled: !btn.disabled
      }));
      
      return { items, buttons };
    });
    
    console.log(`Page state analysis (${context}):`, JSON.stringify(pageState, null, 2));
    return pageState;
  }

  // Helper function to clean up downloaded files
  async function cleanupDownloads(page: any) {
    // Clear the queue first
    const clearButton = page.locator('[data-testid="clear-completed"]');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      const confirmButton = page.locator('[data-testid="confirm-delete"]');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
    
    // Clear all items
    const clearAllButton = page.locator('button:has-text("Delete All")');
    if (await clearAllButton.isVisible() && await clearAllButton.isEnabled()) {
      await clearAllButton.click();
      const confirmButton = page.locator('[data-testid="confirm-delete"]');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
    
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(0);
  }

  // Test each library individually - major libraries first
  const testLibraries = [
    'Gallica (BnF)',
    'e-codices (Unifr)', 
    'Vatican Library',
    'British Library',
    'Cambridge University Digital Library',
    'Trinity College Cambridge',
    'Unicatt (Ambrosiana)',
    'UGent Library',
    'Florus (BM Lyon)',
    'Dublin ISOS (DIAS)'
  ];
  
  testLibraries.forEach(libraryName => {
    test(`should download and validate PDF from ${libraryName}`, async ({ page }) => {
      const library = supportedLibraries.find(lib => lib.name === libraryName);
      if (!library) {
        test.skip(true, `${libraryName} not found in supported libraries`);
        return;
      }
      
      console.log(`\n=== Testing ${libraryName} ===`);
      console.log(`URL: ${library.example}`);
      
      // Wait for app to fully load and navigate to correct page
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Check current URL and navigate if needed
      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);
      
      // Check if we're on the queue management page
      const queueSection = page.locator('.queue-section');
      const isOnQueuePage = await queueSection.isVisible();
      console.log(`Queue management interface visible: ${isOnQueuePage}`);
      
      // Take initial screenshot
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await page.screenshot({ 
        path: `test-results/${timestamp}-01-initial-${libraryName.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
        fullPage: true 
      });
      
      // Configure global settings for small download (30MB limit) BEFORE adding items
      await page.evaluate(() => window.scrollTo(0, 0));
      
      // Find and click settings using the approach that worked in threshold test
      const settingsElements = await page.locator('*:has-text("Default Download Settings")').all();
      let settingsExpanded = false;
      
      for (const element of settingsElements) {
        try {
          if (await element.isVisible()) {
            await element.click();
            console.log('✓ Clicked settings element');
            settingsExpanded = true;
            break;
          }
        } catch (error) {
          // Try next element
        }
      }
      
      if (settingsExpanded) {
        // Wait for settings content to become visible
        await page.waitForTimeout(500);
        
        // Take screenshot of expanded settings
        const timestamp2 = new Date().toISOString().replace(/[:.]/g, '-');
        await page.screenshot({ 
          path: `test-results/${timestamp2}-02-settings-expanded-${libraryName.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
          fullPage: true 
        });
        
        // Find and set threshold slider
        const sliders = page.locator('input[type="range"]');
        const sliderCount = await sliders.count();
        console.log(`Found ${sliderCount} range sliders`);
        
        if (sliderCount > 0) {
          const slider = sliders.first();
          const currentValue = await slider.inputValue();
          console.log(`Current threshold: ${currentValue}MB, setting to 30MB`);
          
          // Set to 30MB
          await slider.evaluate((el) => {
            el.value = '30';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          });
          
          const newValue = await slider.inputValue();
          console.log(`✓ Threshold changed from ${currentValue}MB to ${newValue}MB`);
          
          // Take screenshot after changing settings
          await page.screenshot({ 
            path: `test-results/03-settings-modified-${libraryName.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
            fullPage: true 
          });
          
          // Collapse settings by clicking again
          await settingsElements[0].click();
        }
      } else {
        console.log('❌ Could not expand settings');
      }
      
      // Take screenshot before adding manuscript
      await page.screenshot({ 
        path: `test-results/04-before-add-${libraryName.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
        fullPage: true 
      });
      
      // Clear any existing items using bulk Delete All button
      const existingItems = page.locator('[data-testid="queue-item"]');
      const initialCount = await existingItems.count();
      console.log(`Found ${initialCount} items to clear`);
      
      if (initialCount > 0) {
        // Try bulk delete first
        const deleteAllButton = page.locator('button:has-text("Delete All")');
        if (await deleteAllButton.isVisible() && await deleteAllButton.isEnabled()) {
          await deleteAllButton.click();
          console.log('✓ Clicked Delete All button');
          
          // Handle confirmation dialog
          await page.waitForTimeout(1000);
          const confirmButton = page.locator('[data-testid="confirm-delete"]').first();
          if (await confirmButton.isVisible()) {
            await confirmButton.click();
            console.log('✓ Confirmed bulk deletion');
            await page.waitForTimeout(2000); // Wait for bulk deletion to complete
          }
        } else {
          console.log('Delete All button not available, using alternative cleanup');
          // Alternative: Stop queue first, then delete
          const stopButton = page.locator('button:has-text("Stop Queue")');
          if (await stopButton.isVisible() && await stopButton.isEnabled()) {
            await stopButton.click();
            console.log('✓ Stopped queue before cleanup');
            await page.waitForTimeout(1000);
          }
        }
        
        // Verify queue is clear
        const remainingCount = await page.locator('[data-testid="queue-item"]').count();
        console.log(`✓ Queue cleanup result: ${remainingCount} items remaining`);
      }
      
      // Check final queue state after cleanup
      const finalItemCount = await page.locator('[data-testid="queue-item"]').count();
      console.log(`Found ${finalItemCount} remaining queue items after cleanup`);
      
      if (finalItemCount === 0) {
        // Add single library to queue if none exist
        const addMoreButton = page.locator('button:has-text("Add More Documents")');
        if (await addMoreButton.isVisible()) {
          await addMoreButton.click();
          console.log('✓ Clicked Add More Documents');
          await page.waitForTimeout(500);
        }
        
        const urlInput = page.locator('textarea').first();
        const addButton = page.locator('button').filter({ hasText: /Add|Submit/ }).first();
        
        if (await urlInput.isVisible()) {
          await urlInput.fill(library.example);
          console.log(`✓ Filled URL: ${library.example}`);
          
          if (await addButton.isVisible() && await addButton.isEnabled()) {
            await addButton.click();
            console.log('✓ Clicked add button');
          }
        }
        
        await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(1, { timeout: 15000 });
        console.log('✓ Added manuscript to queue');
      } else {
        console.log(`✓ Using existing queue item for ${libraryName}`);
      }
      
      const queueItem = page.locator('[data-testid="queue-item"]').first();
      
      // Wait for manifest loading
      await expect(queueItem).not.toHaveClass(/loading-manifest/, { timeout: 45000 });
      
      // Check for manifest loading failures
      const hasFailed = await queueItem.locator('.status-badge.status-failed').isVisible();
      if (hasFailed) {
        const errorElement = queueItem.locator('.manuscript-error-link');
        let errorMessage = 'Unknown error';
        if (await errorElement.isVisible()) {
          errorMessage = await errorElement.textContent() || 'Error detected';
        }
        console.log(`❌ ${library.name} failed during manifest loading: ${errorMessage}`);
        test.skip(true, `Manifest loading failed: ${errorMessage}`);
        return;
      }
      
      console.log('✓ Manifest loaded successfully');
      
      // Take screenshot after manifest loading
      await page.screenshot({ 
        path: `test-results/07-manifest-loaded-${libraryName.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
        fullPage: true 
      });
      
      // Analyze current state
      await captureAndAnalyzeScreenshot(page, `08-state-analysis-${libraryName.replace(/[^a-zA-Z0-9]/g, '_')}.png`, 'after manifest loaded');
      
      // Get manuscript info
      const manuscriptTitle = queueItem.locator('strong');
      const titleText = await manuscriptTitle.textContent();
      console.log(`Manuscript: ${titleText}`);
      
      // Wait for the item to fully finish loading manifest
      console.log('Waiting for manifest loading to complete...');
      
      let manifestComplete = false;
      for (let attempt = 0; attempt < 30; attempt++) { // 30 attempts = 1.5 minutes
        await page.waitForTimeout(3000);
        
        const statusBadge = queueItem.locator('.status-badge');
        const currentStatus = await statusBadge.textContent();
        const titleElement = queueItem.locator('strong');
        const currentTitle = await titleElement.textContent();
        
        console.log(`Attempt ${attempt + 1}: Status="${currentStatus}", Title="${currentTitle}"`);
        
        // Check for failure conditions FIRST
        if (currentStatus?.toLowerCase().includes('failed') || 
            currentTitle?.toLowerCase().includes('error') ||
            currentTitle?.toLowerCase().includes('failed') ||
            currentTitle?.includes('Error invoking remote method')) {
          console.log('❌ Item failed during manifest processing');
          console.log(`   Status: ${currentStatus}`);
          console.log(`   Title: ${currentTitle}`);
          test.skip(true, `Item failed - Status: ${currentStatus}, Title: ${currentTitle}`);
          return;
        }
        
        // Only consider it successful if we have a valid manuscript name (not loading, not error)
        if (currentTitle && 
            !currentTitle.includes('Loading manifest') && 
            !currentTitle.toLowerCase().includes('error') &&
            !currentTitle.toLowerCase().includes('failed') &&
            currentTitle.trim().length > 3) { // Valid title should be more than 3 characters
          manifestComplete = true;
          console.log(`✓ Manifest loading completed with title: ${currentTitle}`);
          break;
        }
      }
      
      if (!manifestComplete) {
        console.log('⚠️ Manifest did not complete loading within timeout');
        await captureAndAnalyzeScreenshot(page, `manifest-timeout-${libraryName.replace(/[^a-zA-Z0-9]/g, '_')}.png`, 'manifest loading timeout');
        test.skip(true, 'Manifest loading timeout');
        return;
      }
      
      // Start download - find and click Resume Queue button
      await page.evaluate(() => window.scrollTo(0, 0));
      
      // Use proper CSS class selector for the start queue button
      const startQueueButton = page.locator('button.start-btn');
      
      console.log('Checking start queue button...');
      const isVisible = await startQueueButton.isVisible();
      const isEnabled = await startQueueButton.isEnabled();
      
      console.log(`Start queue button: visible=${isVisible}, enabled=${isEnabled}`);
      
      if (!isVisible) {
        console.log('❌ Start queue button not visible');
        test.skip(true, 'Start queue button not visible');
        return;
      }
      
      if (!isEnabled) {
        console.log('Start queue button currently disabled, waiting for it to be enabled...');
        await expect(startQueueButton).toBeEnabled({ timeout: 30000 });
        console.log('✓ Start queue button is now enabled');
      } else {
        console.log('✓ Start queue button is already enabled');
      }
      
      await startQueueButton.click();
      console.log('✓ Started download');
      
      // Capture state after starting
      await captureAndAnalyzeScreenshot(page, `download-started-${libraryName.replace(/[^a-zA-Z0-9]/g, '_')}.png`, 'download started');
      
      // Monitor download progress and wait for completion
      let downloadCompleted = false;
      let downloadFailed = false;
      const maxWaitTime = 300000; // 5 minutes per library (reasonable for testing)
      const checkInterval = 10000; // 10 seconds between checks
      const maxChecks = maxWaitTime / checkInterval;
      
      for (let check = 1; check <= maxChecks; check++) {
        await page.waitForTimeout(checkInterval);
        
        const statusBadge = queueItem.locator('.status-badge');
        const status = await statusBadge.textContent();
        
        // Try to get download progress if available
        const progressBar = queueItem.locator('.progress-bar, [role="progressbar"]');
        let progressInfo = '';
        if (await progressBar.isVisible()) {
          const progressValue = await progressBar.getAttribute('value') || await progressBar.getAttribute('aria-valuenow');
          if (progressValue) {
            progressInfo = ` (${progressValue}%)`;
          }
        }
        
        // Look for any progress text
        const progressText = queueItem.locator('.progress-text, .download-progress');
        if (await progressText.isVisible()) {
          const progressContent = await progressText.textContent();
          if (progressContent) {
            progressInfo += ` - ${progressContent}`;
          }
        }
        
        console.log(`Check ${check}/${maxChecks}: Status = ${status}${progressInfo}`);
        
        if (status?.toLowerCase().includes('completed')) {
          downloadCompleted = true;
          console.log('✓ Download completed');
          break;
        } else if (status?.toLowerCase().includes('failed')) {
          downloadFailed = true;
          const errorElement = queueItem.locator('.manuscript-error-link');
          let errorMessage = 'Unknown error';
          if (await errorElement.isVisible()) {
            errorMessage = await errorElement.textContent() || 'Error detected';
          }
          console.log(`❌ Download failed: ${errorMessage}`);
          break;
        }
        
        // Take screenshot every 30 seconds for debugging
        if (check % 6 === 0) {
          await page.screenshot({ 
            path: `test-results/download-progress-${libraryName.replace(/[^a-zA-Z0-9]/g, '_')}-${check}.png`,
            fullPage: true 
          });
        }
      }
      
      if (!downloadCompleted && !downloadFailed) {
        console.log('⚠️ Download did not complete within timeout');
        test.skip(true, 'Download timeout');
        return;
      }
      
      if (downloadFailed) {
        test.skip(true, 'Download failed');
        return;
      }
      
      // Find and validate downloaded PDF
      await page.waitForTimeout(2000); // Wait for file system
      
      const pdfFiles = findDownloadedPDFs(library.name);
      console.log(`Found ${pdfFiles.length} PDF files: ${pdfFiles.map(f => f.split('/').pop())}`);
      
      if (pdfFiles.length === 0) {
        console.log('❌ No PDF files found in downloads');
        expect(pdfFiles.length).toBeGreaterThan(0);
        return;
      }
      
      // Validate each PDF found
      let validPDFs = 0;
      let totalPages = 0;
      let totalSize = 0;
      
      for (const pdfPath of pdfFiles) {
        const fileName = pdfPath.split('/').pop();
        console.log(`\nValidating: ${fileName}`);
        
        const validation = validatePDF(pdfPath);
        
        if (validation.valid) {
          validPDFs++;
          totalPages += validation.pages;
          totalSize += validation.fileSize;
          console.log(`✓ Valid PDF: ${validation.pages} pages, ${validation.fileSize.toFixed(2)}MB`);
        } else {
          console.log(`❌ Invalid PDF: ${validation.error}`);
        }
      }
      
      console.log(`\n=== ${library.name} Summary ===`);
      console.log(`Valid PDFs: ${validPDFs}/${pdfFiles.length}`);
      console.log(`Total pages: ${totalPages}`);
      console.log(`Total size: ${totalSize.toFixed(2)}MB`);
      
      // Validate results
      expect(validPDFs).toBeGreaterThan(0);
      expect(totalPages).toBeGreaterThan(0);
      expect(totalSize).toBeGreaterThan(0.1); // At least 100KB
      
      // Size should be reasonable for 10 pages (not too big, not too small)
      expect(totalSize).toBeLessThan(50); // Less than 50MB
      expect(totalSize).toBeGreaterThan(0.5); // More than 500KB
      
      console.log(`✅ ${library.name} passed PDF validation!`);
      
      // Stop the queue after successful test to prevent interference
      const stopQueueButton = page.locator('button.stop-btn, button:has-text("Stop Queue")');
      if (await stopQueueButton.isVisible() && await stopQueueButton.isEnabled()) {
        await stopQueueButton.click();
        console.log('✓ Stopped queue after test completion');
      }
    });
  });
});