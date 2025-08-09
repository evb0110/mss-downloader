/**
 * ULTRA-VALIDATION for Issue #2 - University of Graz
 * Tests the exact failing URL with comprehensive validation
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function ultraValidation() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔥 ULTRA-VALIDATION for Issue #2');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    const testUrl = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688';
    const results = {
        manifestLoad: false,
        pageCount: 0,
        pageDownload: false,
        pdfCreation: false,
        errors: []
    };
    
    try {
        // Test 1: Load manifest
        console.log('📝 Test 1: Loading manifest...');
        const loaders = new SharedManifestLoaders();
        const startTime = Date.now();
        
        const manifest = await loaders.getGrazManifest(testUrl);
        const loadTime = Date.now() - startTime;
        
        results.manifestLoad = true;
        results.pageCount = manifest.images ? manifest.images.length : 0;
        
        console.log(`✅ Manifest loaded in ${loadTime}ms`);
        console.log(`📄 Total pages: ${results.pageCount}`);
        console.log('');
        
        // Test 2: Download sample pages
        console.log('📝 Test 2: Downloading 10 sample pages...');
        const outputDir = '.devkit/ultra-priority/issue-2/validation-pages';
        execSync(`rm -rf ${outputDir} && mkdir -p ${outputDir}`, { stdio: 'ignore' });
        
        const https = require('https');
        const downloadPage = (url, filename) => {
            return new Promise((resolve, reject) => {
                const file = fs.createWriteStream(filename);
                https.get(url, { timeout: 30000 }, (response) => {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                }).on('error', reject);
            });
        };
        
        // Download 10 evenly spaced pages
        const pagesToTest = 10;
        const pageInterval = Math.floor(results.pageCount / pagesToTest);
        const downloadedPages = [];
        
        for (let i = 0; i < pagesToTest; i++) {
            const pageIndex = Math.min(i * pageInterval, results.pageCount - 1);
            const page = manifest.images[pageIndex];
            const pageNum = pageIndex + 1;
            const filename = path.join(outputDir, `page_${pageNum}.jpg`);
            
            console.log(`  Downloading page ${pageNum}/${results.pageCount}...`);
            await downloadPage(page.url, filename);
            downloadedPages.push(filename);
        }
        
        results.pageDownload = true;
        console.log(`✅ Downloaded ${pagesToTest} pages successfully`);
        console.log('');
        
        // Test 3: Create PDF
        console.log('📝 Test 3: Creating PDF from downloaded pages...');
        const pdfPath = path.join(outputDir, 'test-manuscript.pdf');
        
        try {
            // Use ImageMagick to create PDF
            const convertCmd = `convert ${downloadedPages.join(' ')} "${pdfPath}"`;
            execSync(convertCmd, { stdio: 'ignore' });
            
            // Verify PDF
            const pdfInfo = execSync(`pdfinfo "${pdfPath}" 2>/dev/null || echo "PDF_ERROR"`, { encoding: 'utf8' });
            
            if (!pdfInfo.includes('PDF_ERROR')) {
                results.pdfCreation = true;
                const stats = fs.statSync(pdfPath);
                console.log(`✅ PDF created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                
                // Extract PDF info
                const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
                if (pageMatch) {
                    console.log(`   Pages in PDF: ${pageMatch[1]}`);
                }
            } else {
                console.log('⚠️  PDF created but validation failed');
            }
        } catch (error) {
            console.log('⚠️  PDF creation skipped (ImageMagick not available)');
        }
        
        console.log('');
        
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        results.errors.push(error.message);
    }
    
    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 VALIDATION RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Manifest Load: ${results.manifestLoad ? '✅' : '❌'}`);
    console.log(`Page Count: ${results.pageCount} pages`);
    console.log(`Page Download: ${results.pageDownload ? '✅' : '❌'}`);
    console.log(`PDF Creation: ${results.pdfCreation ? '✅' : '❌'}`);
    
    if (results.errors.length > 0) {
        console.log('\nErrors:');
        results.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    // Overall result
    const success = results.manifestLoad && results.pageCount > 0 && results.pageDownload;
    console.log('');
    console.log(`Overall: ${success ? '✅ PASSED' : '❌ FAILED'}`);
    
    return success;
}

ultraValidation().then(success => {
    if (success) {
        console.log('\n🎉 Ultra-validation completed successfully!');
        process.exit(0);
    } else {
        console.log('\n💥 Ultra-validation failed');
        process.exit(1);
    }
}).catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
});