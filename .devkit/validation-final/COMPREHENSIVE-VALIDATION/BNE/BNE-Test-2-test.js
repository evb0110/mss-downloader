
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  try {
    const { EnhancedManuscriptDownloaderService } = await import('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/src/main/services/EnhancedManuscriptDownloaderService.js');
    const { EnhancedPdfMerger } = await import('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/src/main/services/EnhancedPdfMerger.js');
    const { ElectronImageCache } = await import('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/src/main/services/ElectronImageCache.js');
    
    const downloader = new EnhancedManuscriptDownloaderService();
    const pdfMerger = new EnhancedPdfMerger();
    const imageCache = new ElectronImageCache();
    
    console.log('Loading manifest for: https://bdh.bne.es/bnesearch/detalle/004677');
    const manifest = await downloader.loadManifest('https://bdh.bne.es/bnesearch/detalle/004677');
    
    if (!manifest || !manifest.pages || manifest.pages.length === 0) {
      throw new Error('No pages found in manifest');
    }
    
    console.log(`Found ${manifest.pages.length} pages`);
    
    // Test maximum resolution for first few pages
    const testPages = manifest.pages.slice(0, Math.min(10, manifest.pages.length));
    const resolutions = ['full/full', 'full/max', 'full/4000,', 'full/2000,', 'full/1000,'];
    let bestResolution = 'full/full';
    let maxFileSize = 0;
    
    for (const resolution of resolutions) {
      try {
        const testUrl = manifest.pages[0].imageUrl.replace(/\/full\/[^/]+\//, `/full/${resolution}/`);
        console.log(`Testing resolution: ${resolution}`);
        
        const response = await fetch(testUrl);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          if (buffer.byteLength > maxFileSize) {
            maxFileSize = buffer.byteLength;
            bestResolution = resolution;
          }
          console.log(`Resolution ${resolution}: ${buffer.byteLength} bytes`);
        }
      } catch (error) {
        console.log(`Resolution ${resolution} failed: ${error.message}`);
      }
    }
    
    console.log(`Best resolution found: ${bestResolution} (${maxFileSize} bytes)`);
    
    // Download pages with best resolution
    const downloadedImages = [];
    for (let i = 0; i < testPages.length; i++) {
      const page = testPages[i];
      const imageUrl = page.imageUrl.replace(/\/full\/[^/]+\//, `/full/${bestResolution}/`);
      
      console.log(`Downloading page ${i + 1}/${testPages.length}`);
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download page ${i + 1}: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength < 1024) {
        throw new Error(`Page ${i + 1} too small: ${buffer.byteLength} bytes`);
      }
      
      const imagePath = path.join('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/validation-final/COMPREHENSIVE-VALIDATION/BNE', `${testName}-page-${i + 1}.jpg`);
      require('fs').writeFileSync(imagePath, Buffer.from(buffer));
      downloadedImages.push(imagePath);
    }
    
    // Create PDF
    const pdfPath = path.join('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/validation-final/COMPREHENSIVE-VALIDATION/BNE', `${testName}-VALIDATION.pdf`);
    await pdfMerger.mergeImagesToPdf(downloadedImages, pdfPath, {
      title: `BNE Validation - ${manifest.title || 'Unknown'}`,
      metadata: {
        subject: 'BNE Library Validation Test',
        creator: 'MSS Downloader Validation Protocol'
      }
    });
    
    // Get PDF stats
    const pdfStats = require('fs').statSync(pdfPath);
    
    console.log(JSON.stringify({
      success: true,
      testName: 'BNE-Test-2',
      pdfPath,
      pageCount: testPages.length,
      fileSize: pdfStats.size,
      maxResolution: bestResolution,
      maxFileSize
    }));
    
    app.quit();
    
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }));
    app.quit(1);
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
