const { EnhancedManuscriptDownloaderService } = require('../src/main/services/EnhancedManuscriptDownloaderService');
const { ManifestCache } = require('../src/main/services/ManifestCache');
const fs = require('fs');
const path = require('path');

// Test Wolfenbüttel library validation
async function testWolfenbuettelValidation() {
    console.log('=== WOLFENBÜTTEL LIBRARY VALIDATION TEST ===');
    
    const testUrl = 'https://diglib.hab.de/wdb.php?dir=mss/1008-helmst';
    const manifestCache = new ManifestCache();
    const downloader = new EnhancedManuscriptDownloaderService(manifestCache);
    
    try {
        // Test library detection
        console.log('1. Testing library detection...');
        const detectedLibrary = downloader.detectLibrary(testUrl);
        console.log(`   Detected library: ${detectedLibrary}`);
        
        if (detectedLibrary !== 'wolfenbuettel') {
            throw new Error(`Expected 'wolfenbuettel', got '${detectedLibrary}'`);
        }
        
        // Test manifest loading
        console.log('2. Testing manifest loading...');
        const manifest = await downloader.loadManifest(testUrl);
        
        console.log(`   Manifest loaded successfully:`);
        console.log(`   - Display name: ${manifest.displayName}`);
        console.log(`   - Total pages: ${manifest.totalPages}`);
        console.log(`   - Library: ${manifest.library}`);
        console.log(`   - First page URL: ${manifest.pageLinks[0]}`);
        console.log(`   - Last page URL: ${manifest.pageLinks[manifest.pageLinks.length - 1]}`);
        
        // Validate we have reasonable number of pages
        if (manifest.totalPages < 10) {
            throw new Error(`Expected at least 10 pages, got ${manifest.totalPages}`);
        }
        
        if (manifest.totalPages > 500) {
            throw new Error(`Too many pages (${manifest.totalPages}), possibly stuck in infinite loop`);
        }
        
        // Test downloading 10 sample pages for validation
        console.log('3. Testing page downloads...');
        const samplePages = manifest.pageLinks.slice(0, 10);
        const validationDir = path.join(__dirname, 'temp', 'wolfenbuettel-validation');
        await fs.promises.mkdir(validationDir, { recursive: true });
        
        const downloadResults = [];
        
        for (let i = 0; i < samplePages.length; i++) {
            const pageUrl = samplePages[i];
            const pageNum = i + 1;
            
            try {
                console.log(`   Downloading page ${pageNum}/${samplePages.length}...`);
                const response = await fetch(pageUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const buffer = Buffer.from(await response.arrayBuffer());
                const filename = path.join(validationDir, `page-${pageNum.toString().padStart(3, '0')}.jpg`);
                await fs.promises.writeFile(filename, buffer);
                
                downloadResults.push({
                    pageNum,
                    url: pageUrl,
                    filename,
                    size: buffer.length,
                    success: true
                });
                
                console.log(`   ✓ Page ${pageNum}: ${buffer.length} bytes`);
                
            } catch (error) {
                downloadResults.push({
                    pageNum,
                    url: pageUrl,
                    error: error.message,
                    success: false
                });
                
                console.log(`   ✗ Page ${pageNum}: ${error.message}`);
            }
        }
        
        // Summary
        const successCount = downloadResults.filter(r => r.success).length;
        const failureCount = downloadResults.filter(r => !r.success).length;
        
        console.log(`\n4. Validation Summary:`);
        console.log(`   - Total pages in manifest: ${manifest.totalPages}`);
        console.log(`   - Sample pages tested: ${samplePages.length}`);
        console.log(`   - Successful downloads: ${successCount}`);
        console.log(`   - Failed downloads: ${failureCount}`);
        console.log(`   - Success rate: ${((successCount / samplePages.length) * 100).toFixed(1)}%`);
        console.log(`   - Validation files saved to: ${validationDir}`);
        
        if (successCount < 8) { // Allow 2 failures out of 10
            throw new Error(`Too many failures: ${failureCount}/${samplePages.length}`);
        }
        
        console.log('\n✓ WOLFENBÜTTEL LIBRARY VALIDATION PASSED');
        
        return {
            manifest,
            downloadResults,
            validationDir,
            successRate: (successCount / samplePages.length) * 100
        };
        
    } catch (error) {
        console.error('\n✗ WOLFENBÜTTEL LIBRARY VALIDATION FAILED');
        console.error(`Error: ${error.message}`);
        throw error;
    }
}

// Run the validation test
testWolfenbuettelValidation().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
});