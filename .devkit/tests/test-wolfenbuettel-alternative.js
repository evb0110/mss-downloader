const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService');
const fs = require('fs');
const path = require('path');

async function testWolfenbuettelUrls() {
    const downloader = new EnhancedManuscriptDownloaderService();
    
    // Create output directory
    const outputDir = path.join(__dirname, '../validation/wolfenbuettel-alternative');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const testUrls = [
        {
            name: 'original-format',
            url: 'https://diglib.hab.de/wdb.php?dir=mss/1008-helmst'
        },
        {
            name: 'alternative-format',
            url: 'https://diglib.hab.de/varia/selecta/ed000011/start.htm?distype=thumbs-img&imgtyp=0&size='
        }
    ];
    
    console.log('Testing Wolfenbüttel URL formats...\n');
    
    for (const test of testUrls) {
        console.log(`\n=== Testing ${test.name} ===`);
        console.log(`URL: ${test.url}`);
        
        try {
            // Load manifest
            const manifest = await downloader.loadWolfenbuettelManifest(test.url);
            console.log(`✓ Manifest loaded successfully`);
            console.log(`  Display name: ${manifest.displayName}`);
            console.log(`  Total pages: ${manifest.totalPages}`);
            console.log(`  Library: ${manifest.library}`);
            
            // Download first 5 pages
            const pagesToTest = Math.min(5, manifest.totalPages);
            console.log(`\nDownloading first ${pagesToTest} pages...`);
            
            const outputPath = path.join(outputDir, `${test.name}.pdf`);
            
            const result = await downloader.downloadManuscript(test.url, {
                onProgress: (progress) => {
                    if (typeof progress === 'object' && progress.completedPages !== undefined) {
                        process.stdout.write(`\rProgress: ${progress.completedPages}/${pagesToTest} pages`);
                    }
                },
                startPage: 1,
                endPage: pagesToTest,
                outputPath: outputPath
            });
            
            console.log(`\n✓ Download completed: ${result.filepath}`);
            
            // Check file size
            const stats = fs.statSync(result.filepath);
            console.log(`  File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
            
        } catch (error) {
            console.error(`✗ Error: ${error.message}`);
        }
    }
    
    console.log(`\n\nValidation files saved to: ${outputDir}`);
    console.log('Please check the PDFs to verify both URL formats work correctly.');
}

// Run the test
testWolfenbuettelUrls().catch(console.error);