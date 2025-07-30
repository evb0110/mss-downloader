
      const { app } = require('electron');
      const path = require('path');
      const fs = require('fs');
      
      // Import services
      const { ManuscriptDownloaderService } = require('./dist/main/services/ManuscriptDownloaderService.js');
      const { EnhancedManuscriptDownloaderService } = require('./dist/main/services/EnhancedManuscriptDownloaderService.js');
      const { ElectronPdfMerger } = require('./dist/main/services/ElectronPdfMerger.js');
      
      app.whenReady().then(async () => {
        try {
          console.log('Testing URL: https://gams.uni-graz.at/context:corema.a1');
          
          // Initialize services
          const pdfMerger = new ElectronPdfMerger();
          const basicService = new ManuscriptDownloaderService(pdfMerger);
          const enhancedService = new EnhancedManuscriptDownloaderService();
          
          // Try enhanced service first
          let manuscript;
          let service;
          
          try {
            manuscript = await enhancedService.parseManuscriptUrl('https://gams.uni-graz.at/context:corema.a1');
            service = enhancedService;
            console.log('Using EnhancedManuscriptDownloaderService');
          } catch (error) {
            console.log('Enhanced service failed, trying basic service:', error.message);
            try {
              manuscript = await basicService.parseManuscriptUrl('https://gams.uni-graz.at/context:corema.a1');
              service = basicService;
              console.log('Using ManuscriptDownloaderService');
            } catch (basicError) {
              throw new Error(`Both services failed: ${basicError.message}`);
            }
          }
          
          console.log('Manuscript loaded:', manuscript.title || 'Untitled');
          console.log('Total pages:', manuscript.pages);
          
          // Download test pages
          const outputPath = path.join('/Users/evb/WebstormProjects/mss-downloader/.devkit/validation-results/v1.4.49', 'graz_gams_test.pdf');
          const pagesToDownload = Math.min(10, manuscript.pages);
          
          console.log(`Downloading ${pagesToDownload} pages...`);
          
          await service.download(
            'https://gams.uni-graz.at/context:corema.a1',
            outputPath,
            {
              pages: `1-${pagesToDownload}`,
              quality: 'high'
            },
            {
              onProgress: (progress) => {
                if (progress.currentPage) {
                  console.log(`Progress: page ${progress.currentPage}/${progress.totalPages}`);
                }
              },
              onComplete: () => console.log('Download complete'),
              onError: (error) => console.error('Download error:', error.message)
            }
          );
          
          // Verify file exists
          const stats = fs.statSync(outputPath);
          console.log(`PDF created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
          
          process.exit(0);
        } catch (error) {
          console.error('Test failed:', error.message);
          process.exit(1);
        }
      });
    