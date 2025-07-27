#!/usr/bin/env node

/**
 * University of Graz Test Script
 * Tests the University of Graz implementation with focus on timeout handling
 * Validates that large manuscripts can be downloaded without ETIMEDOUT errors
 */

const path = require('path');
const fs = require('fs');
const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');

const TEST_RESULTS_DIR = process.env.TEST_RESULTS_DIR || path.join(__dirname, 'test-results');
const TIMESTAMP = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
const OUTPUT_DIR = path.join(TEST_RESULTS_DIR, TIMESTAMP, 'graz-university');

// Test manuscripts
const TEST_MANUSCRIPTS = [
    {
        url: 'https://unipub.uni-graz.at/ubgmedea/singlepage/archive/objects/ubgmedea:52004/methods/ubgmedea:53072.jpg',
        name: 'MS 52004',
        expectedMinPages: 20,
        description: 'Large manuscript - tests timeout handling',
        testTimeout: true
    },
    {
        url: 'https://unipub.uni-graz.at/ubgmedea/singlepage/archive/objects/ubgmedea:50021/methods/ubgmedea:51089.jpg',
        name: 'MS 50021',
        expectedMinPages: 15,
        description: 'Secondary test manuscript'
    },
    {
        url: 'https://unipub.uni-graz.at/ubgmedea/singlepage/archive/objects/ubgmedea:49998/methods/ubgmedea:51066.jpg',
        name: 'MS 49998', 
        expectedMinPages: 10,
        description: 'Additional test manuscript'
    }
];

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function downloadImageWithTimeout(url, timeoutMs = 120000, retries = 3) {
    const https = require('https');
    
    for (let i = 0; i < retries; i++) {
        try {
            const startTime = Date.now();
            console.log(`   Downloading: ${url.split('/').pop()} (timeout: ${timeoutMs}ms)`);
            
            return await new Promise((resolve, reject) => {
                const chunks = [];
                let timedOut = false;
                
                const timeout = setTimeout(() => {
                    timedOut = true;
                    req.destroy();
                    reject(new Error(`ETIMEDOUT - Request timeout after ${timeoutMs}ms`));
                }, timeoutMs);
                
                const req = https.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'image/*'
                    },
                    timeout: timeoutMs  // Socket timeout
                }, (res) => {
                    if (timedOut) return;
                    
                    clearTimeout(timeout);
                    
                    if (res.statusCode !== 200) {
                        reject(new Error(`HTTP ${res.statusCode}`));
                        return;
                    }
                    
                    res.on('data', chunk => chunks.push(chunk));
                    res.on('end', () => {
                        if (!timedOut) {
                            const duration = Date.now() - startTime;
                            console.log(`   Downloaded in ${(duration / 1000).toFixed(1)}s`);
                            resolve(Buffer.concat(chunks));
                        }
                    });
                    res.on('error', reject);
                });
                
                req.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
                
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Socket timeout'));
                });
            });
        } catch (error) {
            const isTimeout = error.message.includes('ETIMEDOUT') || error.message.includes('timeout');
            console.log(`   Retry ${i + 1} after error: ${error.message}`);
            
            if (i === retries - 1) {
                if (isTimeout) {
                    throw new Error(`Timeout error not fixed! Still getting: ${error.message}`);
                }
                throw error;
            }
            
            // Exponential backoff for retries
            const delay = Math.min(2000 * Math.pow(2, i), 10000);
            console.log(`   Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
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
        
        // Test timeout configuration
        console.log('\nTesting manifest loading with extended timeout...');
        const manifestStartTime = Date.now();
        
        const manifest = await loader.getGrazManifest(manuscript.url);
        
        const manifestDuration = Date.now() - manifestStartTime;
        console.log(`Manifest loaded in ${(manifestDuration / 1000).toFixed(1)}s`);
        
        console.log(`\nManifest loaded successfully:`);
        console.log(`- Display name: ${manifest.displayName}`);
        console.log(`- Total pages found: ${manifest.totalPages}`);
        console.log(`- Library: ${manifest.library}`);
        
        // Validate page count
        if (manifest.totalPages < manuscript.expectedMinPages) {
            throw new Error(`Expected at least ${manuscript.expectedMinPages} pages, but found only ${manifest.totalPages}`);
        }
        
        // Test resolution URLs
        console.log('\nChecking image URL patterns...');
        const firstPageUrl = manifest.pageLinks[0];
        console.log(`First page URL: ${firstPageUrl}`);
        
        // Check if using IIIF pattern
        if (firstPageUrl.includes('/full/full/')) {
            console.log('✅ Using IIIF maximum resolution pattern');
        } else if (firstPageUrl.includes('/full/max/')) {
            console.log('✅ Using IIIF max size pattern');
        } else {
            console.log('⚠️  Not using IIIF resolution pattern');
        }
        
        // Download sample pages with timeout testing
        const pagesToDownload = Math.min(5, manifest.totalPages); // Fewer pages due to slow server
        console.log(`\nDownloading ${pagesToDownload} sample pages...`);
        
        const downloadedPages = [];
        let timeoutErrors = 0;
        
        for (let i = 0; i < pagesToDownload; i++) {
            try {
                // Test with extended timeout (120 seconds as configured in SharedManifestLoaders)
                const timeoutMs = manuscript.testTimeout && i === 0 ? 120000 : 60000;
                
                const imageBuffer = await downloadImageWithTimeout(
                    manifest.pageLinks[i], 
                    timeoutMs,
                    3  // retries
                );
                
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
                
                // Rate limiting to avoid overwhelming slow server
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`   Failed to download page ${i + 1}: ${error.message}`);
                if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
                    timeoutErrors++;
                }
            }
        }
        
        if (downloadedPages.length === 0) {
            throw new Error('No pages could be downloaded');
        }
        
        if (timeoutErrors > 0) {
            throw new Error(`Timeout errors still occurring! ${timeoutErrors} pages failed with timeout.`);
        }
        
        // Verify pages are different
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
        console.log(`- Timeout errors: ${timeoutErrors} (should be 0)`);
        
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
            timeoutErrors
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
    console.log('University of Graz Test Suite');
    console.log('============================');
    console.log(`Output directory: ${OUTPUT_DIR}`);
    console.log('\nNOTE: This test validates the timeout fix for University of Graz.');
    console.log('The server is known to be slow, requiring extended timeouts (120s).\n');
    
    const results = [];
    
    for (const manuscript of TEST_MANUSCRIPTS) {
        const result = await testManuscript(manuscript);
        results.push(result);
        
        // Add longer delay for Graz due to slow server
        if (manuscript !== TEST_MANUSCRIPTS[TEST_MANUSCRIPTS.length - 1]) {
            console.log('\nWaiting 10 seconds before next test (slow server)...');
            await new Promise(resolve => setTimeout(resolve, 10000));
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
            console.log(`   Timeouts: ${result.timeoutErrors === 0 ? '✅ None' : `❌ ${result.timeoutErrors} errors`}`);
        } else {
            console.log(`   Error: ${result.error}`);
        }
    });
    
    console.log(`\nTotal: ${results.length} tests, ${passed} passed, ${failed} failed`);
    
    // Check for timeout issues specifically
    const anyTimeouts = results.some(r => r.timeoutErrors && r.timeoutErrors > 0);
    if (anyTimeouts) {
        console.log('\n⚠️  WARNING: Timeout errors still occurring despite fixes!');
    }
    
    // Save results
    const reportPath = path.join(OUTPUT_DIR, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        library: 'University of Graz',
        totalTests: results.length,
        passed,
        failed,
        results,
        timeoutFixed: !anyTimeouts
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