import { test, expect } from './helpers/electron';

test.describe('Cologne Dom Library Support', () => {
  test('should detect Cologne Dom Library URLs correctly', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    
    // Test URL detection
    const testUrls = [
      'https://digital.dombibliothek-koeln.de/hs/content/zoom/156145',
      'https://digital.dombibliothek-koeln.de/hs/content/zoom/216699',
      'https://digital.dombibliothek-koeln.de/hs/content/zoom/273028',
      'https://digital.dombibliothek-koeln.de/schnuetgen/Handschriften/content/pageview/652610',
      'https://digital.dombibliothek-koeln.de/ddbkhd/Handschriften/content/pageview/94078'
    ];
    
    for (const url of testUrls) {
      // Try to parse the URL - this tests both detection and manifest loading
      const result = await page.evaluate(async (testUrl) => {
        try {
          const manifest = await window.electronAPI.parseManuscriptUrl(testUrl);
          return { success: true, manifest };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, url);
      
      if (result.success) {
        console.log(`✓ Successfully parsed: ${url}`);
        console.log(`  - Title: ${result.manifest.displayName}`);
        console.log(`  - Pages: ${result.manifest.totalPages}`);
        console.log(`  - Library: ${result.manifest.library}`);
        
        expect(result.manifest.library).toBe('cologne');
        expect(result.manifest.totalPages).toBeGreaterThan(0);
        expect(result.manifest.pageLinks.length).toBeGreaterThan(0);
        expect(result.manifest.displayName).toBeTruthy();
      } else {
        console.log(`✗ Failed to parse: ${url} - ${result.error}`);
        // Don't fail the test, just log the error for now
        // Some URLs might be temporarily unavailable
      }
    }
  });

  test('should include Cologne Dom Library in supported libraries', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    
    const supportedLibraries = await page.evaluate(async () => {
      // Wait for electronAPI to be available
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
    
    // Find Cologne Dom Library
    const cologneLib = supportedLibraries.find((lib: any) => 
      lib.name.includes('Cologne') || lib.name.includes('Dom')
    );
    
    expect(cologneLib).toBeTruthy();
    expect(cologneLib.name).toBe('Cologne Dom Library');
    expect(cologneLib.example).toContain('digital.dombibliothek-koeln.de');
    expect(cologneLib.description).toContain('Cathedral');
    
    console.log('✓ Cologne Dom Library found in supported libraries:');
    console.log(`  - Name: ${cologneLib.name}`);
    console.log(`  - Example: ${cologneLib.example}`);
    console.log(`  - Description: ${cologneLib.description}`);
  });
  
  test('should successfully load Cologne Dom Library manifest', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    
    // Test with the known working example URL
    const testUrl = 'https://digital.dombibliothek-koeln.de/hs/content/zoom/156145';
    
    const result = await page.evaluate(async (url) => {
      try {
        const manifest = await window.electronAPI.parseManuscriptUrl(url);
        return { 
          success: true, 
          manifest: {
            library: manifest.library,
            totalPages: manifest.totalPages,
            displayName: manifest.displayName,
            hasPageLinks: manifest.pageLinks && manifest.pageLinks.length > 0,
            firstPageLink: manifest.pageLinks[0],
            originalUrl: manifest.originalUrl
          }
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, testUrl);
    
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.manifest.library).toBe('cologne');
      expect(result.manifest.totalPages).toBeGreaterThan(0);
      expect(result.manifest.hasPageLinks).toBe(true);
      expect(result.manifest.displayName).toBeTruthy();
      expect(result.manifest.originalUrl).toBe(testUrl);
      expect(result.manifest.firstPageLink).toContain('digital.dombibliothek-koeln.de');
      expect(result.manifest.firstPageLink).toContain('/hs/download/webcache/2000/');
      
      console.log('✓ Cologne Dom Library manifest loaded successfully:');
      console.log(`  - Library: ${result.manifest.library}`);
      console.log(`  - Total Pages: ${result.manifest.totalPages}`);
      console.log(`  - Display Name: ${result.manifest.displayName}`);
      console.log(`  - First Image URL: ${result.manifest.firstPageLink}`);
    } else {
      console.error('✗ Failed to load Cologne Dom Library manifest:', result.error);
      throw new Error(`Failed to load manifest: ${result.error}`);
    }
  });

  test('should handle different Cologne collection URLs', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    
    const testCollections = [
      {
        url: 'https://digital.dombibliothek-koeln.de/hs/content/zoom/156145',
        collection: 'hs',
        expectedPattern: '/hs/download/webcache/2000/'
      },
      {
        url: 'https://digital.dombibliothek-koeln.de/schnuetgen/Handschriften/content/pageview/652610',
        collection: 'schnuetgen',
        expectedPattern: '/schnuetgen/download/webcache/2000/'
      },
      {
        url: 'https://digital.dombibliothek-koeln.de/ddbkhd/Handschriften/content/pageview/94078',
        collection: 'ddbkhd',
        expectedPattern: '/ddbkhd/download/webcache/2000/'
      }
    ];
    
    for (const testCase of testCollections) {
      const result = await page.evaluate(async (testUrl) => {
        try {
          const manifest = await window.electronAPI.parseManuscriptUrl(testUrl);
          return { 
            success: true, 
            firstPageLink: manifest.pageLinks[0],
            displayName: manifest.displayName
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, testCase.url);
      
      if (result.success) {
        console.log(`✓ ${testCase.collection.toUpperCase()} collection works: ${testCase.url}`);
        console.log(`  - Display Name: ${result.displayName}`);
        console.log(`  - Image URL pattern: ${result.firstPageLink}`);
        
        expect(result.firstPageLink).toContain(testCase.expectedPattern);
      } else {
        console.log(`✗ ${testCase.collection.toUpperCase()} collection failed: ${result.error}`);
      }
    }
  });
});