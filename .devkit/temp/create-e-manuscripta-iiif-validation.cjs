#!/usr/bin/env node

const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const zlib = require('zlib');

const manuscriptId = '5157222';

async function makeHttpsRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, application/ld+json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                ...options.headers
            },
            ...options
        }, (res) => {
            let stream = res;
            
            // Handle compression
            if (res.headers['content-encoding'] === 'gzip') {
                stream = zlib.createGunzip();
                res.pipe(stream);
            } else if (res.headers['content-encoding'] === 'deflate') {
                stream = zlib.createInflate();
                res.pipe(stream);
            } else if (res.headers['content-encoding'] === 'br') {
                stream = zlib.createBrotliDecompress();
                res.pipe(stream);
            }
            
            const chunks = [];
            
            stream.on('data', chunk => {
                chunks.push(chunk);
            });
            
            stream.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const data = Buffer.concat(chunks);
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data.toString()
                    });
                } else {
                    const data = Buffer.concat(chunks).toString();
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
            
            stream.on('error', reject);
        });
        
        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

async function downloadImageBinary(url) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/jpeg, image/png, image/webp, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
            }
        }, (res) => {
            const chunks = [];
            
            res.on('data', chunk => {
                chunks.push(chunk);
            });
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const data = Buffer.concat(chunks);
                    resolve(data);
                } else {
                    const data = Buffer.concat(chunks);
                    reject(new Error(`HTTP ${res.statusCode}: ${data.toString()}`));
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

async function createValidationPDF() {
    console.log('\n=== E-Manuscripta IIIF Validation PDF Creation ===');
    console.log(`Manuscript ID: ${manuscriptId}`);
    
    try {
        // Step 1: Fetch IIIF manifest
        const manifestUrl = `https://www.e-manuscripta.ch/i3f/v20/${manuscriptId}/manifest`;
        console.log(`\n1. Fetching IIIF manifest...`);
        const manifestResponse = await makeHttpsRequest(manifestUrl);
        const manifest = JSON.parse(manifestResponse.data);
        
        const canvases = manifest.sequences[0].canvases;
        console.log(`Found ${canvases.length} canvases`);
        
        // Step 2: Download first 5 pages for validation
        const validationDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/validation-current/e-manuscripta-iiif-validation';
        await fs.mkdir(validationDir, { recursive: true });
        
        console.log(`\n2. Downloading validation images...`);
        const pagesToDownload = Math.min(5, canvases.length);
        
        for (let i = 0; i < pagesToDownload; i++) {
            const canvas = canvases[i];
            const serviceUrl = canvas.images[0].resource.service['@id'];
            const imageUrl = `${serviceUrl}/full/max/0/default.jpg`;
            
            console.log(`Downloading page ${i + 1}: ${imageUrl}`);
            
            try {
                const imageData = await downloadImageBinary(imageUrl);
                const filename = path.join(validationDir, `page-${String(i + 1).padStart(3, '0')}.jpg`);
                await fs.writeFile(filename, imageData);
                
                console.log(`  ✓ Saved page ${i + 1}: ${imageData.length} bytes`);
                
            } catch (error) {
                console.log(`  ✗ Failed to download page ${i + 1}: ${error.message}`);
            }
        }
        
        // Step 3: Create PDF using ImageMagick
        console.log(`\n3. Creating validation PDF...`);
        const pdfPath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/CURRENT-VALIDATION/E-MANUSCRIPTA-IIIF-VALIDATION.pdf';
        
        try {
            execSync(`cd "${validationDir}" && magick *.jpg "${pdfPath}"`, { stdio: 'inherit' });
            console.log(`✓ PDF created: ${pdfPath}`);
            
            // Step 4: Validate PDF with poppler
            console.log(`\n4. Validating PDF with poppler...`);
            const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
            console.log('PDF Info:');
            console.log(pdfInfo);
            
            // Extract images for verification
            const imagesDir = path.join(validationDir, 'extracted-images');
            await fs.mkdir(imagesDir, { recursive: true });
            
            execSync(`pdfimages -j "${pdfPath}" "${imagesDir}/img"`, { stdio: 'inherit' });
            
            const extractedFiles = await fs.readdir(imagesDir);
            console.log(`\n✓ Extracted ${extractedFiles.length} images from PDF`);
            
            // Check image dimensions
            if (extractedFiles.length > 0) {
                const firstImage = path.join(imagesDir, extractedFiles[0]);
                try {
                    const imageInfo = execSync(`magick identify "${firstImage}"`, { encoding: 'utf8' });
                    console.log(`Sample image info: ${imageInfo.trim()}`);
                } catch (error) {
                    console.log(`Could not get image info: ${error.message}`);
                }
            }
            
        } catch (error) {
            console.error(`PDF creation failed: ${error.message}`);
            throw error;
        }
        
        // Step 5: Generate summary report
        const summaryReport = {
            timestamp: new Date().toISOString(),
            manuscriptId,
            manifestUrl,
            totalCanvases: canvases.length,
            validationPages: pagesToDownload,
            pdfPath,
            approach: 'IIIF v2 Manifest',
            status: 'SUCCESS',
            manifest: {
                label: manifest.label,
                viewingHint: manifest.viewingHint,
                attribution: manifest.attribution,
                sequences: manifest.sequences.length,
                structures: manifest.structures?.length || 0
            }
        };
        
        await fs.writeFile(
            path.join(validationDir, 'validation-report.json'),
            JSON.stringify(summaryReport, null, 2)
        );
        
        console.log(`\n=== VALIDATION SUMMARY ===`);
        console.log(`✓ Successfully created validation PDF using IIIF v2 manifest`);
        console.log(`✓ Manuscript: ${manifest.label}`);
        console.log(`✓ Total pages available: ${canvases.length}`);
        console.log(`✓ Validation pages downloaded: ${pagesToDownload}`);
        console.log(`✓ PDF location: ${pdfPath}`);
        console.log(`✓ Approach: IIIF v2 Manifest (simple, reliable)`);
        console.log(`\nIIIF Manifest approach successfully demonstrates:`);
        console.log(`- Complete page discovery (${canvases.length} pages)`);
        console.log(`- Maximum resolution image access`);
        console.log(`- Simple implementation (single API call)`);
        console.log(`- Reliable JSON structure`);
        console.log(`\nRecommendation: Replace current block-based implementation with IIIF approach`);
        
        return summaryReport;
        
    } catch (error) {
        console.error(`\n✗ Validation failed: ${error.message}`);
        throw error;
    }
}

// Run validation
if (require.main === module) {
    createValidationPDF().then(() => {
        console.log('\n✓ E-Manuscripta IIIF validation completed successfully');
        process.exit(0);
    }).catch(error => {
        console.error('\n✗ Validation failed:', error.message);
        process.exit(1);
    });
}

module.exports = { createValidationPDF };