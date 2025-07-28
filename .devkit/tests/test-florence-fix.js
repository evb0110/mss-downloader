const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService');
const fs = require('fs').promises;
const path = require('path');

async function testFlorenceDownload() {
    console.log('Testing Florence library fix for ETIMEDOUT issue...\n');
    
    const service = new EnhancedManuscriptDownloaderService();
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
    
    try {
        console.log(`Testing URL: ${testUrl}`);
        console.log('Loading manifest...');
        
        const startTime = Date.now();
        const manifest = await service.loadManifest(testUrl);
        const loadTime = Date.now() - startTime;
        
        console.log(`\n✅ Manifest loaded successfully in ${loadTime}ms!`);
        console.log(`Total pages: ${manifest.totalPages}`);
        console.log(`Library: ${manifest.library}`);
        console.log(`Display name: ${manifest.displayName}`);
        
        // Download first 3 pages to test
        const testPages = Math.min(3, manifest.totalPages);
        console.log(`\nDownloading first ${testPages} pages to test...`);
        
        const outputDir = path.join(__dirname, 'florence-test-output');
        await fs.mkdir(outputDir, { recursive: true });
        
        for (let i = 0; i < testPages; i++) {
            const pageUrl = manifest.pageLinks[i];
            console.log(`\nDownloading page ${i + 1}...`);
            console.log(`URL: ${pageUrl}`);
            
            try {
                const downloadStart = Date.now();
                const buffer = await service.downloadSingleImage(pageUrl);
                const downloadTime = Date.now() - downloadStart;
                
                const filename = path.join(outputDir, `page_${i + 1}.jpg`);
                await fs.writeFile(filename, buffer);
                
                const stats = await fs.stat(filename);
                console.log(`✅ Page ${i + 1} downloaded successfully!`);
                console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                console.log(`   Time: ${downloadTime}ms`);
            } catch (error) {
                console.error(`❌ Failed to download page ${i + 1}: ${error.message}`);
            }
        }
        
        console.log(`\n✅ Test completed! Check ${outputDir} for downloaded pages.`);
        
    } catch (error) {
        console.error('\n❌ Test failed!');
        console.error('Error:', error.message);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
    }
}

// Run the test
testFlorenceDownload().catch(console.error);