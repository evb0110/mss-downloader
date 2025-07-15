const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test Wolfenbüttel library PDF creation
async function testWolfenbuettelPDF() {
    console.log('=== WOLFENBÜTTEL PDF CREATION TEST ===');
    
    const manuscriptId = '1008-helmst';
    const baseImageUrl = `http://diglib.hab.de/mss/${manuscriptId}/max`;
    
    // Download first 10 pages for PDF creation
    console.log('1. Downloading sample pages...');
    const imageDir = path.join(__dirname, 'temp', 'wolfenbuettel-pdf-test');
    await fs.promises.mkdir(imageDir, { recursive: true });
    
    const pageNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const downloadedFiles = [];
    
    for (const pageNum of pageNumbers) {
        const pageStr = pageNum.toString().padStart(5, '0');
        const imageUrl = `${baseImageUrl}/${pageStr}.jpg`;
        const filename = path.join(imageDir, `page-${pageStr}.jpg`);
        
        try {
            console.log(`   Downloading page ${pageNum}...`);
            const response = await fetch(imageUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const buffer = Buffer.from(await response.arrayBuffer());
            await fs.promises.writeFile(filename, buffer);
            
            downloadedFiles.push({
                pageNum,
                filename,
                size: buffer.length
            });
            
            console.log(`   ✓ Page ${pageNum}: ${buffer.length} bytes`);
            
        } catch (error) {
            console.log(`   ✗ Page ${pageNum}: ${error.message}`);
        }
    }
    
    if (downloadedFiles.length === 0) {
        throw new Error('No pages downloaded');
    }
    
    // Create PDF using ImageMagick
    console.log(`\n2. Creating PDF from ${downloadedFiles.length} pages...`);
    const pdfFilename = path.join(imageDir, 'wolfenbuettel-1008-helmst-sample.pdf');
    
    try {
        const imageFiles = downloadedFiles.map(f => f.filename).join(' ');
        const command = `convert ${imageFiles} "${pdfFilename}"`;
        
        console.log(`   Running: ${command}`);
        execSync(command, { stdio: 'inherit' });
        
        // Check if PDF was created successfully
        const pdfStats = await fs.promises.stat(pdfFilename);
        console.log(`   ✓ PDF created: ${pdfFilename} (${pdfStats.size} bytes)`);
        
    } catch (error) {
        console.log(`   ✗ PDF creation failed: ${error.message}`);
        throw error;
    }
    
    // Validate PDF with poppler
    console.log('\n3. Validating PDF with poppler...');
    
    try {
        // Check PDF info
        const pdfInfo = execSync(`pdfinfo "${pdfFilename}"`, { encoding: 'utf8' });
        console.log('   PDF Info:');
        console.log(pdfInfo.split('\n').map(line => `     ${line}`).join('\n'));
        
        // Check PDF images
        const pdfImages = execSync(`pdfimages -list "${pdfFilename}"`, { encoding: 'utf8' });
        console.log('   PDF Images:');
        console.log(pdfImages.split('\n').map(line => `     ${line}`).join('\n'));
        
        // Extract images for visual verification
        const extractDir = path.join(imageDir, 'extracted');
        await fs.promises.mkdir(extractDir, { recursive: true });
        
        try {
            execSync(`pdfimages -png "${pdfFilename}" "${path.join(extractDir, 'page')}"`, { stdio: 'inherit' });
            console.log(`   ✓ Images extracted to: ${extractDir}`);
        } catch (extractError) {
            console.log(`   ⚠ Image extraction failed: ${extractError.message}`);
        }
        
        console.log('\n✓ PDF VALIDATION PASSED');
        
        return {
            pdfFilename,
            pdfSize: (await fs.promises.stat(pdfFilename)).size,
            pageCount: downloadedFiles.length,
            extractDir,
            success: true
        };
        
    } catch (error) {
        console.log(`   ✗ PDF validation failed: ${error.message}`);
        throw error;
    }
}

// Run the test
testWolfenbuettelPDF().catch(error => {
    console.error('PDF test failed:', error);
    process.exit(1);
});