const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const PDFDocument = require('pdfkit');
const sharp = require('sharp');

app.disableHardwareAcceleration();

const TEST_OUTPUT_DIR = path.join(__dirname, '../test-outputs', 'verona-fix-validation');

async function ensureDirectory(dir) {
    await fs.mkdir(dir, { recursive: true });
}

async function downloadAndValidateManuscript(service, url, outputName) {
    console.log(`\n=== Testing ${outputName} ===`);
    console.log(`URL: ${url}`);
    
    const result = {
        url,
        outputName,
        status: 'pending',
        manifestLoadTime: 0,
        totalPages: 0,
        downloadedPages: 0,
        errors: []
    };
    
    try {
        // Test manifest loading
        const startTime = Date.now();
        const manifest = await service.loadManifest(url);
        result.manifestLoadTime = Date.now() - startTime;
        
        console.log(`✓ Manifest loaded in ${result.manifestLoadTime}ms`);
        console.log(`  Title: ${manifest.title}`);
        console.log(`  Total pages: ${manifest.totalPages}`);
        result.totalPages = manifest.totalPages;
        
        // Download up to 10 pages for validation
        const pagesToDownload = Math.min(10, manifest.totalPages);
        const downloadedImages = [];
        
        console.log(`\nDownloading ${pagesToDownload} pages for validation...`);
        
        for (let i = 0; i < pagesToDownload; i++) {
            try {
                const imageUrl = manifest.images[i];
                console.log(`  Page ${i + 1}/${pagesToDownload}...`);
                
                const imageData = await service.downloadImageWithRetries(imageUrl);
                const imagePath = path.join(TEST_OUTPUT_DIR, `${outputName}_page_${i + 1}.jpg`);
                
                await fs.writeFile(imagePath, Buffer.from(imageData));
                
                // Validate image
                const metadata = await sharp(imagePath).metadata();
                console.log(`    ✓ ${metadata.width}x${metadata.height} (${(imageData.byteLength / 1024).toFixed(2)} KB)`);
                
                downloadedImages.push(imagePath);
                result.downloadedPages++;
            } catch (error) {
                console.log(`    ✗ Failed: ${error.message}`);
                result.errors.push(`Page ${i + 1}: ${error.message}`);
            }
        }
        
        // Create PDF if we have images
        if (downloadedImages.length > 0) {
            console.log(`\nCreating PDF with ${downloadedImages.length} pages...`);
            const pdfPath = path.join(TEST_OUTPUT_DIR, `${outputName}.pdf`);
            
            const doc = new PDFDocument({ autoFirstPage: false });
            const stream = fs.createWriteStream(pdfPath);
            doc.pipe(stream);
            
            for (const imagePath of downloadedImages) {
                const metadata = await sharp(imagePath).metadata();
                doc.addPage({ size: [metadata.width, metadata.height] });
                doc.image(imagePath, 0, 0, { width: metadata.width, height: metadata.height });
            }
            
            doc.end();
            await new Promise(resolve => stream.on('finish', resolve));
            
            const pdfStats = await fs.stat(pdfPath);
            console.log(`✓ PDF created: ${(pdfStats.size / 1024 / 1024).toFixed(2)} MB`);
            result.pdfPath = pdfPath;
        }
        
        result.status = result.errors.length === 0 ? 'success' : 'partial';
        
    } catch (error) {
        console.error(`✗ Failed: ${error.message}`);
        result.status = 'failed';
        result.errors.push(error.message);
    }
    
    return result;
}

async function testVeronaFix() {
    await ensureDirectory(TEST_OUTPUT_DIR);
    
    const { EnhancedManuscriptDownloaderService } = require(path.join(__dirname, '../../dist/main/services/EnhancedManuscriptDownloaderService.js'));
    const service = new EnhancedManuscriptDownloaderService();
    
    console.log('=== Verona Library Fix Validation ===');
    console.log('Testing timeout fix and manifest loading...\n');
    
    const testCases = [
        {
            url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=14',
            name: 'Verona_codice14_CVII1001'
        },
        {
            url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
            name: 'Verona_codice15_LXXXIX841'
        },
        {
            url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=17',
            name: 'Verona_codice17_msClasseIII81'
        },
        {
            // Test direct manifest URL
            url: 'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/CVII1001.json',
            name: 'Verona_direct_manifest'
        }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
        const result = await downloadAndValidateManuscript(service, testCase.url, testCase.name);
        results.push(result);
    }
    
    // Generate report
    console.log('\n\n=== VALIDATION REPORT ===');
    
    const successful = results.filter(r => r.status === 'success').length;
    const partial = results.filter(r => r.status === 'partial').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    console.log(`\nSummary:`);
    console.log(`  Successful: ${successful}/${results.length}`);
    console.log(`  Partial: ${partial}/${results.length}`);
    console.log(`  Failed: ${failed}/${results.length}`);
    
    console.log(`\nDetails:`);
    for (const result of results) {
        console.log(`\n${result.outputName}:`);
        console.log(`  Status: ${result.status}`);
        console.log(`  Manifest load time: ${result.manifestLoadTime}ms`);
        console.log(`  Pages: ${result.downloadedPages}/${result.totalPages}`);
        if (result.errors.length > 0) {
            console.log(`  Errors:`);
            result.errors.forEach(err => console.log(`    - ${err}`));
        }
    }
    
    // Save detailed report
    const report = {
        testDate: new Date().toISOString(),
        results,
        summary: {
            total: results.length,
            successful,
            partial,
            failed,
            avgManifestLoadTime: results
                .filter(r => r.manifestLoadTime > 0)
                .reduce((sum, r) => sum + r.manifestLoadTime, 0) / results.filter(r => r.manifestLoadTime > 0).length || 0
        }
    };
    
    await fs.writeFile(
        path.join(TEST_OUTPUT_DIR, 'verona-fix-validation-report.json'),
        JSON.stringify(report, null, 2)
    );
    
    console.log(`\nDetailed report saved to: ${path.join(TEST_OUTPUT_DIR, 'verona-fix-validation-report.json')}`);
    console.log(`PDF files saved to: ${TEST_OUTPUT_DIR}`);
}

app.whenReady().then(async () => {
    await testVeronaFix();
    app.quit();
});