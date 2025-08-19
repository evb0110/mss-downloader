import { test, expect } from './helpers/electron';

test.describe('Library Manifest Testing', () => {
  test('test manifest loading for all major libraries', async ({ page }) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Priority libraries to test (using correct URL formats from library examples)
    const testLibraries = [
      { name: 'Gallica (BnF)', url: 'https://gallica.bnf.fr/ark:/12148/btv1b8449691v/f1.highres' },
      { name: 'e-codices (Unifr)', url: 'https://www.e-codices.ch/en/sbe/0610/1' },
      { name: 'Vatican Library', url: 'https://digi.vatlib.it/view/MSS_Vat.lat.3225' },
      { name: 'British Library', url: 'https://bl.digirati.io/iiif/ark:/81055/vdc_100055984026.0x000001' },
      { name: 'Cambridge University Digital Library', url: 'https://cudl.lib.cam.ac.uk/view/MS-II-00006-00032/1' },
      { name: 'Trinity College Cambridge', url: 'https://mss-cat.trin.cam.ac.uk/Manuscript/B.10.5/UV' },
      { name: 'Dublin ISOS (DIAS)', url: 'https://www.isos.dias.ie/RIA/RIA_MS_D_ii_3.html' },
      { name: 'ARCA (IRHT Digital Archives)', url: 'https://arca.irht.cnrs.fr/ark:/63955/fykkvnm8wkpd' },
    ];
    
    const results: any[] = [];
    
    console.log(`Starting manifest testing for ${testLibraries.length} libraries...`);
    
    for (let i = 0; i < testLibraries.length; i++) {
      const library = testLibraries[i];
      console.log(`\\n=== Testing ${library.name} (${i + 1}/${testLibraries.length}) ===`);
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
        
        // Wait for manifest loading with longer timeout
        console.log(`Waiting for ${library.name} manifest to load...`);
        const queueItem = page.locator('[data-testid="queue-item"]').first();
        
        for (let attempt = 0; attempt < 20; attempt++) {
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
            console.log(`  ... still loading (attempt ${attempt + 1}/20)`);
          }
        }
        
        if (!result.manifestLoaded && !result.error) {
          result.error = 'Manifest loading timeout (60 seconds)';
          console.log(`❌ Manifest loading timeout`);
        }
        
      } catch (error: any) {
        result.error = error.message;
        console.log(`❌ Error: ${error.message}`);
      }
      
      results.push(result);
      
      // Take screenshot for this library
      await page.screenshot({ 
        path: `test-results/${timestamp}-manifest-${library.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
        fullPage: true 
      });
    }
    
    // Print comprehensive summary
    console.log('\\n=== MANIFEST LOADING SUMMARY ===');
    let working = 0;
    let total = results.length;
    
    for (const result of results) {
      total++;
      const status = result.manifestLoaded ? '✅ WORKING' : '❌ FAILED';
      
      if (result.manifestLoaded) working++;
      
      console.log(`${status} ${result.name}`);
      if (result.manifestName) console.log(`  └─ 📄 ${result.manifestName}`);
      if (result.error) console.log(`  └─ ❌ ${result.error}`);
    }
    
    console.log(`\\nRESULTS: ${working}/${total} libraries successfully loading manifests`);
    
    // Save detailed results to console
    console.log('\\nDETAILED_MANIFEST_RESULTS:', JSON.stringify(results, null, 2));
  });
});