const path = require('path');
const fs = require('fs');
const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService.js');
const { EnhancedPdfMerger } = require('../../dist/main/services/EnhancedPdfMerger.js');
const { ManifestCache } = require('../../dist/main/services/ManifestCache.js');
const { execSync } = require('child_process');

// Mock electron app paths
global.app = {
    getPath: (name) => {
        if (name === 'userData') return path.join(__dirname, '..', 'test-cache');
        if (name === 'downloads') return path.join(__dirname, '..', 'test-outputs');
        return __dirname;
    }
};

const outputDir = path.join(__dirname, '..', 'test-outputs', 'mdc-catalonia-validation');

async function cleanupOutputDir() {
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
}

async function testMDCManuscript(url, name, maxPages = 10) {
    console.log(`\n📘 Testing: ${name}`);
    console.log(`URL: ${url}`);
    
    const testDir = path.join(outputDir, name.replace(/[^a-zA-Z0-9]/g, '_'));
    fs.mkdirSync(testDir, { recursive: true });
    
    const cacheDir = path.join(testDir, 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const manifestCache = new ManifestCache(cacheDir);
    const downloader = new EnhancedManuscriptDownloaderService(manifestCache);
    
    try {
        // Step 1: Extract manifest
        console.log('\n1️⃣ Extracting manifest...');
        const manifest = await downloader.extractManifest(url);
        console.log(`✅ Found ${manifest.pageLinks.length} pages`);
        console.log(`   Display name: ${manifest.displayName}`);
        console.log(`   Library: ${manifest.library}`);
        
        // Step 2: Test different resolutions for maximum quality
        console.log('\n2️⃣ Testing image resolutions...');
        const firstPageUrl = manifest.pageLinks[0];
        const resolutionTests = [
            { resolution: 'full/full', desc: 'Full resolution' },
            { resolution: 'full/max', desc: 'Max resolution' },
            { resolution: 'full/4000,', desc: '4000px width' },
            { resolution: 'full/2000,', desc: '2000px width' },
            { resolution: 'full/1000,', desc: '1000px width' }
        ];
        
        let bestResolution = 'full/full';
        let maxSize = 0;
        
        for (const test of resolutionTests) {
            try {
                const testUrl = firstPageUrl.replace(/\/full\/[^/]+\//, `/${test.resolution}/`);
                const imageBuffer = await downloader.downloadImage(testUrl);
                const size = imageBuffer.byteLength;
                console.log(`   ${test.desc}: ${(size / 1024).toFixed(2)} KB`);
                
                if (size > maxSize) {
                    maxSize = size;
                    bestResolution = test.resolution;
                }
            } catch (error) {
                console.log(`   ${test.desc}: Failed - ${error.message}`);
            }
        }
        
        console.log(`\n✅ Best resolution: ${bestResolution} (${(maxSize / 1024).toFixed(2)} KB)`);
        
        // Step 3: Download pages with best resolution
        console.log(`\n3️⃣ Downloading ${Math.min(maxPages, manifest.pageLinks.length)} pages with best resolution...`);
        const downloadedPages = [];
        const pagesToDownload = Math.min(maxPages, manifest.pageLinks.length);
        
        for (let i = 0; i < pagesToDownload; i++) {
            const originalUrl = manifest.pageLinks[i];
            const pageUrl = originalUrl.replace(/\/full\/[^/]+\//, `/${bestResolution}/`);
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
        
        // Step 4: Create PDF
        if (downloadedPages.length > 0) {
            console.log('\n4️⃣ Creating PDF...');
            const pdfPath = path.join(outputDir, `${name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
            
            const pdfMerger = new EnhancedPdfMerger();
            await pdfMerger.mergeImagesToPdf(downloadedPages, pdfPath, (progress) => {
                process.stdout.write(`\r   Progress: ${Math.round(progress * 100)}%`);
            });
            console.log('\n   ✅ PDF created successfully');
            
            // Step 5: Validate PDF with poppler
            console.log('\n5️⃣ Validating PDF...');
            try {
                const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
                const pagesMatch = pdfInfo.match(/Pages:\s+(\d+)/);
                const sizeMatch = pdfInfo.match(/File size:\s+([\d,]+) bytes/);
                
                if (pagesMatch) {
                    console.log(`   ✅ PDF validated: ${pagesMatch[1]} pages`);
                }
                if (sizeMatch) {
                    const sizeBytes = parseInt(sizeMatch[1].replace(/,/g, ''));
                    console.log(`   ✅ PDF size: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`);
                }
                
                // Extract and check first page
                const extractDir = path.join(testDir, 'extracted');
                fs.mkdirSync(extractDir, { recursive: true });
                
                execSync(`pdfimages -j -p "${pdfPath}" "${path.join(extractDir, 'page')}"`, { stdio: 'pipe' });
                const extractedFiles = fs.readdirSync(extractDir).filter(f => f.endsWith('.jpg'));
                console.log(`   ✅ Extracted ${extractedFiles.length} images from PDF`);
                
                // Check image dimensions
                if (extractedFiles.length > 0) {
                    const firstImage = path.join(extractDir, extractedFiles[0]);
                    const identify = execSync(`identify "${firstImage}"`, { encoding: 'utf8' });
                    const dimMatch = identify.match(/(\d+)x(\d+)/);
                    if (dimMatch) {
                        console.log(`   ✅ Image dimensions: ${dimMatch[1]}x${dimMatch[2]} pixels`);
                    }
                }
                
            } catch (error) {
                console.error(`   ❌ PDF validation failed: ${error.message}`);
            }
            
            // Step 6: Visual inspection summary
            console.log('\n6️⃣ Visual inspection required:');
            console.log(`   - Check that pages show real manuscript content`);
            console.log(`   - Verify pages are different (not duplicates)`);
            console.log(`   - Confirm high resolution quality`);
            console.log(`   - No "Preview non disponibile" errors`);
            
            const stats = fs.statSync(pdfPath);
            return {
                success: true,
                pages: downloadedPages.length,
                pdfSize: stats.size,
                pdfPath: pdfPath,
                bestResolution: bestResolution
            };
        } else {
            throw new Error('No pages downloaded successfully');
        }
        
    } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

async function main() {
    console.log('🔍 MDC Catalonia Comprehensive Validation Test');
    console.log('='.repeat(80));
    
    await cleanupOutputDir();
    
    const testCases = [
        {
            name: 'MDC Incunable BC 175331',
            url: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1'
        },
        {
            name: 'MDC Manuscript MSP 57',
            url: 'https://mdc.csuc.cat/digital/collection/manuscritsMSP/id/57/rec/1'
        },
        {
            name: 'MDC Patrimoni 26479',
            url: 'https://mdc.csuc.cat/digital/collection/patrimoni/id/26479/rec/1'
        }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
        const result = await testMDCManuscript(testCase.url, testCase.name);
        results.push({ ...testCase, ...result });
    }
    
    // Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 MDC CATALONIA VALIDATION SUMMARY');
    console.log('='.repeat(80) + '\n');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (successful.length > 0) {
        console.log('✅ SUCCESSFUL DOWNLOADS:');
        successful.forEach(r => {
            console.log(`\n   ${r.name}:`);
            console.log(`   - Pages: ${r.pages}`);
            console.log(`   - PDF size: ${(r.pdfSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`   - Best resolution: ${r.bestResolution}`);
            console.log(`   - PDF path: ${r.pdfPath}`);
        });
    }
    
    if (failed.length > 0) {
        console.log('\n\n❌ FAILED DOWNLOADS:');
        failed.forEach(r => {
            console.log(`\n   ${r.name}:`);
            console.log(`   - Error: ${r.error}`);
        });
    }
    
    console.log(`\n\nTOTAL: ${successful.length}/${results.length} successful`);
    
    if (successful.length === results.length) {
        console.log('\n🎉 ALL TESTS PASSED! MDC Catalonia is working correctly.');
    } else {
        console.log('\n⚠️ Some tests failed. Check the errors above.');
    }
    
    // Final validation folder
    console.log(`\n📁 All validation PDFs saved to: ${outputDir}`);
    
    // Open finder if on macOS
    if (process.platform === 'darwin' && successful.length > 0) {
        execSync(`open "${outputDir}"`);
        console.log('📂 Opened validation folder in Finder');
    }
}

main().catch(console.error);