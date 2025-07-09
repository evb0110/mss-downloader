#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class NegativeToPositiveConverter {
    constructor(options = {}) {
        this.tempDir = options.tempDir || '.devkit/temp/negative-conversion';
        this.outputDir = options.outputDir || '.devkit/artefacts/positive-pdfs';
        this.quality = options.quality || 95;
        this.dpi = options.dpi || 300;
    }

    ensureDirectories() {
        [this.tempDir, this.outputDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    extractImages(pdfPath) {
        console.log(`Extracting images from: ${pdfPath}`);
        
        const baseName = path.basename(pdfPath, '.pdf');
        const extractDir = path.join(this.tempDir, `${baseName}_extracted`);
        
        if (!fs.existsSync(extractDir)) {
            fs.mkdirSync(extractDir, { recursive: true });
        }

        try {
            execSync(`pdfimages -png "${pdfPath}" "${path.join(extractDir, 'page')}"`, { 
                stdio: 'inherit' 
            });
            
            const extractedFiles = fs.readdirSync(extractDir)
                .filter(file => file.endsWith('.png'))
                .sort((a, b) => {
                    const aNum = parseInt(a.match(/\d+/)?.[0] || '0');
                    const bNum = parseInt(b.match(/\d+/)?.[0] || '0');
                    return aNum - bNum;
                })
                .map(file => path.join(extractDir, file));

            console.log(`Extracted ${extractedFiles.length} images`);
            return extractedFiles;
        } catch (error) {
            console.error('Error extracting images:', error.message);
            throw error;
        }
    }

    invertImage(imagePath, outputPath) {
        try {
            execSync(`magick "${imagePath}" -negate "${outputPath}"`, { 
                stdio: 'pipe' 
            });
            return true;
        } catch (error) {
            console.error(`Error inverting ${imagePath}:`, error.message);
            return false;
        }
    }

    invertAllImages(imagePaths) {
        console.log(`Inverting ${imagePaths.length} images...`);
        
        const invertedPaths = [];
        let successCount = 0;

        imagePaths.forEach((imagePath, index) => {
            const fileName = path.basename(imagePath, '.png');
            const outputPath = path.join(path.dirname(imagePath), `${fileName}_positive.png`);
            
            if (this.invertImage(imagePath, outputPath)) {
                invertedPaths.push(outputPath);
                successCount++;
            }

            if ((index + 1) % 10 === 0) {
                console.log(`Processed ${index + 1}/${imagePaths.length} images`);
            }
        });

        console.log(`Successfully inverted ${successCount}/${imagePaths.length} images`);
        return invertedPaths;
    }

    createPdfFromImages(imagePaths, outputPath) {
        console.log(`Creating PDF with ${imagePaths.length} images...`);
        
        try {
            const imageList = imagePaths.map(img => `"${img}"`).join(' ');
            
            execSync(`magick ${imageList} -density ${this.dpi} -quality ${this.quality} "${outputPath}"`, {
                stdio: 'inherit',
                maxBuffer: 1024 * 1024 * 50
            });

            const stats = fs.statSync(outputPath);
            console.log(`Created PDF: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            return true;
        } catch (error) {
            console.error('Error creating PDF:', error.message);
            return false;
        }
    }

    convertPdf(pdfPath) {
        console.log(`\n=== Converting PDF: ${pdfPath} ===`);
        
        try {
            this.ensureDirectories();
            
            const baseName = path.basename(pdfPath, '.pdf');
            const outputPath = path.join(this.outputDir, `${baseName}_positive.pdf`);
            
            const extractedImages = this.extractImages(pdfPath);
            if (extractedImages.length === 0) {
                throw new Error('No images extracted from PDF');
            }

            const invertedImages = this.invertAllImages(extractedImages);
            if (invertedImages.length === 0) {
                throw new Error('No images successfully inverted');
            }

            const success = this.createPdfFromImages(invertedImages, outputPath);
            if (!success) {
                throw new Error('Failed to create output PDF');
            }

            this.cleanupTempFiles(path.dirname(extractedImages[0]));
            
            console.log(`✅ Successfully converted: ${outputPath}`);
            return outputPath;
            
        } catch (error) {
            console.error(`❌ Failed to convert ${pdfPath}:`, error.message);
            throw error;
        }
    }

    cleanupTempFiles(dir) {
        try {
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        } catch (error) {
            console.warn('Warning: Could not cleanup temp files:', error.message);
        }
    }

    convertMultiplePdfs(pdfPaths) {
        console.log(`\n🔄 Starting batch conversion of ${pdfPaths.length} PDFs...\n`);
        
        const results = [];
        
        for (let i = 0; i < pdfPaths.length; i++) {
            const pdfPath = pdfPaths[i];
            console.log(`\n[${i + 1}/${pdfPaths.length}] Processing: ${path.basename(pdfPath)}`);
            
            try {
                const outputPath = this.convertPdf(pdfPath);
                results.push({ input: pdfPath, output: outputPath, success: true });
            } catch (error) {
                results.push({ input: pdfPath, error: error.message, success: false });
            }
        }

        console.log('\n📊 Conversion Summary:');
        results.forEach(result => {
            if (result.success) {
                console.log(`✅ ${path.basename(result.input)} → ${path.basename(result.output)}`);
            } else {
                console.log(`❌ ${path.basename(result.input)}: ${result.error}`);
            }
        });

        const successCount = results.filter(r => r.success).length;
        console.log(`\n🎯 Completed: ${successCount}/${results.length} PDFs converted successfully`);
        
        return results;
    }
}

if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
Usage: node negative-to-positive-converter.cjs <pdf-file-or-directory>

Examples:
  node negative-to-positive-converter.cjs "path/to/negative.pdf"
  node negative-to-positive-converter.cjs ".devkit/artefacts"
  
Options can be set by modifying the constructor options in the script.
        `);
        process.exit(1);
    }

    const inputPath = args[0];
    const converter = new NegativeToPositiveConverter({
        quality: 95,
        dpi: 300
    });

    try {
        if (fs.statSync(inputPath).isDirectory()) {
            const pdfFiles = fs.readdirSync(inputPath)
                .filter(file => file.toLowerCase().endsWith('.pdf'))
                .map(file => path.join(inputPath, file));
            
            if (pdfFiles.length === 0) {
                console.error('No PDF files found in directory');
                process.exit(1);
            }
            
            converter.convertMultiplePdfs(pdfFiles);
        } else {
            converter.convertPdf(inputPath);
        }
    } catch (error) {
        console.error('Conversion failed:', error.message);
        process.exit(1);
    }
}

module.exports = NegativeToPositiveConverter;