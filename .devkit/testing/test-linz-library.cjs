/**
 * Test script for Linz library (Oberösterreichische Landesbibliothek) integration
 * Issue #25 - Add new library
 */

const { LinzLoader } = require('../../src/main/services/library-loaders/LinzLoader');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const { PDFDocument } = require('pdf-lib');

// Mock dependencies for testing
const mockDeps = {
    fetchDirect: async (url, options = {}) => {
        const response = await axios.get(url, {
            headers: options.headers || {},
            responseType: 'json',
            validateStatus: () => true
        });
        return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            statusText: response.statusText,
            json: async () => response.data,
            text: async () => JSON.stringify(response.data),
            headers: {
                get: (name) => response.headers[name.toLowerCase()]
            }
        };
    }
};

async function downloadImage(url, filepath) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        await fs.writeFile(filepath, response.data);
        return true;
    } catch (error) {
        console.error(`Failed to download ${url}: ${error.message}`);
        return false;
    }
}

async function testLinzLibrary() {
    console.log('=== Testing Linz Library (Oberösterreichische Landesbibliothek) ===\n');
    
    const testCases = [
        {
            name: 'MS 116 - Breviarium',
            url: 'https://digi.landesbibliothek.at/viewer/image/116/',
            expectedId: '116',
            downloadPages: [1, 2, 3, 10, 50]
        },
        {
            name: 'MS 254 - Latin collection',
            url: 'https://digi.landesbibliothek.at/viewer/image/254/',
            expectedId: '254',
            downloadPages: [1, 2, 5]
        },
        {
            name: 'MS 279 - Kochbuch 1846',
            url: 'https://digi.landesbibliothek.at/viewer/image/279/',
            expectedId: '279',
            downloadPages: [1, 2, 3]
        },
        {
            name: 'MS 1194 - Artzneybuech',
            url: 'https://digi.landesbibliothek.at/viewer/image/1194/',
            expectedId: '1194',
            downloadPages: [1, 2]
        }
    ];
    
    const loader = new LinzLoader(mockDeps);
    const testDir = path.join(__dirname, 'linz-test-output');
    await fs.mkdir(testDir, { recursive: true });
    
    const results = [];
    
    for (const testCase of testCases) {
        console.log(`\nTesting: ${testCase.name}`);
        console.log(`URL: ${testCase.url}`);
        
        const startTime = Date.now();
        let result = {
            name: testCase.name,
            url: testCase.url,
            success: false,
            pages: 0,
            downloadedPages: 0,
            pdfCreated: false,
            errors: []
        };
        
        try {
            // Load manifest
            console.log('Loading manifest...');
            const manifest = await loader.loadManifest(testCase.url);
            
            console.log(`✓ Manifest loaded: ${manifest.displayName}`);
            console.log(`  Total pages: ${manifest.totalPages}`);
            console.log(`  Library: ${manifest.library}`);
            
            result.pages = manifest.totalPages;
            
            // Validate manifest structure
            if (!manifest.pageLinks || manifest.pageLinks.length === 0) {
                throw new Error('No page links found in manifest');
            }
            
            if (manifest.library !== 'linz') {
                throw new Error(`Incorrect library: expected 'linz', got '${manifest.library}'`);
            }
            
            // Download sample pages
            const pagesToDownload = testCase.downloadPages.filter(p => p <= manifest.totalPages);
            const downloadedImages = [];
            
            console.log(`\nDownloading ${pagesToDownload.length} sample pages...`);
            for (const pageNum of pagesToDownload) {
                const imageUrl = manifest.pageLinks[pageNum - 1];
                const filename = `${testCase.expectedId}_page_${pageNum}.jpg`;
                const filepath = path.join(testDir, filename);
                
                console.log(`  Downloading page ${pageNum}...`);
                const success = await downloadImage(imageUrl, filepath);
                
                if (success) {
                    const stats = await fs.stat(filepath);
                    console.log(`    ✓ Page ${pageNum} downloaded (${(stats.size / 1024).toFixed(1)} KB)`);
                    downloadedImages.push(filepath);
                    result.downloadedPages++;
                } else {
                    console.log(`    ✗ Page ${pageNum} failed`);
                    result.errors.push(`Failed to download page ${pageNum}`);
                }
            }
            
            // Create a test PDF with downloaded pages
            if (downloadedImages.length > 0) {
                console.log('\nCreating test PDF...');
                const pdfDoc = await PDFDocument.create();
                
                for (const imagePath of downloadedImages) {
                    try {
                        const imageBytes = await fs.readFile(imagePath);
                        const image = await pdfDoc.embedJpg(imageBytes);
                        const page = pdfDoc.addPage([image.width, image.height]);
                        page.drawImage(image, {
                            x: 0,
                            y: 0,
                            width: image.width,
                            height: image.height
                        });
                    } catch (err) {
                        console.warn(`  Warning: Could not add image to PDF: ${err.message}`);
                    }
                }
                
                const pdfBytes = await pdfDoc.save();
                const pdfPath = path.join(testDir, `${testCase.expectedId}_test.pdf`);
                await fs.writeFile(pdfPath, pdfBytes);
                
                const pdfStats = await fs.stat(pdfPath);
                console.log(`  ✓ PDF created: ${pdfPath} (${(pdfStats.size / 1024 / 1024).toFixed(2)} MB)`);
                result.pdfCreated = true;
            }
            
            result.success = result.downloadedPages > 0;
            const duration = Date.now() - startTime;
            console.log(`\n✓ Test completed in ${(duration / 1000).toFixed(1)}s`);
            
        } catch (error) {
            console.error(`\n✗ Test failed: ${error.message}`);
            result.errors.push(error.message);
        }
        
        results.push(result);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    
    for (const result of results) {
        const status = result.success ? '✓' : '✗';
        console.log(`\n${status} ${result.name}`);
        console.log(`  Pages found: ${result.pages}`);
        console.log(`  Pages downloaded: ${result.downloadedPages}`);
        console.log(`  PDF created: ${result.pdfCreated ? 'Yes' : 'No'}`);
        if (result.errors.length > 0) {
            console.log(`  Errors: ${result.errors.join(', ')}`);
        }
    }
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    const overallSuccess = successCount === totalCount;
    
    console.log('\n' + '='.repeat(60));
    console.log(`OVERALL: ${successCount}/${totalCount} tests passed`);
    console.log(`Test output saved to: ${testDir}`);
    console.log('='.repeat(60));
    
    return overallSuccess ? 'ok' : 'failed';
}

// Run the test
testLinzLibrary()
    .then(result => {
        console.log(`\nFinal result: ${result}`);
        process.exit(result === 'ok' ? 0 : 1);
    })
    .catch(error => {
        console.error('Test script error:', error);
        process.exit(1);
    });