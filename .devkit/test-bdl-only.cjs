#!/usr/bin/env node

const { promises: fs } = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { PDFDocument } = require('pdf-lib');
const https = require('https');

const VALIDATION_FOLDER = path.join(__dirname, 'bdl-test-results');

class BDLTester {
    constructor() {
        this.results = [];
    }

    async init() {
        await fs.mkdir(VALIDATION_FOLDER, { recursive: true });
        console.log(`Created validation folder: ${VALIDATION_FOLDER}`);
    }

    async fetchWithRetry(url, options = {}, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                return await this.fetchUrl(url, options);
            } catch (error) {
                if (i === retries - 1) throw error;
                console.log(`  Retry ${i + 1}/${retries} after error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
            }
        }
    }

    async fetchUrl(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const requestOptions = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': options.headers?.Accept || '*/*',
                    ...options.headers
                },
                timeout: 30000
            };

            const req = https.request(requestOptions, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = new URL(res.headers.location, url).href;
                    this.fetchUrl(redirectUrl, options).then(resolve).catch(reject);
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

    async getBDLManifest(url) {
        const match = url.match(/BDL-OGGETTO-(\d+)/);
        if (!match) throw new Error('Invalid BDL URL');
        
        const objectId = match[1];
        console.log(`    BDL: objectId=${objectId}`);
        
        // Use the BookReader API endpoint
        const apiUrl = `https://www.bdl.servizirl.it/bdl/public/rest/json/item/${objectId}/bookreader/pages`;
        console.log(`    Fetching BDL API: ${apiUrl}`);
        
        const response = await this.fetchWithRetry(apiUrl);
        if (!response.ok) throw new Error(`Failed to fetch BDL API: ${response.status}`);
        
        const data = await response.json();
        const images = [];
        
        console.log(`    Found ${data.length} pages in BDL API response`);
        
        // Extract first 10 pages with IIIF URLs
        for (let i = 0; i < Math.min(data.length, 10); i++) {
            const page = data[i];
            if (page.idMediaServer) {
                // Use the IIIF cantaloupe endpoint with double slash - standard IIIF works!
                const imageUrl = `https://www.bdl.servizirl.it/cantaloupe//iiif/2/${page.idMediaServer}/full/max/0/default.jpg`;
                images.push({
                    url: imageUrl,
                    label: `Page ${i + 1}`
                });
            }
        }
        
        return { images };
    }

    async testBDL() {
        console.log('\n=== Testing BDL Servizirl ===');
        const url = 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903';
        console.log(`URL: ${url}`);
        
        const libraryFolder = path.join(VALIDATION_FOLDER, 'BDL_Servizirl');
        await fs.mkdir(libraryFolder, { recursive: true });
        
        try {
            const manifest = await this.getBDLManifest(url);
            if (!manifest || !manifest.images || manifest.images.length === 0) {
                throw new Error('No images found in manifest');
            }

            console.log(`  Found ${manifest.images.length} pages in manifest`);
            
            console.log(`  Downloading first 3 pages for testing...`);
            const downloadedImages = [];
            
            for (let i = 0; i < Math.min(3, manifest.images.length); i++) {
                const image = manifest.images[i];
                console.log(`    Downloading page ${i + 1}/3: ${image.url}`);
                
                const response = await this.fetchWithRetry(image.url);
                if (!response.ok) {
                    throw new Error(`Failed to download image: ${response.status}`);
                }
                
                const buffer = await response.buffer();
                const imagePath = path.join(libraryFolder, `page_${String(i + 1).padStart(3, '0')}.jpg`);
                await fs.writeFile(imagePath, buffer);
                
                downloadedImages.push({
                    path: imagePath,
                    buffer: buffer
                });
                
                console.log(`      Downloaded: ${(buffer.length / 1024).toFixed(2)} KB`);
            }

            console.log(`  Creating PDF...`);
            const pdfDoc = await PDFDocument.create();
            
            for (const img of downloadedImages) {
                const jpgImage = await pdfDoc.embedJpg(img.buffer);
                const page = pdfDoc.addPage([jpgImage.width, jpgImage.height]);
                page.drawImage(jpgImage, {
                    x: 0,
                    y: 0,
                    width: jpgImage.width,
                    height: jpgImage.height
                });
            }

            const pdfBytes = await pdfDoc.save();
            const pdfPath = path.join(libraryFolder, 'BDL_Servizirl_test.pdf');
            await fs.writeFile(pdfPath, pdfBytes);
            
            console.log(`  PDF created: ${pdfPath}`);
            console.log(`  File size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Pages: ${pdfDoc.getPageCount()}`);

            console.log(`  ✅ BDL Servizirl test SUCCESS!`);
            
        } catch (error) {
            console.error(`  ❌ Error testing BDL: ${error.message}`);
            throw error;
        }
    }

    async run() {
        try {
            await this.init();
            await this.testBDL();
            
            console.log('\n=== BDL TEST COMPLETE ===');
            console.log(`Results in: ${VALIDATION_FOLDER}`);
            
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    }
}

const tester = new BDLTester();
tester.run().catch(console.error);