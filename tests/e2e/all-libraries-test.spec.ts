import { test, expect } from './helpers/electron';

test.describe('All Libraries Download Test', () => {
  let supportedLibraries: any[] = [];
  
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
    
    console.log(`Testing ${supportedLibraries.length} libraries`);
  });

  test('should test all supported libraries for download capability', async ({ page }) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const results: any[] = [];
    
    // Focus on major libraries first
    const priorityLibraries = [
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
    
    for (const libraryName of priorityLibraries) {
      const library = supportedLibraries.find(lib => lib.name === libraryName);
      if (!library) {
        console.log(`❌ ${libraryName}: Not found in supported libraries`);
        continue;
      }
      
      console.log(`\n=== Testing ${library.name} ===`);
      console.log(`URL: ${library.example}`);
      
      const result = {
        name: library.name,
        url: library.example,
        manifestLoaded: false,
        startButtonAvailable: false,
        downloadProgress: false,
        autoSplit: false,
        error: null
      };
      
      try {
        // Clear queue
        const deleteAllButton = page.locator('button:has-text("Delete All")');
        if (await deleteAllButton.isVisible() && await deleteAllButton.isEnabled()) {
          await deleteAllButton.click();
          await page.waitForTimeout(500);
          const confirmButton = page.locator('[data-testid="confirm-delete"]').first();
          if (await confirmButton.isVisible()) {
            await confirmButton.click();
            await page.waitForTimeout(1000);
          }
        }
        
        // Add manuscript
        const addMoreButton = page.locator('button:has-text("Add More Documents")');
        if (await addMoreButton.isVisible()) {
          await addMoreButton.click();
          await page.waitForTimeout(500);
        }
        
        const urlInput = page.locator('textarea').first();
        const addButton = page.locator('button').filter({ hasText: /Add|Submit/ }).first();
        
        if (await urlInput.isVisible()) {
          await urlInput.fill(library.example);
          if (await addButton.isVisible() && await addButton.isEnabled()) {
            await addButton.click();
          }
        }
        
        // Wait for manifest loading
        await page.waitForTimeout(3000);
        const queueItem = page.locator('[data-testid="queue-item"]').first();
        
        // Check manifest loading
        for (let attempt = 0; attempt < 15; attempt++) {
          await page.waitForTimeout(2000);
          
          const titleElement = queueItem.locator('strong');
          const currentTitle = await titleElement.textContent();
          
          if (currentTitle && !currentTitle.includes('Loading manifest')) {
            result.manifestLoaded = true;
            console.log(`✓ Manifest loaded: ${currentTitle}`);
            break;
          }
          
          // Check for failure
          const statusBadge = queueItem.locator('.status-badge');
          const status = await statusBadge.textContent();
          if (status?.toLowerCase().includes('failed')) {
            result.error = `Manifest failed: ${status}`;
            console.log(`❌ Manifest failed: ${status}`);
            break;
          }
        }
        
        if (!result.manifestLoaded && !result.error) {
          result.error = 'Manifest loading timeout';
          console.log(`❌ Manifest loading timeout`);
        }
        
        if (result.manifestLoaded) {
          // Try to start download
          const startButton = page.locator('button.start-btn, button:has-text("Resume Queue")').first();
          const isVisible = await startButton.isVisible();
          const isEnabled = await startButton.isEnabled();
          
          if (isVisible && isEnabled) {
            result.startButtonAvailable = true;
            await startButton.click();
            console.log(`✓ Started download`);
            
            // Check for auto-split and progress
            for (let check = 0; check < 8; check++) {
              await page.waitForTimeout(3000);
              
              // Check for auto-split indicators
              const titleElement = queueItem.locator('strong');
              const currentTitle = await titleElement.textContent();
              
              if (currentTitle && currentTitle.includes('Part_')) {
                result.autoSplit = true;
                console.log(`✓ Auto-split detected: ${currentTitle}`);
              }
              
              // Look for progress indicators
              const progressText = queueItem.locator('*').filter({ hasText: /\d+.*of.*\d+|\d+%|Downloading \d+/ });
              const hasProgress = await progressText.count() > 0;
              
              if (hasProgress) {
                const progressContent = await progressText.first().textContent();
                result.downloadProgress = true;
                console.log(`✓ Progress detected: ${progressContent}`);
                break;
              }
            }
            
            if (!result.downloadProgress) {
              result.error = 'No download progress detected';
              console.log(`❌ No download progress in 24 seconds`);
            }
            
          } else {
            result.error = `Start button not available (visible: ${isVisible}, enabled: ${isEnabled})`;
            console.log(`❌ Start button not available`);
          }
        }
        
      } catch (error: any) {
        result.error = error.message;
        console.log(`❌ Error: ${error.message}`);
      }
      
      results.push(result);
      
      // Take screenshot
      await page.screenshot({ 
        path: `test-results/${timestamp}-library-${library.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
        fullPage: true 
      });
    }
    
    // Print summary
    console.log('\n=== LIBRARY TEST SUMMARY ===');
    let working = 0;
    let total = 0;
    
    for (const result of results) {
      total++;
      const status = result.downloadProgress ? '✅ WORKING' : 
                    result.manifestLoaded ? '⚠️ MANIFEST OK' : 
                    '❌ FAILED';
      
      if (result.downloadProgress) working++;
      
      console.log(`${status} ${result.name}`);
      if (result.autoSplit) console.log(`  └─ 🔄 Auto-split active`);
      if (result.error) console.log(`  └─ ❌ ${result.error}`);
    }
    
    console.log(`\nRESULTS: ${working}/${total} libraries working`);
    
    // Save detailed results
    await page.evaluate((resultsData) => {
      console.log('DETAILED_RESULTS:', JSON.stringify(resultsData, null, 2));
    }, results);
  });
});