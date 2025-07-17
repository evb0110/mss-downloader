const path = require('path');
const fs = require('fs');
const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService.js');
const { EnhancedPdfMerger } = require('../../dist/main/services/EnhancedPdfMerger.js');
const { ManifestCache } = require('../../dist/main/services/ManifestCache.js');

const outputDir = path.join(__dirname, '..', 'test-outputs', 'mdc-catalonia-test');

async function testMDCCatalonia() {
    console.log('Testing MDC Catalonia manuscript downloads...\n');
    
    // Clean up previous test outputs
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
    
    const manifestCache = new ManifestCache(path.join(__dirname, '..', 'cache', 'manifests'));
    const downloader = new EnhancedManuscriptDownloaderService(manifestCache);
    
    const testCases = [
        {
            name: 'MDC Catalonia - Incunable BC 175331',
            url: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
            maxPages: 10
        },
        {
            name: 'MDC Catalonia - manuscritBC 3877',
            url: 'https://mdc.csuc.cat/digital/collection/manuscritBC/id/3877/rec/1',
            maxPages: 10
        },
        {
            name: 'MDC Catalonia - incunableSHP 248',
            url: 'https://mdc.csuc.cat/digital/collection/incunableSHP/id/248/rec/1',
            maxPages: 10
        }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
        console.log(`\n📘 Testing: ${testCase.name}`);
        console.log(`URL: ${testCase.url}`);
        
        const testDir = path.join(outputDir, testCase.name.replace(/[^a-zA-Z0-9]/g, '_'));
        fs.mkdirSync(testDir, { recursive: true });
        
        try {
            // Step 1: Extract manifest
            console.log('\n1️⃣ Extracting manifest...');
            const manifest = await downloader.extractManifest(testCase.url);
            console.log(`✅ Found ${manifest.pageLinks.length} pages`);
            console.log(`   Display name: ${manifest.displayName}`);
            console.log(`   Library: ${manifest.library}`);
            
            // Step 2: Download pages
            console.log('\n2️⃣ Downloading pages...');
            const downloadedPages = [];
            const pagesToDownload = Math.min(testCase.maxPages, manifest.pageLinks.length);
            
            for (let i = 0; i < pagesToDownload; i++) {
                const pageUrl = manifest.pageLinks[i];
                console.log(`   Downloading page ${i + 1}/${pagesToDownload}...`);
                
                try {
                    const imageBuffer = await downloader.downloadImage(pageUrl);
                    const outputPath = path.join(testDir, `page_${String(i + 1).padStart(3, '0')}.jpg`);
                    await fs.promises.writeFile(outputPath, Buffer.from(imageBuffer));
                    downloadedPages.push(outputPath);
                    console.log(`   ✅ Page ${i + 1} downloaded (${(imageBuffer.byteLength / 1024).toFixed(2)} KB)`);
                } catch (error) {
                    console.error(`   ❌ Failed to download page ${i + 1}: ${error.message}`);
                }
            }
            
            // Step 3: Create PDF
            if (downloadedPages.length > 0) {
                console.log('\n3️⃣ Creating PDF...');
                const pdfPath = path.join(outputDir, `${testCase.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
                
                const pdfMerger = new EnhancedPdfMerger();
                await pdfMerger.mergeImagesToPdf(downloadedPages, pdfPath, (progress) => {
                    process.stdout.write(`\r   Progress: ${Math.round(progress * 100)}%`);
                });
                console.log('\n   ✅ PDF created successfully');
                
                // Verify PDF
                const stats = fs.statSync(pdfPath);
                console.log(`   📄 PDF size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                
                results.push({
                    name: testCase.name,
                    url: testCase.url,
                    status: 'success',
                    pages: downloadedPages.length,
                    pdfSize: stats.size,
                    pdfPath: pdfPath
                });
            } else {
                throw new Error('No pages downloaded successfully');
            }
            
        } catch (error) {
            console.error(`\n❌ Test failed: ${error.message}`);
            results.push({
                name: testCase.name,
                url: testCase.url,
                status: 'failed',
                error: error.message
            });
        }
    }
    
    // Summary
    console.log('\n\n📊 Test Summary:');
    console.log('================\n');
    for (const result of results) {
        if (result.status === 'success') {
            console.log(`✅ ${result.name}`);
            console.log(`   - Pages: ${result.pages}`);
            console.log(`   - PDF size: ${(result.pdfSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`   - Path: ${result.pdfPath}`);
        } else {
            console.log(`❌ ${result.name}`);
            console.log(`   - Error: ${result.error}`);
        }
        console.log('');
    }
    
    const successCount = results.filter(r => r.status === 'success').length;
    console.log(`\nTotal: ${successCount}/${results.length} successful`);
    
    if (successCount === results.length) {
        console.log('\n🎉 All tests passed!');
    } else {
        console.log('\n⚠️ Some tests failed. Check the errors above.');
    }
}

// Run tests
testMDCCatalonia().catch(console.error);