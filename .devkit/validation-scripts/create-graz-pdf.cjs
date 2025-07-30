/**
 * Create PDF from Graz test pages using pdf-lib
 */

const fs = require('fs').promises;
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function createGrazValidationPDF() {
    console.log('Creating Graz validation PDF using pdf-lib...');
    
    const imagesDir = path.join(__dirname, '..', 'validation-results', 'v1.4.49', 'graz-test-pages');
    const outputPath = path.join(__dirname, '..', 'validation-results', 'v1.4.49', 'graz-validation.pdf');
    
    try {
        // Create a new PDF document
        const pdfDoc = await PDFDocument.create();
        
        // Get list of image files
        const files = await fs.readdir(imagesDir);
        const imageFiles = files
            .filter(file => file.match(/^page_\d{3}\.jpg$/))
            .sort();
        
        console.log(`Found ${imageFiles.length} images to add to PDF`);
        
        for (let i = 0; i < imageFiles.length; i++) {
            const imageFile = imageFiles[i];
            const imagePath = path.join(imagesDir, imageFile);
            
            console.log(`Adding page ${i + 1}: ${imageFile}`);
            
            // Read image file
            const imageBytes = await fs.readFile(imagePath);
            
            // Embed image in PDF
            const image = await pdfDoc.embedJpg(imageBytes);
            
            // Get image dimensions
            const { width, height } = image.scale(1);
            
            // Create a page with image dimensions (or scale to fit A4)
            const maxWidth = 595; // A4 width in points
            const maxHeight = 842; // A4 height in points
            
            let pageWidth = width;
            let pageHeight = height;
            
            // Scale to fit A4 if too large
            if (width > maxWidth || height > maxHeight) {
                const scaleX = maxWidth / width;
                const scaleY = maxHeight / height;
                const scale = Math.min(scaleX, scaleY);
                
                pageWidth = width * scale;
                pageHeight = height * scale;
            }
            
            // Add page
            const page = pdfDoc.addPage([pageWidth, pageHeight]);
            
            // Draw image
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: pageWidth,
                height: pageHeight,
            });
        }
        
        // Save PDF
        const pdfBytes = await pdfDoc.save();
        await fs.writeFile(outputPath, pdfBytes);
        
        console.log(`✅ PDF created successfully: ${outputPath}`);
        console.log(`   Pages: ${imageFiles.length}`);
        console.log(`   Size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)}MB`);
        
        return {
            success: true,
            path: outputPath,
            pages: imageFiles.length,
            size: pdfBytes.length
        };
        
    } catch (error) {
        console.error(`❌ PDF creation failed: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run if called directly
if (require.main === module) {
    createGrazValidationPDF().catch(console.error);
}

module.exports = { createGrazValidationPDF };