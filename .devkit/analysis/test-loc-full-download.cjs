const https = require('https');
const fs = require('fs');
const path = require('path');

const testUrl = 'https://www.loc.gov/item/48040441/';

class DownloadManager {
    constructor(maxConcurrent = 5) {
        this.maxConcurrent = maxConcurrent;
        this.activeDownloads = 0;
        this.queue = [];
        this.results = [];
        this.startTime = Date.now();
    }

    async downloadImage(url, index) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let downloadedSize = 0;
            let chunks = [];
            
            console.log(`[Page ${index + 1}] Starting download...`);
            
            const req = https.get(url, {
                timeout: 60000, // 60 seconds timeout
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, (res) => {
                const totalSize = parseInt(res.headers['content-length'] || '0');
                
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                    downloadedSize += chunk.length;
                });
                
                res.on('end', () => {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const sizeMB = downloadedSize / 1024 / 1024;
                    const speed = sizeMB / elapsed;
                    
                    console.log(`[Page ${index + 1}] Complete: ${sizeMB.toFixed(2)}MB in ${elapsed.toFixed(1)}s (${speed.toFixed(2)} MB/s)`);
                    
                    resolve({
                        index,
                        url,
                        sizeMB,
                        elapsed,
                        speed,
                        data: Buffer.concat(chunks)
                    });
                });
                
                res.on('error', (err) => {
                    console.error(`[Page ${index + 1}] Download error: ${err.message}`);
                    reject(err);
                });
            });
            
            req.on('timeout', () => {
                console.error(`[Page ${index + 1}] Request timeout after 60s`);
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.on('error', (err) => {
                console.error(`[Page ${index + 1}] Request error: ${err.message}`);
                reject(err);
            });
        });
    }

    async processQueue() {
        while (this.queue.length > 0 && this.activeDownloads < this.maxConcurrent) {
            const task = this.queue.shift();
            this.activeDownloads++;
            
            task().then(result => {
                this.results.push(result);
                this.activeDownloads--;
                this.processQueue();
            }).catch(err => {
                this.activeDownloads--;
                this.processQueue();
            });
        }
    }

    async downloadAll(urls) {
        // Queue all downloads
        urls.forEach((url, index) => {
            this.queue.push(() => this.downloadImage(url, index));
        });
        
        // Start processing
        this.processQueue();
        
        // Wait for all downloads to complete
        while (this.activeDownloads > 0 || this.queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return this.results;
    }
}

async function fetchManifest(url) {
    const itemMatch = url.match(/\/item\/([^/?]+)/);
    if (!itemMatch) throw new Error('Invalid LOC URL');
    
    const manifestUrl = `https://www.loc.gov/item/${itemMatch[1]}/manifest.json`;
    
    return new Promise((resolve, reject) => {
        https.get(manifestUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const manifest = JSON.parse(data);
                    const pageLinks = [];
                    
                    if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                        const canvases = manifest.sequences[0].canvases;
                        
                        for (const canvas of canvases) {
                            if (canvas.images && canvas.images[0]) {
                                const image = canvas.images[0];
                                if (image.resource && image.resource.service && image.resource.service['@id']) {
                                    const serviceId = image.resource.service['@id'];
                                    const maxResUrl = `${serviceId}/full/full/0/default.jpg`;
                                    pageLinks.push(maxResUrl);
                                }
                            }
                        }
                    }
                    
                    resolve({
                        displayName: manifest.label || 'Library of Congress Manuscript',
                        totalPages: pageLinks.length,
                        pageLinks
                    });
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function testFullDownload() {
    try {
        console.log('=== Library of Congress Full Download Test ===');
        console.log(`URL: ${testUrl}\n`);
        
        // Fetch manifest
        console.log('Fetching manifest...');
        const manifestStart = Date.now();
        const manifest = await fetchManifest(testUrl);
        const manifestTime = (Date.now() - manifestStart) / 1000;
        
        console.log(`Manifest loaded in ${manifestTime.toFixed(1)}s`);
        console.log(`Title: ${manifest.displayName}`);
        console.log(`Total pages: ${manifest.totalPages}\n`);
        
        // Test different concurrent download limits
        const concurrencyTests = [1, 3, 5, 10];
        
        for (const concurrency of concurrencyTests) {
            console.log(`\n=== Testing with ${concurrency} concurrent downloads ===`);
            console.log('Downloading first 20 pages...\n');
            
            const pagesToTest = Math.min(20, manifest.pageLinks.length);
            const testUrls = manifest.pageLinks.slice(0, pagesToTest);
            
            const manager = new DownloadManager(concurrency);
            const startTime = Date.now();
            
            try {
                const results = await manager.downloadAll(testUrls);
                const totalTime = (Date.now() - startTime) / 1000;
                
                // Calculate statistics
                const successCount = results.length;
                const totalSize = results.reduce((sum, r) => sum + r.sizeMB, 0);
                const avgSpeed = totalSize / totalTime;
                const avgPageTime = totalTime / successCount;
                
                console.log(`\nResults for ${concurrency} concurrent downloads:`);
                console.log(`- Pages downloaded: ${successCount}/${pagesToTest}`);
                console.log(`- Total time: ${totalTime.toFixed(1)}s`);
                console.log(`- Total size: ${totalSize.toFixed(2)}MB`);
                console.log(`- Average speed: ${avgSpeed.toFixed(2)} MB/s`);
                console.log(`- Average time per page: ${avgPageTime.toFixed(1)}s`);
                
                // Save a sample page for verification
                if (results.length > 0 && concurrency === concurrencyTests[0]) {
                    const outputDir = path.join(__dirname, 'loc-test-output');
                    if (!fs.existsSync(outputDir)) {
                        fs.mkdirSync(outputDir, { recursive: true });
                    }
                    
                    const sampleFile = path.join(outputDir, 'sample_page.jpg');
                    fs.writeFileSync(sampleFile, results[0].data);
                    console.log(`\nSample page saved to: ${sampleFile}`);
                }
                
            } catch (error) {
                console.error(`Test failed with ${concurrency} concurrent downloads:`, error.message);
            }
            
            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
        console.error(error.stack);
    }
}

testFullDownload();