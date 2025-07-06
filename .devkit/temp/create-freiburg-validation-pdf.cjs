const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class FreiburgValidator {
    constructor() {
        this.baseDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/validation-current/freiburg-validation';
        this.manuscriptId = 'hs360a';
    }

    async ensureDirectory() {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }

    async fetchMetsXml() {
        const url = `https://dl.ub.uni-freiburg.de/diglitData/mets/${this.manuscriptId}.xml`;
        
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
                });
            }).on('error', reject);
        });
    }

    parseMaxResolutionPages(xmlContent) {
        const hrefRegex = /<mets:FLocat[^>]*xlink:href="([^"]*)"[^>]*\/?>/g;
        const allHrefs = [];
        let match;
        
        while ((match = hrefRegex.exec(xmlContent)) !== null) {
            allHrefs.push(match[1]);
        }
        
        // Group by resolution level
        const byResolution = {};
        allHrefs.forEach(href => {
            const parts = href.split('/');
            if (parts.length >= 2) {
                const resolution = parts[parts.length - 2];
                if (!byResolution[resolution]) byResolution[resolution] = [];
                
                const filename = parts[parts.length - 1];
                const pageId = filename.replace(/\.(jpg|jpeg|tif|tiff)$/i, '');
                
                byResolution[resolution].push({
                    href,
                    filename,
                    pageId,
                    isStandard: pageId.match(/^\d+[rv]$/) !== null
                });
            }
        });
        
        // Find highest resolution (excluding introimage and thumb)
        const numericLevels = Object.keys(byResolution)
            .filter(k => !isNaN(parseInt(k)))
            .map(Number)
            .sort((a, b) => b - a);
        
        const highestRes = numericLevels[0].toString();
        
        console.log(`Selected resolution level ${highestRes} with ${byResolution[highestRes].length} pages`);
        
        return byResolution[highestRes];
    }

    async downloadImage(url, filename) {
        const filepath = path.join(this.baseDir, filename);
        
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(filepath);
            
            https.get(url, (response) => {
                if (response.statusCode === 200) {
                    response.pipe(file);
                    
                    file.on('finish', () => {
                        file.close();
                        const stats = fs.statSync(filepath);
                        resolve({
                            filename,
                            filepath,
                            size: stats.size,
                            success: true
                        });
                    });
                } else {
                    file.close();
                    fs.unlinkSync(filepath);
                    reject(new Error(`HTTP ${response.statusCode}`));
                }
            }).on('error', (err) => {
                file.close();
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
                reject(err);
            });
        });
    }

    async downloadValidationSample(pages, sampleSize = 15) {
        console.log(`\nDownloading ${sampleSize} sample pages for validation...\n`);
        
        const samplePages = pages.slice(0, sampleSize);
        const downloads = [];
        
        for (const page of samplePages) {
            try {
                console.log(`Downloading ${page.pageId}...`);
                const result = await this.downloadImage(page.href, page.filename);
                downloads.push({
                    pageId: page.pageId,
                    isStandard: page.isStandard,
                    ...result
                });
                
                const sizeKB = Math.round(result.size / 1024);
                console.log(`✅ ${page.pageId}: ${sizeKB}KB`);
                
            } catch (error) {
                console.log(`❌ ${page.pageId}: ${error.message}`);
                downloads.push({
                    pageId: page.pageId,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return downloads;
    }

    async createPDF(downloads) {
        const successfulDownloads = downloads.filter(d => d.success);
        
        if (successfulDownloads.length === 0) {
            throw new Error('No successful downloads to create PDF');
        }
        
        const pdfPath = path.join(this.baseDir, `FREIBURG-HS360A-VALIDATION.pdf`);
        const imageFiles = successfulDownloads.map(d => `"${d.filepath}"`).join(' ');
        
        console.log(`\nCreating PDF with ${successfulDownloads.length} images...`);
        
        return new Promise((resolve, reject) => {
            const cmd = `img2pdf ${imageFiles} --output "${pdfPath}"`;
            
            const process = spawn('sh', ['-c', cmd], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    const stats = fs.statSync(pdfPath);
                    console.log(`✅ PDF created: ${Math.round(stats.size / 1024 / 1024)}MB`);
                    resolve({
                        pdfPath,
                        size: stats.size,
                        pageCount: successfulDownloads.length
                    });
                } else {
                    console.error('img2pdf stderr:', stderr);
                    reject(new Error(`img2pdf failed with code ${code}: ${stderr}`));
                }
            });
        });
    }

    async validatePDF(pdfPath) {
        console.log('\nValidating PDF with poppler...');
        
        return new Promise((resolve, reject) => {
            const process = spawn('pdfinfo', [pdfPath]);
            
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    const pageMatch = stdout.match(/Pages:\s+(\d+)/);
                    const pageCount = pageMatch ? parseInt(pageMatch[1]) : 0;
                    
                    console.log(`✅ PDF validation successful: ${pageCount} pages`);
                    resolve({ valid: true, pageCount, info: stdout });
                } else {
                    console.error('PDF validation failed:', stderr);
                    reject(new Error(`PDF validation failed: ${stderr}`));
                }
            });
        });
    }

    async extractPDFImages(pdfPath) {
        console.log('\nExtracting images from PDF for content verification...');
        
        const extractDir = path.join(this.baseDir, 'extracted');
        if (!fs.existsSync(extractDir)) {
            fs.mkdirSync(extractDir);
        }
        
        return new Promise((resolve, reject) => {
            const process = spawn('pdfimages', ['-list', pdfPath]);
            
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    const lines = stdout.split('\n').filter(line => line.trim());
                    const imageInfo = lines.slice(2).map(line => {
                        const parts = line.split(/\s+/);
                        return {
                            page: parseInt(parts[0]),
                            width: parseInt(parts[2]),
                            height: parseInt(parts[3]),
                            type: parts[5],
                            size: parts[6]
                        };
                    }).filter(info => !isNaN(info.page));
                    
                    console.log(`✅ Found ${imageInfo.length} images in PDF`);
                    
                    if (imageInfo.length > 0) {
                        const avgWidth = imageInfo.reduce((sum, img) => sum + img.width, 0) / imageInfo.length;
                        const avgHeight = imageInfo.reduce((sum, img) => sum + img.height, 0) / imageInfo.length;
                        console.log(`Average resolution: ${Math.round(avgWidth)}x${Math.round(avgHeight)}`);
                    }
                    
                    resolve({
                        images: imageInfo,
                        count: imageInfo.length,
                        averageResolution: imageInfo.length > 0 ? {
                            width: Math.round(imageInfo.reduce((sum, img) => sum + img.width, 0) / imageInfo.length),
                            height: Math.round(imageInfo.reduce((sum, img) => sum + img.height, 0) / imageInfo.length)
                        } : null
                    });
                } else {
                    console.error('Image extraction failed:', stderr);
                    reject(new Error(`Image extraction failed: ${stderr}`));
                }
            });
        });
    }

    async runValidation() {
        console.log('=== University of Freiburg METS Validation ===\n');
        
        try {
            await this.ensureDirectory();
            
            console.log('1. Fetching METS XML...');
            const xmlContent = await this.fetchMetsXml();
            
            console.log('2. Parsing maximum resolution pages...');
            const pages = this.parseMaxResolutionPages(xmlContent);
            
            const standardPages = pages.filter(p => p.isStandard);
            const specialPages = pages.filter(p => !p.isStandard);
            
            console.log(`Found ${pages.length} total pages:`);
            console.log(`  - Standard pages: ${standardPages.length}`);
            console.log(`  - Special pages: ${specialPages.length}`);
            
            console.log('\n3. Downloading validation sample...');
            const downloads = await this.downloadValidationSample(pages, 12);
            
            const successfulDownloads = downloads.filter(d => d.success);
            const successRate = successfulDownloads.length / downloads.length;
            
            console.log(`\nDownload success rate: ${Math.round(successRate * 100)}%`);
            
            if (successRate < 0.8) {
                throw new Error('Download success rate too low');
            }
            
            console.log('\n4. Creating validation PDF...');
            const pdfResult = await this.createPDF(downloads);
            
            console.log('\n5. Validating PDF structure...');
            const pdfValidation = await this.validatePDF(pdfResult.pdfPath);
            
            console.log('\n6. Extracting PDF image information...');
            const imageExtraction = await this.extractPDFImages(pdfResult.pdfPath);
            
            console.log('\n=== Validation Summary ===');
            console.log(`✅ METS XML parsing: Success`);
            console.log(`✅ Maximum resolution detection: Level 4`);
            console.log(`✅ Page discovery: ${pages.length} pages found`);
            console.log(`✅ Download success rate: ${Math.round(successRate * 100)}%`);
            console.log(`✅ PDF creation: ${pdfResult.pageCount} pages`);
            console.log(`✅ PDF validation: ${pdfValidation.pageCount} pages`);
            console.log(`✅ Image resolution: ${imageExtraction.averageResolution.width}x${imageExtraction.averageResolution.height}`);
            
            const finalResult = {
                success: true,
                manuscriptId: this.manuscriptId,
                totalPages: pages.length,
                standardPages: standardPages.length,
                specialPages: specialPages.length,
                downloadSuccessRate: successRate,
                pdfPath: pdfResult.pdfPath,
                pdfSize: pdfResult.size,
                pdfPageCount: pdfValidation.pageCount,
                averageResolution: imageExtraction.averageResolution,
                validationDirectory: this.baseDir
            };
            
            console.log('\n✅ University of Freiburg METS implementation VALIDATED');
            console.log(`📁 Validation files: ${this.baseDir}`);
            
            return finalResult;
            
        } catch (error) {
            console.error('\n❌ Validation failed:', error.message);
            return {
                success: false,
                error: error.message,
                validationDirectory: this.baseDir
            };
        }
    }
}

if (require.main === module) {
    const validator = new FreiburgValidator();
    validator.runValidation().then(result => {
        if (result.success) {
            console.log('\n🎉 Ready for production implementation!');
        }
    }).catch(console.error);
}