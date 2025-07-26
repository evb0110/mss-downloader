const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Import the service
const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService');
const { EnhancedDownloadQueue } = require('../../dist/main/services/EnhancedDownloadQueue');

async function testWolfenbuettelWithApp() {
    console.log('=== TESTING WOLFENBÜTTEL WITH ACTUAL APP LOGIC ===\n');
    
    // Initialize services
    const downloadDir = path.join(__dirname, '../reports/wolfenbuettel-app-test');
    await fs.mkdir(downloadDir, { recursive: true });
    
    const downloaderService = new EnhancedManuscriptDownloaderService();
    const downloadQueue = new EnhancedDownloadQueue();
    
    // Test URL
    const testUrl = 'https://diglib.hab.de/varia/selecta/ed000011/start.htm?distype=thumbs-img&imgtyp=0&size=';
    
    console.log('Test URL:', testUrl);
    console.log('Download directory:', downloadDir);
    
    try {
        // First, load the manifest
        console.log('\n=== LOADING MANIFEST ===');
        const manifest = await downloaderService.loadWolfenbuettelManifest(testUrl);
        
        console.log(`Manifest loaded successfully!`);
        console.log(`Title: ${manifest.metadata.title}`);
        console.log(`Total pages: ${manifest.sequences[0].canvases.length}`);
        console.log(`First page URL: ${manifest.sequences[0].canvases[0].images[0].resource['@id']}`);
        console.log(`Last page URL: ${manifest.sequences[0].canvases[manifest.sequences[0].canvases.length - 1].images[0].resource['@id']}`);
        
        // Now test the download process
        console.log('\n=== TESTING DOWNLOAD PROCESS ===');
        
        // Create a download item
        const downloadItem = {
            id: 'test-wolfenbuettel-001',
            manifestUrl: testUrl,
            title: manifest.metadata.title,
            outputPath: path.join(downloadDir, 'wolfenbuettel_ed000011.pdf'),
            status: 'pending',
            progress: 0,
            totalPages: manifest.sequences[0].canvases.length,
            downloadedPages: 0,
            format: 'pdf',
            options: {
                maxWidth: 2000,
                quality: 90,
                timeout: 300000
            }
        };
        
        // Monitor progress
        let lastProgress = 0;
        let progressUpdates = 0;
        const progressInterval = setInterval(() => {
            const item = downloadQueue.getItem(downloadItem.id);
            if (item && item.progress !== lastProgress) {
                console.log(`Progress: ${item.progress}% (${item.downloadedPages}/${item.totalPages} pages)`);
                lastProgress = item.progress;
                progressUpdates++;
            }
        }, 1000);
        
        // Add to queue
        console.log('Adding to download queue...');
        downloadQueue.addItem(downloadItem);
        
        // Wait for completion
        const startTime = Date.now();
        while (true) {
            const item = downloadQueue.getItem(downloadItem.id);
            if (!item || item.status === 'completed' || item.status === 'failed') {
                clearInterval(progressInterval);
                const duration = Math.round((Date.now() - startTime) / 1000);
                
                console.log(`\n=== DOWNLOAD ${item.status.toUpperCase()} ===`);
                console.log(`Duration: ${duration} seconds`);
                console.log(`Progress updates: ${progressUpdates}`);
                
                if (item.status === 'completed') {
                    console.log(`Output file: ${item.outputPath}`);
                    
                    // Check file
                    const stats = await fs.stat(item.outputPath);
                    console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                } else {
                    console.log(`Error: ${item.error}`);
                }
                
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
    } catch (err) {
        console.error('\nError during test:', err);
        console.error(err.stack);
    }
    
    console.log('\n=== TEST COMPLETE ===');
}

// Run when electron is ready
app.whenReady().then(() => {
    testWolfenbuettelWithApp()
        .then(() => {
            console.log('Test finished successfully');
            app.quit();
        })
        .catch(err => {
            console.error('Test failed:', err);
            app.quit();
        });
});