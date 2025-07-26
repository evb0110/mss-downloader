const path = require('path');
const fs = require('fs').promises;
const { execSync } = require('child_process');

// Build the app first
console.log('Building the app...');
try {
    execSync('npm run build', { stdio: 'inherit' });
} catch (err) {
    console.error('Build failed:', err.message);
    process.exit(1);
}

// Import the built service
const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService');

async function testActualWolfenbuettelDownload() {
    console.log('\n=== TESTING WOLFENBÜTTEL ACTUAL DOWNLOAD ===\n');
    
    const outputDir = path.join(__dirname, '../reports/wolfenbuettel-actual-test');
    await fs.mkdir(outputDir, { recursive: true });
    
    const service = new EnhancedManuscriptDownloaderService();
    const testUrl = 'https://diglib.hab.de/varia/selecta/ed000011/start.htm?distype=thumbs-img&imgtyp=0&size=';
    
    console.log('Test URL:', testUrl);
    console.log('Output directory:', outputDir);
    
    try {
        // First load the manifest
        console.log('\n1. Loading manifest...');
        const manifest = await service.loadWolfenbuettelManifest(testUrl);
        console.log(`   ✓ Manifest loaded: ${manifest.metadata.title}`);
        console.log(`   ✓ Total pages: ${manifest.sequences[0].canvases.length}`);
        
        // Now download with progress tracking
        console.log('\n2. Starting download...');
        const outputPath = path.join(outputDir, 'wolfenbuettel_ed000011.pdf');
        
        let lastProgress = 0;
        let progressUpdates = 0;
        let lastLogTime = Date.now();
        
        const result = await service.downloadManuscript(testUrl, {
            outputPath,
            onProgress: (progress) => {
                progressUpdates++;
                const now = Date.now();
                
                // Log every 5 seconds or significant progress change
                if (now - lastLogTime > 5000 || Math.abs(progress.progress - lastProgress) > 0.1) {
                    console.log(`   Progress: ${(progress.progress * 100).toFixed(1)}% - ${progress.completedPages}/${progress.totalPages} pages`);
                    lastLogTime = now;
                    lastProgress = progress.progress;
                }
            },
            onManifestLoaded: (manifest) => {
                console.log(`   Manifest loaded callback: ${manifest.library} - ${manifest.totalPages} pages`);
            },
            maxConcurrent: 3,
            skipExisting: false
        });
        
        if (result.success) {
            console.log(`\n✅ Download completed successfully!`);
            console.log(`   Output file: ${result.filepath}`);
            
            // Verify the file
            const stats = await fs.stat(result.filepath);
            console.log(`   File size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
            console.log(`   Progress updates received: ${progressUpdates}`);
            
            // Run pdfimages to validate
            console.log('\n3. Validating PDF...');
            try {
                execSync(`pdfimages -list "${result.filepath}" | head -20`, { stdio: 'inherit' });
            } catch (err) {
                console.log('   (pdfimages not available for validation)');
            }
        } else {
            console.error('\n❌ Download failed:', result.error || 'Unknown error');
        }
        
    } catch (err) {
        console.error('\n❌ Error during test:', err.message);
        console.error(err.stack);
        
        // Check if it's a timeout or cycle issue
        if (err.message.includes('timeout') || err.message.includes('cycle')) {
            console.log('\n⚠️  This appears to be the cycle/timeout issue!');
            console.log('Error details:', err);
        }
    }
    
    console.log('\n=== TEST COMPLETE ===');
}

testActualWolfenbuettelDownload().catch(console.error);