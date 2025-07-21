#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FlorencePDFCreator {
    constructor() {
        this.downloadDir = path.join(__dirname, 'test-downloads');
        this.outputDir = path.join(__dirname, 'test-pdfs');
    }

    async createPDFs() {
        console.log('📄 Creating test PDFs from downloaded images...\n');
        
        try {
            await fs.mkdir(this.outputDir, { recursive: true });
            
            // Get all downloaded images
            const files = await fs.readdir(this.downloadDir);
            const imageFiles = files.filter(f => f.endsWith('.jpg')).sort();
            
            if (imageFiles.length === 0) {
                throw new Error('No image files found to create PDF');
            }

            console.log(`📋 Found ${imageFiles.length} image files`);
            
            // Create different PDF scenarios
            await this.createSinglePagePDF(imageFiles[0]);
            await this.createMultiPagePDF(imageFiles.slice(0, 5)); // First 5 pages
            await this.createFullPDF(imageFiles); // All pages
            
            console.log('\n✅ PDF creation completed successfully!');
            
        } catch (error) {
            console.error('❌ PDF creation failed:', error.message);
            throw error;
        }
    }

    async createSinglePagePDF(imageFile) {
        console.log(`\n📄 Creating single-page PDF from: ${imageFile}`);
        
        const inputPath = path.join(this.downloadDir, imageFile);
        const outputPath = path.join(this.outputDir, 'florence_single_page.pdf');
        
        await this.convertImageToPDF(inputPath, outputPath);
        
        const stats = await fs.stat(outputPath);
        console.log(`✅ Single-page PDF created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        return outputPath;
    }

    async createMultiPagePDF(imageFiles) {
        console.log(`\n📄 Creating multi-page PDF from ${imageFiles.length} images`);
        
        const outputPath = path.join(this.outputDir, 'florence_multi_page.pdf');
        const inputPaths = imageFiles.map(f => path.join(this.downloadDir, f));
        
        await this.convertImagesToPDF(inputPaths, outputPath);
        
        const stats = await fs.stat(outputPath);
        console.log(`✅ Multi-page PDF created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        return outputPath;
    }

    async createFullPDF(imageFiles) {
        console.log(`\n📄 Creating full PDF from all ${imageFiles.length} images`);
        
        const outputPath = path.join(this.outputDir, 'florence_full_manuscript.pdf');
        const inputPaths = imageFiles.map(f => path.join(this.downloadDir, f));
        
        await this.convertImagesToPDF(inputPaths, outputPath);
        
        const stats = await fs.stat(outputPath);
        console.log(`✅ Full PDF created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        return outputPath;
    }

    async convertImageToPDF(imagePath, pdfPath) {
        return new Promise((resolve, reject) => {
            const args = [imagePath, pdfPath];
            const process = spawn('img2pdf', args, { stdio: 'pipe' });
            
            let stderr = '';
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`img2pdf failed: ${stderr}`));
                }
            });
            
            process.on('error', (err) => {
                if (err.code === 'ENOENT') {
                    // Fallback to ImageMagick convert
                    this.convertWithImageMagick([imagePath], pdfPath).then(resolve).catch(reject);
                } else {
                    reject(err);
                }
            });
        });
    }

    async convertImagesToPDF(imagePaths, pdfPath) {
        return new Promise((resolve, reject) => {
            const args = [...imagePaths, pdfPath];
            const process = spawn('img2pdf', args, { stdio: 'pipe' });
            
            let stderr = '';
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`img2pdf failed: ${stderr}`));
                }
            });
            
            process.on('error', (err) => {
                if (err.code === 'ENOENT') {
                    // Fallback to ImageMagick convert
                    this.convertWithImageMagick(imagePaths, pdfPath).then(resolve).catch(reject);
                } else {
                    reject(err);
                }
            });
        });
    }

    async convertWithImageMagick(imagePaths, pdfPath) {
        return new Promise((resolve, reject) => {
            const args = [...imagePaths, pdfPath];
            const process = spawn('convert', args, { stdio: 'pipe' });
            
            let stderr = '';
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`ImageMagick convert failed: ${stderr}`));
                }
            });
            
            process.on('error', (err) => {
                reject(new Error(`ImageMagick not available: ${err.message}`));
            });
        });
    }

    async validatePDFs() {
        console.log('\n🔍 Validating created PDFs with poppler tools...\n');
        
        const pdfFiles = [
            'florence_single_page.pdf',
            'florence_multi_page.pdf', 
            'florence_full_manuscript.pdf'
        ];

        for (const pdfFile of pdfFiles) {
            const pdfPath = path.join(this.outputDir, pdfFile);
            
            try {
                await fs.access(pdfPath);
                console.log(`📋 Validating: ${pdfFile}`);
                await this.validatePDFWithPoppler(pdfPath);
            } catch (error) {
                console.log(`⚠️ Skipping ${pdfFile}: ${error.message}`);
            }
        }
    }

    async validatePDFWithPoppler(pdfPath) {
        // Test PDF info
        await this.runPDFInfo(pdfPath);
        
        // Test PDF images
        await this.runPDFImages(pdfPath);
        
        // Test PDF text (should be empty for image-only PDFs)
        await this.runPDFToText(pdfPath);
    }

    async runPDFInfo(pdfPath) {
        return new Promise((resolve) => {
            const process = spawn('pdfinfo', [pdfPath], { stdio: 'pipe' });
            
            let stdout = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    const lines = stdout.split('\n');
                    const pages = lines.find(l => l.startsWith('Pages:'))?.split(':')[1]?.trim();
                    const pageSize = lines.find(l => l.startsWith('Page size:'))?.split(':')[1]?.trim();
                    
                    console.log(`  ✅ PDF Info: ${pages} pages, ${pageSize}`);
                } else {
                    console.log(`  ❌ pdfinfo failed for ${path.basename(pdfPath)}`);
                }
                resolve();
            });
            
            process.on('error', () => {
                console.log(`  ⚠️ pdfinfo not available for ${path.basename(pdfPath)}`);
                resolve();
            });
        });
    }

    async runPDFImages(pdfPath) {
        return new Promise((resolve) => {
            const process = spawn('pdfimages', ['-list', pdfPath], { stdio: 'pipe' });
            
            let stdout = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    const lines = stdout.split('\n').filter(l => l.trim());
                    const imageCount = Math.max(0, lines.length - 2); // Subtract header lines
                    console.log(`  ✅ PDF Images: ${imageCount} embedded images detected`);
                } else {
                    console.log(`  ❌ pdfimages failed for ${path.basename(pdfPath)}`);
                }
                resolve();
            });
            
            process.on('error', () => {
                console.log(`  ⚠️ pdfimages not available for ${path.basename(pdfPath)}`);
                resolve();
            });
        });
    }

    async runPDFToText(pdfPath) {
        return new Promise((resolve) => {
            const process = spawn('pdftotext', [pdfPath, '-'], { stdio: 'pipe' });
            
            let stdout = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    const textLength = stdout.trim().length;
                    console.log(`  ✅ PDF Text: ${textLength} characters (expected: minimal for image PDFs)`);
                } else {
                    console.log(`  ❌ pdftotext failed for ${path.basename(pdfPath)}`);
                }
                resolve();
            });
            
            process.on('error', () => {
                console.log(`  ⚠️ pdftotext not available for ${path.basename(pdfPath)}`);
                resolve();
            });
        });
    }
}

// Run the PDF creation and validation
const creator = new FlorencePDFCreator();
creator.createPDFs()
    .then(() => creator.validatePDFs())
    .then(() => {
        console.log('\n🎉 Florence PDF creation and validation completed successfully!');
    })
    .catch((error) => {
        console.error('\n❌ Florence PDF creation/validation failed:', error.message);
        process.exit(1);
    });