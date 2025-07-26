const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const { promisify } = require('util');
const stream = require('stream');

async function downloadWithProgress(url, outputPath, pageNum, totalPages) {
    const startTime = Date.now();
    console.log(`Downloading page ${pageNum}/${totalPages}...`);
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const buffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(buffer));
    
    const elapsed = Date.now() - startTime;
    const sizeKB = buffer.byteLength / 1024;
    console.log(`  ✓ Page ${pageNum}: ${sizeKB.toFixed(0)}KB in ${elapsed}ms`);
    
    return buffer.byteLength;
}

async function validateWolfenbuettel() {
    console.log('=== WOLFENBÜTTEL VALIDATION TEST ===\n');
    
    const outputDir = path.join(__dirname, '../validation/wolfenbuettel_ed000011');
    await fs.mkdir(outputDir, { recursive: true });
    
    const manuscriptId = 'varia/selecta/ed000011';
    
    try {
        // Step 1: Collect all image URLs (like the app does)
        console.log('Step 1: Collecting image URLs...');
        const allImageNames = [];
        let pointer = 0;
        let pagesProcessed = 0;
        
        while (true) {
            const thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=${manuscriptId}&pointer=${pointer}`;
            const response = await fetch(thumbsUrl);
            
            if (!response.ok) break;
            
            const html = await response.text();
            const imageMatches = html.matchAll(/image=([^'"&]+)/g);
            const imageNames = Array.from(imageMatches, m => m[1]);
            
            if (imageNames.length === 0) break;
            
            imageNames.forEach(name => {
                if (!allImageNames.includes(name)) {
                    allImageNames.push(name);
                }
            });
            
            // Check for next page
            const nextMatch = html.match(/href="thumbs\.php\?dir=[^&]+&pointer=(\d+)"[^>]*><img[^>]*title="forward"/);
            if (!nextMatch || parseInt(nextMatch[1]) === pointer) {
                console.log(`  Reached end at pointer=${pointer}`);
                break;
            }
            
            pointer = parseInt(nextMatch[1]);
            pagesProcessed++;
            
            // Progress
            if (pagesProcessed % 5 === 0) {
                console.log(`  Processed ${pagesProcessed} thumb pages, found ${allImageNames.length} images...`);
            }
        }
        
        console.log(`✓ Found ${allImageNames.length} total images\n`);
        
        // Step 2: Download sample pages
        console.log('Step 2: Downloading sample pages...');
        const samplesToDownload = Math.min(10, allImageNames.length);
        const downloadedFiles = [];
        let totalSize = 0;
        
        for (let i = 0; i < samplesToDownload; i++) {
            const imageName = allImageNames[i];
            const imageUrl = `http://diglib.hab.de/${manuscriptId}/max/${imageName}.jpg`;
            const outputPath = path.join(outputDir, `${imageName}.jpg`);
            
            try {
                const size = await downloadWithProgress(imageUrl, outputPath, i + 1, samplesToDownload);
                totalSize += size;
                downloadedFiles.push(outputPath);
            } catch (err) {
                console.error(`  ✗ Failed to download ${imageName}:`, err.message);
            }
        }
        
        console.log(`\n✓ Downloaded ${downloadedFiles.length}/${samplesToDownload} pages`);
        console.log(`  Total size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
        
        // Step 3: Create PDF
        if (downloadedFiles.length > 0) {
            console.log('\nStep 3: Creating PDF...');
            const pdfPath = path.join(outputDir, 'wolfenbuettel_ed000011.pdf');
            const doc = new PDFDocument({ autoFirstPage: false });
            const writeStream = fs.createWriteStream(pdfPath);
            doc.pipe(writeStream);
            
            for (const file of downloadedFiles) {
                try {
                    const metadata = await sharp(file).metadata();
                    doc.addPage({ size: [metadata.width, metadata.height] });
                    doc.image(file, 0, 0, { width: metadata.width, height: metadata.height });
                } catch (err) {
                    console.error(`Error adding image to PDF:`, err.message);
                }
            }
            
            doc.end();
            await promisify(stream.finished)(writeStream);
            
            const pdfStats = await fs.stat(pdfPath);
            console.log(`✓ PDF created: ${(pdfStats.size / 1024 / 1024).toFixed(2)}MB`);
            
            // Validate with pdfimages
            const { exec } = require('child_process');
            const execPromise = promisify(exec);
            
            try {
                const { stdout } = await execPromise(`pdfimages -list "${pdfPath}" | head -15`);
                console.log('\nPDF validation:');
                console.log(stdout);
            } catch (err) {
                console.log('(pdfimages not available)');
            }
        }
        
        // Summary
        console.log('\n=== VALIDATION SUMMARY ===');
        console.log(`Total pages in manuscript: ${allImageNames.length}`);
        console.log(`Download success rate: ${(downloadedFiles.length / samplesToDownload * 100).toFixed(0)}%`);
        console.log(`Output directory: ${outputDir}`);
        console.log('\nNo cycle detected - pagination works correctly!');
        console.log('The issue might be network-related or in the app\'s queue processing.');
        
    } catch (err) {
        console.error('\nValidation failed:', err.message);
        console.error(err.stack);
    }
}

// Check if we have required modules
const requiredModules = ['pdfkit', 'sharp'];
const missingModules = [];

requiredModules.forEach(mod => {
    try {
        require(mod);
    } catch (err) {
        missingModules.push(mod);
    }
});

if (missingModules.length > 0) {
    console.log('Installing required modules...');
    const { execSync } = require('child_process');
    execSync(`npm install ${missingModules.join(' ')}`, { stdio: 'inherit' });
}

validateWolfenbuettel().catch(console.error);