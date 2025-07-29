#!/usr/bin/env node

const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function createValidationPDF() {
    console.log('Creating HHU validation PDF...');
    
    const loader = new SharedManifestLoaders();
    const testUrl = 'https://digital.ulb.hhu.de/ms/content/titleinfo/9400252';
    
    try {
        // Get manifest
        const result = await loader.getHHUManifest(testUrl);
        console.log(`✅ Found ${result.images.length} images`);
        
        // Download first 3 images for validation
        const maxImages = Math.min(3, result.images.length);
        const imageBuffers = [];
        
        for (let i = 0; i < maxImages; i++) {
            console.log(`Downloading image ${i + 1}/${maxImages}...`);
            const response = await loader.fetchWithRetry(result.images[i].url);
            if (response.ok) {
                const buffer = await response.buffer();
                imageBuffers.push(buffer);
                console.log(`✅ Downloaded ${buffer.length} bytes`);
            } else {
                console.log(`❌ Failed to download image ${i + 1}: ${response.status}`);
            }
        }
        
        if (imageBuffers.length === 0) {
            throw new Error('No images downloaded');
        }
        
        // Create PDF
        const outputPath = path.join(__dirname, 'hhu-validation.pdf');
        const doc = new PDFDocument({ autoFirstPage: false });
        doc.pipe(fs.createWriteStream(outputPath));
        
        // Add title page
        doc.addPage();
        doc.fontSize(16).text('HHU Regression Fix Validation', 50, 50);
        doc.fontSize(12).text(`URL: ${testUrl}`, 50, 80);
        doc.text(`Manuscript: ${result.displayName}`, 50, 100);
        doc.text(`Total pages found: ${result.images.length}`, 50, 120);
        doc.text(`Downloaded for validation: ${imageBuffers.length}`, 50, 140);
        
        // Add images to PDF
        for (let i = 0; i < imageBuffers.length; i++) {
            doc.addPage();
            try {
                doc.image(imageBuffers[i], 50, 50, { fit: [500, 700] });
                doc.fontSize(10).text(`Page ${i + 1}`, 50, 750);
            } catch (error) {
                doc.fontSize(12).text(`Error adding image ${i + 1}: ${error.message}`, 50, 50);
            }
        }
        
        doc.end();
        
        console.log(`✅ Validation PDF created: ${outputPath}`);
        return true;
        
    } catch (error) {
        console.log('❌ FAILED:', error.message);
        return false;
    }
}

createValidationPDF().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Validation script error:', error);
    process.exit(1);
});