#!/usr/bin/env node

/**
 * Morgan Library Test Script
 * Tests the Morgan Library & Museum implementation
 * Validates that all pages are extracted (not just 16) and high-resolution ZIF files are processed
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');

const TEST_RESULTS_DIR = process.env.TEST_RESULTS_DIR || path.join(__dirname, 'test-results');
const TIMESTAMP = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
const OUTPUT_DIR = path.join(TEST_RESULTS_DIR, TIMESTAMP, 'morgan-library');

// Import the actual downloader service
const { EnhancedManuscriptDownloaderService } = require('../../../src/main/services/EnhancedManuscriptDownloaderService.ts');
const { ZifImageProcessor } = require('../../../src/main/services/ZifImageProcessor.ts');

// Test manuscripts
const TEST_MANUSCRIPTS = [
    {
        url: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        name: 'Lindau Gospels',
        expectedMinPages: 50,  // Should have many more than 16 pages
        description: 'Main test - famous illuminated manuscript',
        testZif: true  // Test ZIF processing
    },
    {
        url: 'https://www.themorgan.org/collection/hours-of-catherine-of-cleves/thumbs',
        name: 'Hours of Catherine of Cleves',
        expectedMinPages: 30,
        description: 'Rich illuminated book of hours'
    },
    {
        url: 'https://www.themorgan.org/collection/crusader-bible/thumbs',
        name: 'Crusader Bible',
        expectedMinPages: 40,
        description: 'Medieval illuminated manuscript'
    }
];

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function fetchUrl(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': options.headers?.Accept || '*/*',
                ...options.headers
            },
            timeout: 30000
        };

        const req = https.request(requestOptions, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchUrl(new URL(res.headers.location, url).href, options)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    headers: res.headers,
                    buffer: () => Promise.resolve(buffer),
                    text: () => Promise.resolve(buffer.toString()),
                    json: () => Promise.resolve(JSON.parse(buffer.toString()))
                });
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
            
            const response = await fetchUrl(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.buffer();
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`   Retry ${i + 1} after error: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

async function processZifFile(zifUrl, outputPath) {
    console.log(`   Processing ZIF file: ${zifUrl.split('/').pop()}`);
    
    try {
        // Download ZIF file
        const zifBuffer = await downloadImage(zifUrl);
        console.log(`   ZIF downloaded: ${(zifBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        
        // Process with ZifImageProcessor
        const processor = new ZifImageProcessor();
        const jpegBuffer = await processor.processZifToJpeg(zifBuffer);
        
        fs.writeFileSync(outputPath, jpegBuffer);
        
        const metadata = await sharp(jpegBuffer).metadata();
        console.log(`   ZIF processed: ${metadata.width}x${metadata.height} (${(jpegBuffer.length / 1024).toFixed(1)} KB)`);
        
        return { buffer: jpegBuffer, metadata };
    } catch (error) {
        console.error(`   Failed to process ZIF: ${error.message}`);
        throw error;
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
        // Use the actual downloader service
        const downloader = new EnhancedManuscriptDownloaderService();
        const manifest = await downloader.loadMorganManifest(manuscript.url);
        
        console.log(`\nManifest loaded successfully:`);
        console.log(`- Display name: ${manifest.displayName}`);
        console.log(`- Total pages found: ${manifest.totalPages}`);
        console.log(`- Library: ${manifest.library}`);
        
        // Validate page count
        if (manifest.totalPages < manuscript.expectedMinPages) {
            throw new Error(`Expected at least ${manuscript.expectedMinPages} pages, but found only ${manifest.totalPages}. This suggests the fix for extracting all pages is not working!`);
        }
        
        // Check URL patterns
        console.log('\nAnalyzing URL patterns...');
        let zifUrls = 0;
        let highResUrls = 0;
        let standardUrls = 0;
        
        manifest.pageLinks.forEach(url => {
            if (url.endsWith('.zif')) {
                zifUrls++;
            } else if (url.includes('/facsimile/') || url.includes('/full/full/')) {
                highResUrls++;
            } else {
                standardUrls++;
            }
        });
        
        console.log(`- ZIF files (ultra-high res): ${zifUrls}`);
        console.log(`- High-res URLs: ${highResUrls}`);
        console.log(`- Standard URLs: ${standardUrls}`);
        
        // Download sample pages
        const pagesToDownload = Math.min(10, manifest.totalPages);
        console.log(`\nDownloading ${pagesToDownload} sample pages...`);
        
        const downloadedPages = [];
        
        for (let i = 0; i < pagesToDownload; i++) {
            try {
                const pageUrl = manifest.pageLinks[i];
                const pagePath = path.join(resultDir, `page_${String(i + 1).padStart(3, '0')}.jpg`);
                
                let imageBuffer;
                let metadata;
                
                if (pageUrl.endsWith('.zif') && manuscript.testZif && i === 0) {
                    // Test ZIF processing on first page
                    const result = await processZifFile(pageUrl, pagePath);
                    imageBuffer = result.buffer;
                    metadata = result.metadata;
                } else if (pageUrl.endsWith('.zif')) {
                    // Skip other ZIF files for speed
                    console.log(`   Skipping ZIF file for page ${i + 1} (already tested ZIF processing)`);
                    continue;
                } else {
                    // Regular image download
                    imageBuffer = await downloadImage(pageUrl);
                    fs.writeFileSync(pagePath, imageBuffer);
                    metadata = await sharp(imageBuffer).metadata();
                    console.log(`   Page ${i + 1}: ${metadata.width}x${metadata.height} (${(imageBuffer.length / 1024).toFixed(1)} KB)`);
                }
                
                downloadedPages.push({
                    path: pagePath,
                    buffer: imageBuffer,
                    metadata,
                    pageNumber: i + 1,
                    isZif: pageUrl.endsWith('.zif')
                });
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`   Failed to download page ${i + 1}: ${error.message}`);
            }
        }
        
        if (downloadedPages.length === 0) {
            throw new Error('No pages could be downloaded');
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
        
        if (uniquePages < downloadedPages.length * 0.8) {
            console.warn('WARNING: Many duplicate pages detected! This might indicate the page extraction is not working correctly.');
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
        
        // Check if we're getting high resolution
        if (parseFloat(megapixels) < 2) {
            console.warn('WARNING: Low resolution detected! Morgan Library should provide higher resolution images.');
        }
        
        console.log('\n✅ Test passed!');
        console.log(`Summary:`);
        console.log(`- Total pages in manuscript: ${manifest.totalPages}`);
        console.log(`- Pages downloaded: ${downloadedPages.length}`);
        console.log(`- Unique pages: ${uniquePages}`);
        console.log(`- Average resolution: ${Math.round(avgWidth)}x${Math.round(avgHeight)} (${megapixels} MP)`);
        console.log(`- PDF size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
        console.log(`- URL types: ${zifUrls} ZIF, ${highResUrls} high-res, ${standardUrls} standard`);
        
        return {
            success: true,
            manuscript: manuscript.name,
            totalPages: manifest.totalPages,
            downloadedPages: downloadedPages.length,
            uniquePages,
            averageResolution: `${Math.round(avgWidth)}x${Math.round(avgHeight)}`,
            megapixels: parseFloat(megapixels),
            pdfPath,
            pdfSizeMB: parseFloat((pdfBytes.length / 1024 / 1024).toFixed(2)),
            urlTypes: { zif: zifUrls, highRes: highResUrls, standard: standardUrls }
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
    console.log('Morgan Library Test Suite');
    console.log('========================');
    console.log(`Output directory: ${OUTPUT_DIR}`);
    console.log('\nNOTE: This test validates the fix for Morgan Library page extraction.');
    console.log('Previously only 16 pages were extracted, now all pages should be found.\n');
    
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
            console.log(`   Resolution: ${result.averageResolution} (${result.megapixels} MP)`);
            console.log(`   PDF: ${result.pdfSizeMB} MB`);
            if (result.urlTypes) {
                console.log(`   URLs: ${result.urlTypes.zif} ZIF, ${result.urlTypes.highRes} high-res, ${result.urlTypes.standard} standard`);
            }
        } else {
            console.log(`   Error: ${result.error}`);
        }
    });
    
    console.log(`\nTotal: ${results.length} tests, ${passed} passed, ${failed} failed`);
    
    // Save results
    const reportPath = path.join(OUTPUT_DIR, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        library: 'Morgan Library',
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