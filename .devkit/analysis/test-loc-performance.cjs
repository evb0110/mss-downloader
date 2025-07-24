const fs = require('fs');
const path = require('path');
const https = require('https');

const testUrl = 'https://www.loc.gov/item/48040441/';

// Inline LOC manifest fetcher
async function getLibraryOfCongressManifest(url) {
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

async function downloadImage(url, fileName) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log(`Starting download: ${fileName}`);
        
        const file = fs.createWriteStream(fileName);
        https.get(url, {
            timeout: 300000, // 5 minutes timeout
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        }, (response) => {
            const totalSize = parseInt(response.headers['content-length'] || '0');
            let downloadedSize = 0;
            let lastProgressReport = Date.now();
            
            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                file.write(chunk);
                
                // Report progress every 5 seconds
                if (Date.now() - lastProgressReport > 5000) {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const speed = downloadedSize / elapsed / 1024 / 1024; // MB/s
                    const progress = totalSize > 0 ? (downloadedSize / totalSize * 100).toFixed(1) : '?';
                    console.log(`${fileName}: ${progress}% downloaded, Speed: ${speed.toFixed(2)} MB/s, Elapsed: ${elapsed.toFixed(0)}s`);
                    lastProgressReport = Date.now();
                }
            });
            
            response.on('end', () => {
                file.end();
                const elapsed = (Date.now() - startTime) / 1000;
                const sizeMB = downloadedSize / 1024 / 1024;
                const speed = sizeMB / elapsed;
                console.log(`${fileName}: Download complete! Size: ${sizeMB.toFixed(2)}MB, Time: ${elapsed.toFixed(1)}s, Avg Speed: ${speed.toFixed(2)} MB/s`);
                resolve({ fileName, elapsed, sizeMB, speed });
            });
            
            response.on('error', reject);
        }).on('error', reject);
        
        file.on('error', reject);
    });
}

async function testPerformance() {
    try {
        console.log('Testing Library of Congress download performance...');
        console.log(`URL: ${testUrl}\n`);
        
        // Fetch manifest
        console.log('Fetching manifest...');
        const manifestStart = Date.now();
        const manifest = await getLibraryOfCongressManifest(testUrl);
        const manifestTime = (Date.now() - manifestStart) / 1000;
        console.log(`Manifest fetched in ${manifestTime.toFixed(1)}s`);
        console.log(`Title: ${manifest.displayName}`);
        console.log(`Total pages: ${manifest.totalPages}\n`);
        
        // Create test directory
        const testDir = path.join(__dirname, 'loc-performance-test');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        
        // Test downloading first 3 pages
        console.log('Testing download of first 3 pages...\n');
        const results = [];
        
        for (let i = 0; i < Math.min(3, manifest.pageLinks.length); i++) {
            const url = manifest.pageLinks[i];
            const fileName = path.join(testDir, `page_${i + 1}.jpg`);
            
            try {
                const result = await downloadImage(url, fileName);
                results.push(result);
            } catch (error) {
                console.error(`Failed to download page ${i + 1}: ${error.message}`);
            }
            
            console.log(''); // Empty line between downloads
        }
        
        // Summary
        console.log('\n=== PERFORMANCE SUMMARY ===');
        console.log(`Manifest fetch time: ${manifestTime.toFixed(1)}s`);
        
        if (results.length > 0) {
            const totalTime = results.reduce((sum, r) => sum + r.elapsed, 0);
            const totalSize = results.reduce((sum, r) => sum + r.sizeMB, 0);
            const avgSpeed = totalSize / totalTime;
            
            console.log(`Pages downloaded: ${results.length}`);
            console.log(`Total download time: ${totalTime.toFixed(1)}s`);
            console.log(`Total size: ${totalSize.toFixed(2)}MB`);
            console.log(`Average speed: ${avgSpeed.toFixed(2)} MB/s`);
            
            console.log('\nPer-page breakdown:');
            results.forEach((r, i) => {
                console.log(`  Page ${i + 1}: ${r.sizeMB.toFixed(2)}MB in ${r.elapsed.toFixed(1)}s (${r.speed.toFixed(2)} MB/s)`);
            });
        }
        
        console.log(`\nTest files saved to: ${testDir}`);
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testPerformance();