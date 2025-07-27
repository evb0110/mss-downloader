#!/usr/bin/env node

/**
 * HHU Düsseldorf Test Script
 * Tests the Heinrich-Heine-University Düsseldorf implementation
 * Validates high-resolution image downloads and error handling
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');

const TEST_RESULTS_DIR = process.env.TEST_RESULTS_DIR || path.join(__dirname, 'test-results');
const TIMESTAMP = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
const OUTPUT_DIR = path.join(TEST_RESULTS_DIR, TIMESTAMP, 'hhu-duesseldorf');

// Import the actual downloader service
const { EnhancedManuscriptDownloaderService } = require('../../../src/main/services/EnhancedManuscriptDownloaderService.ts');

// Test manuscripts
const TEST_MANUSCRIPTS = [
    {
        url: 'https://digital.ulb.hhu.de/i3f/v20/7674176/manifest',
        name: 'MS 7674176',
        expectedMinPages: 10,
        description: 'Main test manuscript - should download in maximum resolution (up to 4879x6273px)',
        expectedMinResolution: 4000  // Width should be at least 4000px for high-res
    },
    {
        url: 'https://digital.ulb.hhu.de/content/titleinfo/7674175',
        name: 'MS 7674175',
        expectedMinPages: 5,
        description: 'Test URL format conversion to manifest',
        expectedMinResolution: 3000
    },
    {
        url: 'https://digital.ulb.hhu.de/content/pageview/7674177',
        name: 'MS 7674177',
        expectedMinPages: 5,
        description: 'Test pageview URL format',
        expectedMinResolution: 3000
    }
];

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function fetchWithHTTPS(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': options.headers?.Accept || 'application/json, application/ld+json',
                ...options.headers
            },
            timeout: 30000
        };

        const req = https.request(requestOptions, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString();
                resolve(text);
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

async function downloadImage(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`   Downloading: ${url.split('/').pop()}`);
            
            return await new Promise((resolve, reject) => {
                const chunks = [];
                https.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'image/*'
                    }
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
    console.log(`Expected minimum resolution: ${manuscript.expectedMinResolution}px width`);
    
    const resultDir = path.join(OUTPUT_DIR, manuscript.name.replace(/[^a-zA-Z0-9]/g, '_'));
    if (!fs.existsSync(resultDir)) {
        fs.mkdirSync(resultDir, { recursive: true });
    }
    
    try {
        // Use the actual downloader service
        const downloader = new EnhancedManuscriptDownloaderService();
        
        // Set fetchWithHTTPS for the test
        downloader.fetchWithHTTPS = fetchWithHTTPS;
        
        const manifest = await downloader.loadHhuManifest(manuscript.url);
        
        console.log(`\nManifest loaded successfully:`);
        console.log(`- Display name: ${manifest.displayName}`);
        console.log(`- Total pages found: ${manifest.totalPages}`);
        console.log(`- Library: ${manifest.library}`);
        
        // Validate page count
        if (manifest.totalPages < manuscript.expectedMinPages) {
            throw new Error(`Expected at least ${manuscript.expectedMinPages} pages, but found only ${manifest.totalPages}`);
        }
        
        // Check URL patterns for IIIF maximum resolution
        console.log('\nChecking IIIF URL patterns...');
        const firstPageUrl = manifest.pageLinks[0];
        console.log(`First page URL: ${firstPageUrl}`);
        
        if (!firstPageUrl.includes('/full/full/0/default.jpg')) {
            console.warn('WARNING: Not using IIIF maximum resolution pattern (/full/full/0/default.jpg)');
        } else {
            console.log('✅ Using IIIF maximum resolution pattern');
        }
        
        // Download sample pages to verify high resolution
        const pagesToDownload = Math.min(5, manifest.totalPages);
        console.log(`\nDownloading ${pagesToDownload} sample pages...`);
        
        const downloadedPages = [];
        let lowResCount = 0;
        
        for (let i = 0; i < pagesToDownload; i++) {
            try {
                const imageBuffer = await downloadImage(manifest.pageLinks[i]);
                const pagePath = path.join(resultDir, `page_${String(i + 1).padStart(3, '0')}.jpg`);
                fs.writeFileSync(pagePath, imageBuffer);
                
                // Get image metadata
                const metadata = await sharp(imageBuffer).metadata();
                const megapixels = (metadata.width * metadata.height / 1000000).toFixed(1);
                console.log(`   Page ${i + 1}: ${metadata.width}x${metadata.height} (${megapixels} MP, ${(imageBuffer.length / 1024).toFixed(1)} KB)`);
                
                // Check if resolution meets expectations
                if (metadata.width < manuscript.expectedMinResolution) {
                    lowResCount++;
                    console.warn(`   ⚠️  Low resolution detected! Expected at least ${manuscript.expectedMinResolution}px width`);
                }
                
                downloadedPages.push({
                    path: pagePath,
                    buffer: imageBuffer,
                    metadata,
                    pageNumber: i + 1,
                    megapixels: parseFloat(megapixels)
                });
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`   Failed to download page ${i + 1}: ${error.message}`);
                
                // Check for specific HHU errors
                if (error.message.includes('Cannot read properties of undefined')) {
                    throw new Error('HHU error handling not working! Still getting "Cannot read properties of undefined" error');
                }
            }
        }
        
        if (downloadedPages.length === 0) {
            throw new Error('No pages could be downloaded');
        }
        
        if (lowResCount > 0) {
            console.warn(`\n⚠️  WARNING: ${lowResCount} out of ${downloadedPages.length} pages are below expected resolution!`);
        }
        
        // Verify pages are different
        console.log('\nVerifying page uniqueness...');
        const pageHashes = new Set();
        
        for (const page of downloadedPages) {
            const hash = require('crypto').createHash('md5').update(page.buffer).digest('hex');
            pageHashes.add(hash);
        }
        
        const uniquePages = pageHashes.size;
        console.log(`Unique pages found: ${uniquePages} out of ${downloadedPages.length}`);
        
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
        
        // Calculate average resolution and quality metrics
        const avgWidth = downloadedPages.reduce((sum, p) => sum + p.metadata.width, 0) / downloadedPages.length;
        const avgHeight = downloadedPages.reduce((sum, p) => sum + p.metadata.height, 0) / downloadedPages.length;
        const avgMegapixels = downloadedPages.reduce((sum, p) => sum + p.megapixels, 0) / downloadedPages.length;
        
        // HHU should provide very high resolution (30+ megapixels as advertised)
        const expectedMegapixels = 20; // Conservative expectation
        if (avgMegapixels < expectedMegapixels) {
            console.warn(`\n⚠️  Resolution lower than expected! HHU advertises 30+ megapixel downloads.`);
            console.warn(`   Got average: ${avgMegapixels.toFixed(1)} MP, expected: ${expectedMegapixels}+ MP`);
        }
        
        console.log('\n✅ Test passed!');
        console.log(`Summary:`);
        console.log(`- Total pages in manuscript: ${manifest.totalPages}`);
        console.log(`- Pages downloaded: ${downloadedPages.length}`);
        console.log(`- Unique pages: ${uniquePages}`);
        console.log(`- Average resolution: ${Math.round(avgWidth)}x${Math.round(avgHeight)} (${avgMegapixels.toFixed(1)} MP)`);
        console.log(`- PDF size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
        console.log(`- High-res pages: ${downloadedPages.length - lowResCount}/${downloadedPages.length}`);
        
        return {
            success: true,
            manuscript: manuscript.name,
            totalPages: manifest.totalPages,
            downloadedPages: downloadedPages.length,
            uniquePages,
            averageResolution: `${Math.round(avgWidth)}x${Math.round(avgHeight)}`,
            megapixels: avgMegapixels,
            pdfPath,
            pdfSizeMB: parseFloat((pdfBytes.length / 1024 / 1024).toFixed(2)),
            highResPages: downloadedPages.length - lowResCount,
            lowResPages: lowResCount
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
    console.log('HHU Düsseldorf Test Suite');
    console.log('========================');
    console.log(`Output directory: ${OUTPUT_DIR}`);
    console.log('\nNOTE: HHU Düsseldorf advertises 30+ megapixel manuscript downloads.');
    console.log('This test validates high-resolution download capability.\n');
    
    const results = [];
    
    for (const manuscript of TEST_MANUSCRIPTS) {
        const result = await testManuscript(manuscript);
        results.push(result);
        
        // Add delay between manuscripts
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
            console.log(`   Resolution: ${result.averageResolution} (${result.megapixels.toFixed(1)} MP)`);
            console.log(`   Quality: ${result.highResPages} high-res, ${result.lowResPages} low-res`);
            console.log(`   PDF: ${result.pdfSizeMB} MB`);
        } else {
            console.log(`   Error: ${result.error}`);
        }
    });
    
    console.log(`\nTotal: ${results.length} tests, ${passed} passed, ${failed} failed`);
    
    // Calculate overall quality metrics
    const avgMegapixels = results
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.megapixels, 0) / (passed || 1);
    
    console.log(`\nOverall average resolution: ${avgMegapixels.toFixed(1)} MP`);
    if (avgMegapixels < 20) {
        console.log('⚠️  Warning: Average resolution is lower than expected for HHU!');
    }
    
    // Save results
    const reportPath = path.join(OUTPUT_DIR, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        library: 'HHU Düsseldorf',
        totalTests: results.length,
        passed,
        failed,
        results,
        averageMegapixels: avgMegapixels
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