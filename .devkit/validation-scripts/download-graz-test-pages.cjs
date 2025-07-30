/**
 * University of Graz Download Test Script
 * Downloads 5-10 test pages and creates PDF for validation
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Test URL that worked in previous validation
const TEST_URL = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538';

class GrazDownloadTest {
    constructor() {
        this.loader = new SharedManifestLoaders();
        this.outputDir = path.join(__dirname, '..', 'validation-results', 'v1.4.49', 'graz-test-pages');
        this.pdfOutputPath = path.join(__dirname, '..', 'validation-results', 'v1.4.49', 'graz-validation.pdf');
    }

    async runTest() {
        console.log('=== University of Graz Download Test ===\n');
        console.log(`URL: ${TEST_URL}`);
        
        try {
            // Ensure output directory exists
            await fs.mkdir(this.outputDir, { recursive: true });
            
            // Load manifest
            console.log('Loading manifest...');
            const manifest = await this.loader.getGrazManifest(TEST_URL);
            
            console.log(`✅ Manifest loaded successfully`);
            console.log(`   Pages found: ${manifest.images.length}`);
            console.log(`   Display name: ${manifest.displayName}`);
            
            // Download first 10 pages
            const pagesToDownload = Math.min(10, manifest.images.length);
            console.log(`\nDownloading ${pagesToDownload} pages...`);
            
            const downloadedPages = [];
            
            for (let i = 0; i < pagesToDownload; i++) {
                const image = manifest.images[i];
                const pageNum = i + 1;
                const outputPath = path.join(this.outputDir, `page_${pageNum.toString().padStart(3, '0')}.jpg`);
                
                console.log(`Downloading page ${pageNum}/${pagesToDownload}: ${image.label || `Page ${pageNum}`}`);
                
                try {
                    const startTime = Date.now();
                    await this.downloadImage(image.url, outputPath);
                    const duration = Date.now() - startTime;
                    
                    // Check file size
                    const stats = await fs.stat(outputPath);
                    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
                    
                    console.log(`   ✅ Downloaded in ${duration}ms (${fileSizeMB}MB)`);
                    
                    downloadedPages.push({
                        pageNum,
                        url: image.url,
                        label: image.label,
                        path: outputPath,
                        size: stats.size,
                        duration
                    });
                    
                } catch (error) {
                    console.log(`   ❌ Failed: ${error.message}`);
                    downloadedPages.push({
                        pageNum,
                        url: image.url,
                        label: image.label,
                        error: error.message
                    });
                }
            }
            
            // Create PDF from downloaded pages
            await this.createValidationPDF(downloadedPages);
            
            // Generate report
            await this.generateReport(manifest, downloadedPages);
            
            console.log(`\n=== Test Complete ===`);
            console.log(`Downloaded pages: ${downloadedPages.filter(p => !p.error).length}/${pagesToDownload}`);
            console.log(`Total size: ${this.getTotalSize(downloadedPages)}MB`);
            console.log(`Output directory: ${this.outputDir}`);
            console.log(`PDF created: ${this.pdfOutputPath}`);
            
        } catch (error) {
            console.error(`❌ Test failed: ${error.message}`);
            console.error(error.stack);
        }
    }

    async downloadImage(url, outputPath) {
        return new Promise((resolve, reject) => {
            const file = require('fs').createWriteStream(outputPath);
            
            const options = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://unipub.uni-graz.at/',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'de-AT,de;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                },
                timeout: 120000, // 2 minutes timeout for Graz
                rejectUnauthorized: false
            };
            
            const request = https.get(url, options, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
                
                file.on('error', (error) => {
                    fs.unlink(outputPath).catch(() => {}); // Delete partial file
                    reject(error);
                });
            });
            
            request.on('error', reject);
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Download timeout'));
            });
        });
    }

    async createValidationPDF(downloadedPages) {
        console.log('\nCreating validation PDF...');
        
        const validPages = downloadedPages.filter(p => !p.error);
        if (validPages.length === 0) {
            console.log('❌ No valid pages to create PDF');
            return;
        }
        
        try {
            // Use pdfunite to combine images into PDF (if available)
            const { exec } = require('child_process');
            const util = require('util');
            const execAsync = util.promisify(exec);
            
            // First convert images to PDF pages using ImageMagick
            const tempPdfDir = path.join(this.outputDir, 'temp_pdfs');
            await fs.mkdir(tempPdfDir, { recursive: true });
            
            const pdfPages = [];
            
            for (const page of validPages) {
                const pdfPath = path.join(tempPdfDir, `page_${page.pageNum}.pdf`);
                try {
                    await execAsync(`convert "${page.path}" "${pdfPath}"`);
                    pdfPages.push(pdfPath);
                } catch (error) {
                    console.warn(`Failed to convert page ${page.pageNum} to PDF: ${error.message}`);
                }
            }
            
            if (pdfPages.length > 0) {
                // Combine all PDF pages
                const pdfList = pdfPages.map(p => `"${p}"`).join(' ');
                await execAsync(`pdfunite ${pdfList} "${this.pdfOutputPath}"`);
                
                // Clean up temp files
                for (const pdfPath of pdfPages) {
                    await fs.unlink(pdfPath).catch(() => {});
                }
                await fs.rmdir(tempPdfDir).catch(() => {});
                
                console.log(`✅ PDF created with ${pdfPages.length} pages`);
            } else {
                console.log('❌ Failed to create PDF - no valid pages converted');
            }
            
        } catch (error) {
            console.warn(`⚠️ PDF creation failed: ${error.message}`);
            console.log('Note: Install ImageMagick and poppler-utils for PDF creation');
        }
    }

    async generateReport(manifest, downloadedPages) {
        const report = {
            timestamp: new Date().toISOString(),
            testUrl: TEST_URL,
            manifest: {
                totalPages: manifest.images.length,
                displayName: manifest.displayName,
                type: manifest.type || 'standard'
            },
            downloadResults: {
                attempted: downloadedPages.length,
                successful: downloadedPages.filter(p => !p.error).length,
                failed: downloadedPages.filter(p => p.error).length,
                totalSize: this.getTotalSize(downloadedPages),
                averagePageSize: this.getAverageSize(downloadedPages),
                pages: downloadedPages
            },
            memoryUsage: process.memoryUsage(),
            resolutionAnalysis: await this.analyzeResolution(downloadedPages)
        };
        
        const reportPath = path.join(__dirname, '..', 'validation-results', 'v1.4.49', 'graz-download-report.json');
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`\nReport saved to: ${reportPath}`);
    }

    getTotalSize(pages) {
        const totalBytes = pages
            .filter(p => !p.error && p.size)
            .reduce((sum, p) => sum + p.size, 0);
        return (totalBytes / 1024 / 1024).toFixed(2);
    }

    getAverageSize(pages) {
        const validPages = pages.filter(p => !p.error && p.size);
        if (validPages.length === 0) return 0;
        
        const totalBytes = validPages.reduce((sum, p) => sum + p.size, 0);
        return ((totalBytes / validPages.length) / 1024 / 1024).toFixed(2);
    }

    async analyzeResolution(pages) {
        const analysis = {
            estimatedResolution: 'Unknown',
            qualityAssessment: 'Unknown',
            recommendedUse: 'Unknown'
        };
        
        const validPages = pages.filter(p => !p.error && p.size);
        if (validPages.length === 0) return analysis;
        
        const avgSizeMB = parseFloat(this.getAverageSize(pages));
        
        // Estimate resolution based on file size (rough approximation)
        if (avgSizeMB > 5) {
            analysis.estimatedResolution = 'Very High (>2000px)';
            analysis.qualityAssessment = 'Excellent for printing and archival';
            analysis.recommendedUse = 'Suitable for all purposes including high-quality printing';
        } else if (avgSizeMB > 2) {
            analysis.estimatedResolution = 'High (1500-2000px)';
            analysis.qualityAssessment = 'Good for most uses';
            analysis.recommendedUse = 'Suitable for screen viewing and medium-quality printing';
        } else if (avgSizeMB > 0.5) {
            analysis.estimatedResolution = 'Medium (1000-1500px)';
            analysis.qualityAssessment = 'Adequate for screen viewing';
            analysis.recommendedUse = 'Suitable for screen viewing and basic printing';
        } else {
            analysis.estimatedResolution = 'Low (<1000px)';
            analysis.qualityAssessment = 'Limited quality';
            analysis.recommendedUse = 'Screen viewing only';
        }
        
        return analysis;
    }
}

// Run the test
if (require.main === module) {
    const test = new GrazDownloadTest();
    test.runTest().catch(console.error);
}

module.exports = { GrazDownloadTest };