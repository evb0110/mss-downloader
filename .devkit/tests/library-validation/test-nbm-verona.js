#!/usr/bin/env node

/**
 * NBM Verona Library Test Script
 * Tests the Nuova Biblioteca Manoscritta (Verona) implementation
 * Validates that all pages are detected and downloaded correctly
 */

const path = require('path');
const fs = require('fs');
const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');

const TEST_RESULTS_DIR = process.env.TEST_RESULTS_DIR || path.join(__dirname, 'test-results');
const TIMESTAMP = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
const OUTPUT_DIR = path.join(TEST_RESULTS_DIR, TIMESTAMP, 'nbm-verona');

// Test manuscripts
const TEST_MANUSCRIPTS = [
    {
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
        name: 'Codice 15 (LXXXIX841)',
        expectedMinPages: 20,  // Should have many pages
        description: 'Main test manuscript - should extract all pages'
    },
    {
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=12',
        name: 'Codice 12 (CXLV1331)', 
        expectedMinPages: 10,
        description: 'Secondary test manuscript'
    },
    {
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=14',
        name: 'Codice 14 (CVII1001)',
        expectedMinPages: 10,
        description: 'Additional test manuscript'
    }
];

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function downloadImage(url, retries = 3) {
    const https = require('https');
    
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`   Downloading: ${url.split('/').pop()}`);
            
            return await new Promise((resolve, reject) => {
                const chunks = [];
                https.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'image/*'
                    },
                    rejectUnauthorized: false  // Handle SSL issues
                }, (res) => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`HTTP ${res.statusCode}`));
                        return;
                    }
                    
                    res.on('data', chunk => chunks.push(chunk));
                    res.on('end', () => resolve(Buffer.concat(chunks)));
                    res.on('error', reject);
                }).on('error', reject);
            });
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`   Retry ${i + 1} after error: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

async function testManuscript(manuscript) {
    console.log(`\nTesting: ${manuscript.name}`);
    console.log(`URL: ${manuscript.url}`);
    console.log(`Expected minimum pages: ${manuscript.expectedMinPages}`);
    
    const resultDir = path.join(OUTPUT_DIR, manuscript.name.replace(/[^a-zA-Z0-9]/g, '_'));
    if (!fs.existsSync(resultDir)) {
        fs.mkdirSync(resultDir, { recursive: true });
    }
    
    try {
        // Load manifest using SharedManifestLoaders
        const loader = new SharedManifestLoaders();
        const manifest = await loader.getVeronaManifest(manuscript.url);
        
        console.log(`\nManifest loaded successfully:`);
        console.log(`- Display name: ${manifest.displayName}`);
        console.log(`- Total pages found: ${manifest.totalPages}`);
        console.log(`- Library: ${manifest.library}`);
        
        // Validate page count
        if (manifest.totalPages < manuscript.expectedMinPages) {
            throw new Error(`Expected at least ${manuscript.expectedMinPages} pages, but found only ${manifest.totalPages}`);
        }
        
        // Test resolution detection
        console.log('\nTesting resolution detection...');
        const firstPageUrl = manifest.pageLinks[0];
        console.log(`First page URL: ${firstPageUrl}`);
        
        // Check if using IIIF pattern for maximum resolution
        if (!firstPageUrl.includes('/full/full/')) {
            console.warn('WARNING: Not using maximum resolution IIIF pattern!');
        }
        
        // Download sample pages
        const pagesToDownload = Math.min(10, manifest.totalPages);
        console.log(`\nDownloading ${pagesToDownload} sample pages...`);
        
        const downloadedPages = [];
        
        for (let i = 0; i < pagesToDownload; i++) {
            try {
                const imageBuffer = await downloadImage(manifest.pageLinks[i]);
                const pagePath = path.join(resultDir, `page_${String(i + 1).padStart(3, '0')}.jpg`);
                fs.writeFileSync(pagePath, imageBuffer);
                
                // Get image metadata
                const metadata = await sharp(imageBuffer).metadata();
                console.log(`   Page ${i + 1}: ${metadata.width}x${metadata.height} (${(imageBuffer.length / 1024).toFixed(1)} KB)`);
                
                downloadedPages.push({
                    path: pagePath,
                    buffer: imageBuffer,
                    metadata,
                    pageNumber: i + 1
                });
            } catch (error) {
                console.error(`   Failed to download page ${i + 1}: ${error.message}`);
            }
        }
        
        if (downloadedPages.length === 0) {
            throw new Error('No pages could be downloaded');
        }
        
        // Verify pages are different (not stuck on page 1)
        console.log('\nVerifying page uniqueness...');
        const firstPageHash = require('crypto').createHash('md5').update(downloadedPages[0].buffer).digest('hex');
        let uniquePages = 1;
        
        for (let i = 1; i < downloadedPages.length; i++) {
            const pageHash = require('crypto').createHash('md5').update(downloadedPages[i].buffer).digest('hex');
            if (pageHash !== firstPageHash) {
                uniquePages++;
            }
        }
        
        console.log(`Unique pages found: ${uniquePages} out of ${downloadedPages.length}`);
        if (uniquePages < downloadedPages.length * 0.8) {
            console.warn('WARNING: Many duplicate pages detected!');
        }
        
        // Create PDF
        console.log('\nCreating validation PDF...');
        const pdfDoc = await PDFDocument.create();
        
        for (const page of downloadedPages) {
            const pdfImage = await pdfDoc.embedJpg(page.buffer);
            const pdfPage = pdfDoc.addPage([pdfImage.width, pdfImage.height]);
            pdfPage.drawImage(pdfImage, {
                x: 0,
                y: 0,
                width: pdfImage.width,
                height: pdfImage.height
            });
        }
        
        const pdfPath = path.join(OUTPUT_DIR, `${manuscript.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(pdfPath, pdfBytes);
        console.log(`PDF created: ${pdfPath} (${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB)`);
        
        // Validate PDF with poppler
        try {
            const { execSync } = require('child_process');
            execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
            console.log('PDF validation: ✅ Valid PDF');
        } catch (error) {
            console.error('PDF validation: ❌ Invalid PDF');
            throw new Error('Generated PDF is invalid');
        }
        
        // Calculate average resolution
        const avgWidth = downloadedPages.reduce((sum, p) => sum + p.metadata.width, 0) / downloadedPages.length;
        const avgHeight = downloadedPages.reduce((sum, p) => sum + p.metadata.height, 0) / downloadedPages.length;
        const megapixels = (avgWidth * avgHeight / 1000000).toFixed(1);
        
        console.log('\n✅ Test passed!');
        console.log(`Summary:`);
        console.log(`- Total pages in manuscript: ${manifest.totalPages}`);
        console.log(`- Pages downloaded: ${downloadedPages.length}`);
        console.log(`- Unique pages: ${uniquePages}`);
        console.log(`- Average resolution: ${Math.round(avgWidth)}x${Math.round(avgHeight)} (${megapixels} MP)`);
        console.log(`- PDF size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
        
        return {
            success: true,
            manuscript: manuscript.name,
            totalPages: manifest.totalPages,
            downloadedPages: downloadedPages.length,
            uniquePages,
            averageResolution: `${Math.round(avgWidth)}x${Math.round(avgHeight)}`,
            megapixels: parseFloat(megapixels),
            pdfPath,
            pdfSizeMB: parseFloat((pdfBytes.length / 1024 / 1024).toFixed(2))
        };
        
    } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}`);
        return {
            success: false,
            manuscript: manuscript.name,
            error: error.message
        };
    }
}

async function runAllTests() {
    console.log('NBM Verona Library Test Suite');
    console.log('============================');
    console.log(`Output directory: ${OUTPUT_DIR}`);
    
    const results = [];
    
    for (const manuscript of TEST_MANUSCRIPTS) {
        const result = await testManuscript(manuscript);
        results.push(result);
        
        // Add delay between manuscripts to avoid overloading server
        if (manuscript !== TEST_MANUSCRIPTS[TEST_MANUSCRIPTS.length - 1]) {
            console.log('\nWaiting 5 seconds before next test...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    
    // Summary
    console.log('\n\nTEST SUMMARY');
    console.log('============');
    
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${result.manuscript}`);
        if (result.success) {
            console.log(`   Pages: ${result.totalPages} total, ${result.uniquePages} unique`);
            console.log(`   Resolution: ${result.averageResolution} (${result.megapixels} MP)`);
            console.log(`   PDF: ${result.pdfSizeMB} MB`);
        } else {
            console.log(`   Error: ${result.error}`);
        }
    });
    
    console.log(`\nTotal: ${results.length} tests, ${passed} passed, ${failed} failed`);
    
    // Save results
    const reportPath = path.join(OUTPUT_DIR, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        library: 'NBM Verona',
        totalTests: results.length,
        passed,
        failed,
        results
    }, null, 2));
    
    console.log(`\nReport saved to: ${reportPath}`);
    
    if (failed > 0) {
        process.exit(1);
    }
}

// Run tests
runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});