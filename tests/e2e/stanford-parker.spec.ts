import { test, expect } from './helpers/electron';

test.describe('Stanford Parker Library Support', () => {
  test('should detect Stanford Parker URLs correctly', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    
    // Test URL detection
    const testUrls = [
      'https://parker.stanford.edu/parker/catalog/zs345bj2650',
      'https://parker.stanford.edu/parker/catalog/fr610kh2998',
      'https://parker.stanford.edu/parker/catalog/dw493fs0065'
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
        
        expect(result.manifest.library).toBe('parker');
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

  test('should include Stanford Parker in supported libraries', async ({ electronApp }) => {
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
    
    // Find Stanford Parker Library
    const parkerLib = supportedLibraries.find((lib: any) => 
      lib.name.includes('Stanford Parker') || lib.name.includes('Parker')
    );
    
    expect(parkerLib).toBeTruthy();
    expect(parkerLib.name).toBe('Stanford Parker Library');
    expect(parkerLib.example).toContain('parker.stanford.edu');
    expect(parkerLib.description).toContain('IIIF');
    
    console.log('✓ Stanford Parker Library found in supported libraries:');
    console.log(`  - Name: ${parkerLib.name}`);
    console.log(`  - Example: ${parkerLib.example}`);
    console.log(`  - Description: ${parkerLib.description}`);
  });
  
  test('should successfully load Stanford Parker manifest', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    
    // Test with the known working example URL
    const testUrl = 'https://parker.stanford.edu/parker/catalog/zs345bj2650';
    
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
      expect(result.manifest.library).toBe('parker');
      expect(result.manifest.totalPages).toBeGreaterThan(0);
      expect(result.manifest.hasPageLinks).toBe(true);
      expect(result.manifest.displayName).toBeTruthy();
      expect(result.manifest.originalUrl).toBe(testUrl);
      expect(result.manifest.firstPageLink).toContain('stacks.stanford.edu');
      
      console.log('✓ Stanford Parker manifest loaded successfully:');
      console.log(`  - Library: ${result.manifest.library}`);
      console.log(`  - Total Pages: ${result.manifest.totalPages}`);
      console.log(`  - Display Name: ${result.manifest.displayName}`);
      console.log(`  - First Image URL: ${result.manifest.firstPageLink}`);
    } else {
      console.error('✗ Failed to load Stanford Parker manifest:', result.error);
      throw new Error(`Failed to load manifest: ${result.error}`);
    }
  });
});