
const { app } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
    try {
        // Import the service after Electron is ready
        const { EnhancedManuscriptDownloaderService } = require('./dist/main/services/EnhancedManuscriptDownloaderService.js');
        const { promises: fs } = require('fs');
        
        const service = new EnhancedManuscriptDownloaderService();
        const testUrl = 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15';
        
        console.log('Testing URL:', testUrl);
        const startTime = Date.now();
        
        // Test manifest loading
        const manifest = await service.loadManuscript(testUrl);
        const loadTime = Date.now() - startTime;
        
        console.log('\n✅ Manifest loaded successfully!');
        console.log('   Load time:', loadTime + 'ms');
        console.log('   Title:', manifest.displayName);
        console.log('   Pages:', manifest.totalPages);
        console.log('   Library:', manifest.library);
        
        // Test downloading first page
        if (manifest.pageLinks && manifest.pageLinks.length > 0) {
            console.log('\nTesting first page download...');
            const pageStartTime = Date.now();
            const imageData = await service.downloadImage(manifest.pageLinks[0], manifest.library);
            const downloadTime = Date.now() - pageStartTime;
            
            console.log('✅ First page downloaded successfully!');
            console.log('   Download time:', downloadTime + 'ms');
            console.log('   Image size:', (imageData.length / 1024).toFixed(2) + ' KB');
            
            // Save test image
            const outputDir = path.join(__dirname, '.devkit/test-output');
            await fs.mkdir(outputDir, { recursive: true });
            const outputPath = path.join(outputDir, 'verona-test-page.jpg');
            await fs.writeFile(outputPath, imageData);
            console.log('   Saved to:', outputPath);
        }
        
        console.log('\n✅ Verona NBM timeout fix verified successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.code === 'ETIMEDOUT') {
            console.error('   The timeout issue persists.');
            console.error('   Error details:', error);
        }
        process.exit(1);
    }
});
