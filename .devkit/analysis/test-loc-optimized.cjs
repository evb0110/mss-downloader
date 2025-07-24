const fs = require('fs');
const path = require('path');
const https = require('https');
const { PDFDocument, rgb } = require('pdf-lib');

// Test URLs
const testUrls = [
    'https://www.loc.gov/item/48040441/', // Original problematic manuscript
    'https://www.loc.gov/item/2021667393/', // Another LOC manuscript
];

// Optimized concurrent download manager
class OptimizedDownloadManager {
    constructor(maxConcurrent = 8) { // Using LOC optimal concurrency
        this.maxConcurrent = maxConcurrent;
        this.activeDownloads = 0;
        this.queue = [];
        this.results = [];
        this.errors = [];
        this.totalBytes = 0;
        this.startTime = Date.now();
    }

    async downloadImage(url, index) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let chunks = [];
            
            const req = https.get(url, {
                timeout: 36000, // 36 seconds per LOC timeout multiplier
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    const data = Buffer.concat(chunks);
                    const elapsed = (Date.now() - startTime) / 1000;
                    this.totalBytes += data.length;
                    
                    resolve({
                        index,
                        data,
                        elapsed,
                        size: data.length
                    });
                });
                res.on('error', reject);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
            req.on('error', reject);
        });
    }

    async processQueue() {
        while (this.queue.length > 0 && this.activeDownloads < this.maxConcurrent) {
            const task = this.queue.shift();
            this.activeDownloads++;
            
            task()
                .then(result => {
                    this.results.push(result);
                    this.activeDownloads--;
                    
                    // Progress update
                    const progress = ((this.results.length + this.errors.length) / this.totalTasks * 100).toFixed(1);
                    const elapsed = (Date.now() - this.startTime) / 1000;
                    const speedMBps = (this.totalBytes / elapsed / 1024 / 1024).toFixed(2);
                    
                    if (this.results.length % 10 === 0) {
                        console.log(`Progress: ${progress}% | Speed: ${speedMBps} MB/s | Downloaded: ${this.results.length} pages`);
                    }
                    
                    this.processQueue();
                })
                .catch(err => {
                    this.errors.push(err);
                    this.activeDownloads--;
                    this.processQueue();
                });
        }
    }

    async downloadAll(urls) {
        this.totalTasks = urls.length;
        
        // Queue all downloads
        urls.forEach((url, index) => {
            this.queue.push(() => this.downloadImage(url, index));
        });
        
        // Start processing
        this.processQueue();
        
        // Wait for completion
        while (this.activeDownloads > 0 || this.queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return {
            results: this.results,
            errors: this.errors,
            totalBytes: this.totalBytes,
            elapsed: (Date.now() - this.startTime) / 1000
        };
    }
}

// Fetch LOC manifest
async function fetchManifest(url) {
    const itemMatch = url.match(/\/item\/([^/?]+)/);
    if (!itemMatch) throw new Error('Invalid LOC URL');
    
    const manifestUrl = `https://www.loc.gov/item/${itemMatch[1]}/manifest.json`;
    
    return new Promise((resolve, reject) => {
        https.get(manifestUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const manifest = JSON.parse(data);
                    const pageLinks = [];
                    
                    if (manifest.sequences?.[0]?.canvases) {
                        for (const canvas of manifest.sequences[0].canvases) {
                            const serviceId = canvas.images?.[0]?.resource?.service?.['@id'];
                            if (serviceId) {
                                pageLinks.push(`${serviceId}/full/full/0/default.jpg`);
                            }
                        }
                    }
                    
                    resolve({
                        displayName: manifest.label || 'LOC Manuscript',
                        totalPages: pageLinks.length,
                        pageLinks
                    });
                } catch (e) {
                    reject(e);
                }
            });
            res.on('error', reject);
        });
    });
}

// Create PDF from images
async function createPDF(images, title) {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(title);
    pdfDoc.setProducer('MSS Downloader - LOC Optimized');
    
    for (const img of images) {
        try {
            const jpgImage = await pdfDoc.embedJpg(img.data);
            const page = pdfDoc.addPage([jpgImage.width, jpgImage.height]);
            page.drawImage(jpgImage, {
                x: 0,
                y: 0,
                width: jpgImage.width,
                height: jpgImage.height,
            });
        } catch (err) {
            console.warn(`Failed to embed image ${img.index}: ${err.message}`);
        }
    }
    
    return pdfDoc.save();
}

// Main test function
async function testOptimizedDownload(url, maxPages = 50) {
    console.log(`\n=== Testing: ${url} ===`);
    
    try {
        // Fetch manifest
        console.log('Fetching manifest...');
        const manifestStart = Date.now();
        const manifest = await fetchManifest(url);
        const manifestTime = (Date.now() - manifestStart) / 1000;
        
        console.log(`Title: ${manifest.displayName}`);
        console.log(`Total pages: ${manifest.totalPages}`);
        console.log(`Manifest fetch time: ${manifestTime.toFixed(1)}s`);
        
        // Download pages
        const pagesToDownload = Math.min(maxPages, manifest.totalPages);
        console.log(`\nDownloading ${pagesToDownload} pages with optimized settings...`);
        
        const manager = new OptimizedDownloadManager(8); // LOC optimal concurrency
        const downloadResult = await manager.downloadAll(manifest.pageLinks.slice(0, pagesToDownload));
        
        // Statistics
        const sizeMB = downloadResult.totalBytes / 1024 / 1024;
        const avgSpeed = sizeMB / downloadResult.elapsed;
        
        console.log(`\nDownload complete!`);
        console.log(`- Pages downloaded: ${downloadResult.results.length}/${pagesToDownload}`);
        console.log(`- Errors: ${downloadResult.errors.length}`);
        console.log(`- Total size: ${sizeMB.toFixed(2)}MB`);
        console.log(`- Total time: ${downloadResult.elapsed.toFixed(1)}s`);
        console.log(`- Average speed: ${avgSpeed.toFixed(2)} MB/s`);
        
        // Create PDF
        if (downloadResult.results.length > 0) {
            console.log('\nCreating PDF...');
            const pdfStart = Date.now();
            
            // Sort by index
            downloadResult.results.sort((a, b) => a.index - b.index);
            
            const pdfBytes = await createPDF(downloadResult.results, manifest.displayName);
            const pdfTime = (Date.now() - pdfStart) / 1000;
            
            // Save PDF
            const outputDir = path.join(__dirname, 'loc-optimized-output');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            
            const outputFile = path.join(outputDir, `${manifest.displayName.replace(/[^a-z0-9]/gi, '_')}.pdf`);
            fs.writeFileSync(outputFile, pdfBytes);
            
            console.log(`PDF created in ${pdfTime.toFixed(1)}s`);
            console.log(`Saved to: ${outputFile}`);
            console.log(`PDF size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)}MB`);
        }
        
        return {
            success: true,
            url,
            title: manifest.displayName,
            pages: downloadResult.results.length,
            sizeMB,
            elapsed: downloadResult.elapsed,
            speed: avgSpeed
        };
        
    } catch (error) {
        console.error(`Test failed: ${error.message}`);
        return {
            success: false,
            url,
            error: error.message
        };
    }
}

// Run tests
async function main() {
    console.log('=== Library of Congress Optimized Download Test ===');
    console.log('Using optimization: 8 concurrent downloads\n');
    
    const results = [];
    
    for (const url of testUrls) {
        const result = await testOptimizedDownload(url, 30); // Test 30 pages each
        results.push(result);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Summary
    console.log('\n\n=== FINAL SUMMARY ===');
    const successful = results.filter(r => r.success);
    
    if (successful.length > 0) {
        const avgSpeed = successful.reduce((sum, r) => sum + r.speed, 0) / successful.length;
        console.log(`✅ Success rate: ${successful.length}/${results.length}`);
        console.log(`📊 Average download speed: ${avgSpeed.toFixed(2)} MB/s`);
        console.log('\nManuscripts tested:');
        successful.forEach(r => {
            console.log(`- ${r.title}: ${r.pages} pages, ${r.sizeMB.toFixed(2)}MB @ ${r.speed.toFixed(2)} MB/s`);
        });
    } else {
        console.log('❌ All tests failed');
    }
}

main().catch(console.error);