const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class BVPBValidationTest {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '../..');
        this.electronPath = path.join(this.projectRoot, 'node_modules/.bin/electron');
        this.validationDir = path.join(this.projectRoot, 'CURRENT-VALIDATION');
        
        this.testUrls = [
            'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000651',  // Medieval manuscript (161 pages) - Primary test
            'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=22211',     // Historic document - Secondary test
            'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=10000059'   // Manuscript collection - Tertiary test
        ];
    }
    
    async ensureValidationDirectory() {
        try {
            await fs.promises.mkdir(this.validationDir, { recursive: true });
            console.log(`✓ Validation directory ready: ${this.validationDir}`);
        } catch (error) {
            console.error(`Failed to create validation directory: ${error.message}`);
            throw error;
        }
    }
    
    async downloadManuscript(url, maxPages = 10) {
        return new Promise((resolve, reject) => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const pathMatch = url.match(/path=([^&]+)/);
            const pathId = pathMatch ? pathMatch[1] : 'unknown';
            
            console.log(`\n=== Testing BVPB manuscript: ${pathId} ===`);
            console.log(`URL: ${url}`);
            console.log(`Max pages for validation: ${maxPages}`);
            
            // Use Electron's command line interface to download
            const command = `"${this.electronPath}" "${this.projectRoot}" --download-url="${url}" --max-pages=${maxPages} --validation-mode=true`;
            
            console.log(`Executing: ${command}`);
            
            const startTime = Date.now();
            const child = exec(command, { 
                cwd: this.projectRoot,
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            });
            
            let output = '';
            let errorOutput = '';
            
            child.stdout?.on('data', (data) => {
                output += data;
                process.stdout.write(data);
            });
            
            child.stderr?.on('data', (data) => {
                errorOutput += data;
                process.stderr.write(data);
            });
            
            child.on('close', (code) => {
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`\nDownload completed in ${duration}s with exit code: ${code}`);
                
                if (code === 0) {
                    resolve({
                        success: true,
                        pathId,
                        duration: parseFloat(duration),
                        output,
                        url
                    });
                } else {
                    reject(new Error(`Download failed with exit code ${code}. Error: ${errorOutput}`));
                }
            });
            
            child.on('error', (error) => {
                console.error(`Failed to start download process: ${error.message}`);
                reject(error);
            });
            
            // Set timeout for long-running downloads
            setTimeout(() => {
                child.kill();
                reject(new Error('Download timed out after 10 minutes'));
            }, 10 * 60 * 1000);
        });
    }
    
    async validatePDF(filePath) {
        console.log(`\n=== Validating PDF: ${path.basename(filePath)} ===`);
        
        try {
            // Check if file exists and has reasonable size
            const stats = await fs.promises.stat(filePath);
            const sizeKB = (stats.size / 1024).toFixed(2);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            
            console.log(`✓ File exists: ${sizeKB} KB (${sizeMB} MB)`);
            
            if (stats.size < 50 * 1024) { // Less than 50KB
                throw new Error(`PDF file too small (${sizeKB} KB) - likely invalid`);
            }
            
            // Use pdfimages to check content
            return new Promise((resolve, reject) => {
                exec(`pdfimages -list "${filePath}"`, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`pdfimages failed: ${error.message}`);
                        reject(new Error(`PDF validation failed: ${error.message}`));
                        return;
                    }
                    
                    const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('page'));
                    const imageCount = lines.length - 1; // Subtract header line
                    
                    console.log(`✓ PDF contains ${imageCount} images`);
                    
                    if (imageCount === 0) {
                        reject(new Error('PDF contains no images'));
                        return;
                    }
                    
                    // Analyze image dimensions for quality check
                    const imageSizes = [];
                    lines.slice(1).forEach(line => {
                        const parts = line.split(/\s+/);
                        if (parts.length >= 4) {
                            const width = parseInt(parts[3]);
                            const height = parseInt(parts[4]);
                            if (width && height) {
                                imageSizes.push({ width, height, pixels: width * height });
                            }
                        }
                    });
                    
                    if (imageSizes.length > 0) {
                        const avgPixels = imageSizes.reduce((sum, img) => sum + img.pixels, 0) / imageSizes.length;
                        const avgWidth = imageSizes.reduce((sum, img) => sum + img.width, 0) / imageSizes.length;
                        const avgHeight = imageSizes.reduce((sum, img) => sum + img.height, 0) / imageSizes.length;
                        
                        console.log(`✓ Average image dimensions: ${Math.round(avgWidth)}x${Math.round(avgHeight)} pixels`);
                        console.log(`✓ Average image quality: ${(avgPixels / 1000000).toFixed(2)} megapixels`);
                        
                        // Check for reasonable resolution (should be > 100KB per image for manuscripts)
                        const expectedMinPixels = 500000; // 0.5 megapixels minimum
                        if (avgPixels < expectedMinPixels) {
                            console.warn(`⚠ Images may be low resolution (${(avgPixels / 1000000).toFixed(2)} MP < 0.5 MP expected)`);
                        }
                    }
                    
                    resolve({
                        valid: true,
                        imageCount,
                        fileSizeKB: parseFloat(sizeKB),
                        fileSizeMB: parseFloat(sizeMB),
                        avgPixels: imageSizes.length > 0 ? Math.round(imageSizes.reduce((sum, img) => sum + img.pixels, 0) / imageSizes.length) : 0
                    });
                });
            });
            
        } catch (error) {
            console.error(`PDF validation failed: ${error.message}`);
            throw error;
        }
    }
    
    async findGeneratedPDFs() {
        const downloadsDir = require('os').homedir() + '/Downloads';
        const files = await fs.promises.readdir(downloadsDir);
        
        // Look for BVPB PDFs created recently (within last hour)
        const recentBVPBFiles = [];
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        for (const file of files) {
            if (file.includes('BVPB') || file.includes('Manuscript')) {
                const filePath = path.join(downloadsDir, file);
                try {
                    const stats = await fs.promises.stat(filePath);
                    if (stats.isFile() && file.endsWith('.pdf') && stats.mtime.getTime() > oneHourAgo) {
                        recentBVPBFiles.push(filePath);
                    }
                } catch (error) {
                    // Skip files that can't be accessed
                }
            }
        }
        
        return recentBVPBFiles;
    }
    
    async runValidationProtocol() {
        console.log('🔍 Starting BVPB Library Validation Protocol');
        console.log('=' * 60);
        
        await this.ensureValidationDirectory();
        
        const results = [];
        
        for (let i = 0; i < this.testUrls.length; i++) {
            const url = this.testUrls[i];
            const isFirstTest = i === 0;
            const maxPages = isFirstTest ? 10 : 5; // Download more pages for the primary test
            
            try {
                console.log(`\n📖 Testing manuscript ${i + 1}/${this.testUrls.length}`);
                
                const downloadResult = await this.downloadManuscript(url, maxPages);
                
                // Find the generated PDF
                const generatedPDFs = await this.findGeneratedPDFs();
                
                if (generatedPDFs.length === 0) {
                    throw new Error('No BVPB PDF files found in Downloads folder');
                }
                
                // Validate the most recent PDF
                const latestPDF = generatedPDFs[generatedPDFs.length - 1];
                const validationResult = await this.validatePDF(latestPDF);
                
                // Move PDF to validation directory
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
                const newFileName = `BVPB-${downloadResult.pathId}-VALIDATION-${timestamp}.pdf`;
                const targetPath = path.join(this.validationDir, newFileName);
                
                await fs.promises.copyFile(latestPDF, targetPath);
                console.log(`✓ Validation PDF saved: ${newFileName}`);
                
                results.push({
                    ...downloadResult,
                    validation: validationResult,
                    validationFile: newFileName,
                    rating: this.rateResult(validationResult)
                });
                
            } catch (error) {
                console.error(`❌ Test ${i + 1} failed: ${error.message}`);
                results.push({
                    url,
                    success: false,
                    error: error.message,
                    rating: 'failed'
                });
            }
        }
        
        return this.generateReport(results);
    }
    
    rateResult(validation) {
        if (!validation.valid) return 'failed';
        
        // Check multiple quality factors
        const issues = [];
        
        if (validation.imageCount < 3) {
            issues.push('Too few pages');
        }
        
        if (validation.fileSizeMB < 1) {
            issues.push('File size too small');
        }
        
        if (validation.avgPixels < 500000) {
            issues.push('Low resolution images');
        }
        
        if (issues.length === 0) return 'ok';
        if (issues.length <= 2) return 'something not ok';
        return 'failed';
    }
    
    generateReport(results) {
        console.log('\n' + '='.repeat(60));
        console.log('📊 BVPB VALIDATION REPORT');
        console.log('='.repeat(60));
        
        const successful = results.filter(r => r.success && r.rating === 'ok');
        const partial = results.filter(r => r.success && r.rating === 'something not ok');
        const failed = results.filter(r => !r.success || r.rating === 'failed');
        
        console.log(`✅ Successful: ${successful.length}`);
        console.log(`⚠️  Partial: ${partial.length}`);
        console.log(`❌ Failed: ${failed.length}`);
        
        if (successful.length > 0) {
            console.log('\n✅ SUCCESSFUL VALIDATIONS:');
            successful.forEach(result => {
                console.log(`  • ${result.pathId}: ${result.validation.imageCount} pages, ${result.validation.fileSizeMB} MB`);
            });
        }
        
        if (partial.length > 0) {
            console.log('\n⚠️  PARTIAL VALIDATIONS:');
            partial.forEach(result => {
                console.log(`  • ${result.pathId}: ${result.validation.imageCount} pages, ${result.validation.fileSizeMB} MB`);
            });
        }
        
        if (failed.length > 0) {
            console.log('\n❌ FAILED VALIDATIONS:');
            failed.forEach(result => {
                console.log(`  • ${result.pathId || 'Unknown'}: ${result.error || 'Validation failed'}`);
            });
        }
        
        // Overall assessment
        const successRate = (successful.length / results.length) * 100;
        console.log(`\n📈 Success Rate: ${successRate.toFixed(1)}%`);
        
        let overallStatus;
        if (successRate >= 80) {
            overallStatus = 'PASSED';
            console.log('🎉 BVPB Implementation: READY FOR PRODUCTION');
        } else if (successRate >= 50) {
            overallStatus = 'PARTIAL';
            console.log('⚠️  BVPB Implementation: NEEDS REFINEMENT');
        } else {
            overallStatus = 'FAILED';
            console.log('❌ BVPB Implementation: REQUIRES FIXES');
        }
        
        return {
            overallStatus,
            successRate,
            successful: successful.length,
            partial: partial.length,
            failed: failed.length,
            results
        };
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new BVPBValidationTest();
    validator.runValidationProtocol()
        .then(report => {
            console.log('\n✅ Validation protocol completed');
            process.exit(report.overallStatus === 'PASSED' ? 0 : 1);
        })
        .catch(error => {
            console.error('\n❌ Validation protocol failed:', error.message);
            process.exit(1);
        });
}

module.exports = BVPBValidationTest;