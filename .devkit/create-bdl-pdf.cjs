#!/usr/bin/env node

const { promises: fs } = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { PDFDocument } = require('pdf-lib');
const https = require('https');

const VALIDATION_FOLDER = path.join(__dirname, 'validation-results/BDL-validation');

class BDLPDFCreator {
    constructor() {}

    async init() {
        await fs.mkdir(VALIDATION_FOLDER, { recursive: true });
        console.log(`Created validation folder: ${VALIDATION_FOLDER}`);
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
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
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

    async createBDLValidationPDF() {
        console.log('=== Creating BDL Validation PDF ===');
        
        try {
            // Get BDL API data
            const apiUrl = 'https://www.bdl.servizirl.it/bdl/public/rest/json/item/3903/bookreader/pages';
            console.log('Fetching BDL API data...');
            
            const response = await this.fetchUrl(apiUrl);
            if (!response.ok) throw new Error(`API failed: ${response.status}`);
            
            const data = await response.json();
            console.log(`Found ${data.length} pages in manuscript`);
            
            // Download first 5 pages only (faster validation)
            const pagesToDownload = Math.min(5, data.length);
            const downloadedImages = [];
            
            console.log(`Downloading ${pagesToDownload} pages for validation...`);
            
            for (let i = 0; i < pagesToDownload; i++) {
                const page = data[i];
                if (page.idMediaServer) {
                    const imageUrl = `https://www.bdl.servizirl.it/cantaloupe//iiif/2/${page.idMediaServer}/full/max/0/default.jpg`;
                    console.log(`  Page ${i + 1}: Downloading...`);
                    
                    const imageResponse = await this.fetchUrl(imageUrl);
                    if (!imageResponse.ok) {
                        console.log(`    Failed: ${imageResponse.status}`);
                        continue;
                    }
                    
                    const buffer = await imageResponse.buffer();
                    const imagePath = path.join(VALIDATION_FOLDER, `page_${String(i + 1).padStart(3, '0')}.jpg`);
                    await fs.writeFile(imagePath, buffer);
                    
                    downloadedImages.push({
                        path: imagePath,
                        buffer: buffer
                    });
                    
                    console.log(`    Downloaded: ${(buffer.length / 1024).toFixed(2)} KB`);
                }
            }

            if (downloadedImages.length === 0) {
                throw new Error('No images downloaded');
            }

            console.log(`Creating PDF from ${downloadedImages.length} images...`);
            const pdfDoc = await PDFDocument.create();
            
            for (const img of downloadedImages) {
                try {
                    const jpgImage = await pdfDoc.embedJpg(img.buffer);
                    const page = pdfDoc.addPage([jpgImage.width, jpgImage.height]);
                    page.drawImage(jpgImage, {
                        x: 0,
                        y: 0,
                        width: jpgImage.width,
                        height: jpgImage.height
                    });
                } catch (embedError) {
                    console.warn(`Warning: Could not process image: ${embedError.message}`);
                }
            }

            const pdfBytes = await pdfDoc.save();
            const pdfPath = path.join(VALIDATION_FOLDER, 'BDL_Servizirl_validation.pdf');
            await fs.writeFile(pdfPath, pdfBytes);
            
            console.log(`✅ PDF created successfully!`);
            console.log(`   Path: ${pdfPath}`);
            console.log(`   Pages: ${pdfDoc.getPageCount()}`);
            console.log(`   Size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);

            // Validate with poppler
            console.log('Validating PDF with poppler...');
            try {
                const popplerOutput = execSync(`pdfimages -list "${pdfPath}"`, { encoding: 'utf8' });
                console.log('✅ PDF validation passed');
                console.log('Image details:');
                console.log(popplerOutput);
            } catch (error) {
                console.error('❌ PDF validation failed:', error.message);
            }

            return pdfPath;
            
        } catch (error) {
            console.error(`❌ Error creating BDL PDF: ${error.message}`);
            throw error;
        }
    }

    async run() {
        try {
            await this.init();
            const pdfPath = await this.createBDLValidationPDF();
            
            console.log('\n=== BDL VALIDATION COMPLETE ===');
            console.log(`PDF ready for inspection: ${pdfPath}`);
            
            // Create a clean final folder with just the PDF
            const finalFolder = path.join(VALIDATION_FOLDER, '../BDL_FINAL_VALIDATION');
            await fs.mkdir(finalFolder, { recursive: true });
            
            const finalPdfPath = path.join(finalFolder, 'BDL_Servizirl_validation.pdf');
            await fs.copyFile(pdfPath, finalPdfPath);
            
            console.log(`Final PDF: ${finalPdfPath}`);
            
            // Open folder for user validation
            if (process.platform === 'darwin') {
                execSync(`open "${finalFolder}"`);
            }
            
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    }
}

const creator = new BDLPDFCreator();
creator.run().catch(console.error);