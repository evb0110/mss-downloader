import { test, expect } from './helpers/electron';

test.describe('Additional Libraries Testing', () => {
  test('test remaining supported libraries for complete coverage', async ({ page }) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Additional libraries from the full supported list
    const additionalLibraries = [
      { name: 'Unicatt (Ambrosiana)', url: 'https://digitallibrary.unicatt.it/veneranda/0b02da82800c3ea6' },
      { name: 'UGent Library', url: 'https://lib.ugent.be/viewer/archive.ugent.be%3A644DCADE-4FE7-11E9-9AC5-81E62282636C' },
      { name: 'Florus (BM Lyon)', url: 'https://florus.bm-lyon.fr/visualisation.php?cote=MS0425&vue=128' },
      { name: 'Dublin MIRA', url: 'https://www.mira.ie/105' },
      { name: 'IRHT (CNRS)', url: 'https://arca.irht.cnrs.fr/ark:/63955/md14nk323d72' },
    ];
    
    const results: any[] = [];
    
    console.log(`Testing ${additionalLibraries.length} additional libraries...`);
    
    for (let i = 0; i < additionalLibraries.length; i++) {
      const library = additionalLibraries[i];
      console.log(`\\n=== Testing ${library.name} (${i + 1}/${additionalLibraries.length}) ===`);
      console.log(`URL: ${library.url}`);
      
      const result = {
        name: library.name,
        url: library.url,
        manifestLoaded: false,
        manifestName: '',
        error: null
      };
      
      try {
        // Clear any existing items first
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
        
        // Add manuscript URL
        const addMoreButton = page.locator('button:has-text("Add More Documents")');
        if (await addMoreButton.isVisible()) {
          await addMoreButton.click();
          await page.waitForTimeout(500);
        }
        
        const urlInput = page.locator('textarea').first();
        const addButton = page.locator('button').filter({ hasText: /Add|Submit/ }).first();
        
        if (await urlInput.isVisible()) {
          await urlInput.fill(library.url);
          if (await addButton.isVisible() && await addButton.isEnabled()) {
            await addButton.click();
          }
        }
        
        // Wait for manifest loading
        console.log(`Waiting for ${library.name} manifest to load...`);
        const queueItem = page.locator('[data-testid="queue-item"]').first();
        
        for (let attempt = 0; attempt < 15; attempt++) {
          await page.waitForTimeout(3000);
          
          const titleElement = queueItem.locator('strong');
          const currentTitle = await titleElement.textContent();
          
          if (currentTitle && !currentTitle.includes('Loading manifest')) {
            result.manifestLoaded = true;
            result.manifestName = currentTitle;
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
          
          if (attempt % 5 === 0) {
            console.log(`  ... still loading (attempt ${attempt + 1}/15)`);
          }
        }
        
        if (!result.manifestLoaded && !result.error) {
          result.error = 'Manifest loading timeout (45 seconds)';
          console.log(`❌ Manifest loading timeout`);
        }
        
      } catch (error: any) {
        result.error = error.message;
        console.log(`❌ Error: ${error.message}`);
      }
      
      results.push(result);
      
      // Take screenshot
      await page.screenshot({ 
        path: `test-results/${timestamp}-additional-${library.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
        fullPage: true 
      });
    }
    
    // Print summary
    console.log('\\n=== ADDITIONAL LIBRARIES SUMMARY ===');
    let working = 0;
    let total = results.length;
    
    for (const result of results) {
      const status = result.manifestLoaded ? '✅ WORKING' : '❌ FAILED';
      
      if (result.manifestLoaded) working++;
      
      console.log(`${status} ${result.name}`);
      if (result.manifestName) console.log(`  └─ 📄 ${result.manifestName}`);
      if (result.error) console.log(`  └─ ❌ ${result.error}`);
    }
    
    console.log(`\\nRESULTS: ${working}/${total} additional libraries working`);
    console.log('\\nDETAILED_ADDITIONAL_RESULTS:', JSON.stringify(results, null, 2));
  });
});