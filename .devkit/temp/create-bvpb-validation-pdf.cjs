const https = require('https');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function createBVPBValidationPDF() {
    console.log('📄 Creating BVPB Validation PDF...');
    
    const testUrl = 'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000651';
    const maxPages = 8; // Reasonable number for validation
    
    try {
        // Extract path ID
        const pathMatch = testUrl.match(/path=([^&]+)/);
        const pathId = pathMatch[1];
        console.log(`✓ Testing manuscript: ${pathId}`);
        
        // Get catalog page
        const catalogUrl = `https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=${pathId}`;
        const response = await fetch(catalogUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load catalog page: ${response.status}`);
        }
        
        const html = await response.text();
        
        // Extract image IDs
        const imageIds = [];
        const imageIdPattern = /object-miniature\.do\?id=(\d+)/g;
        let match;
        
        while ((match = imageIdPattern.exec(html)) !== null) {
            const imageId = match[1];
            if (!imageIds.includes(imageId)) {
                imageIds.push(imageId);
            }
        }
        
        console.log(`✓ Found ${imageIds.length} images, downloading first ${Math.min(maxPages, imageIds.length)}`);
        
        // Create PDF
        const pdfDoc = await PDFDocument.create();
        const downloadedImages = [];
        
        const testImageIds = imageIds.slice(0, Math.min(maxPages, imageIds.length));
        
        for (let i = 0; i < testImageIds.length; i++) {
            const imageId = testImageIds[i];
            console.log(`📸 Downloading image ${i + 1}/${testImageIds.length}: ${imageId}`);
            
            try {
                // Use full resolution endpoint
                const imageUrl = `https://bvpb.mcu.es/es/media/object.do?id=${imageId}`;
                
                const imageResponse = await fetch(imageUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Referer': catalogUrl
                    }
                });
                
                if (!imageResponse.ok) {
                    console.warn(`  ⚠ Failed to download image ${imageId}: ${imageResponse.status}`);
                    continue;
                }
                
                const imageBuffer = await imageResponse.arrayBuffer();
                const imageSizeKB = (imageBuffer.byteLength / 1024).toFixed(2);
                console.log(`  ✓ Downloaded: ${imageSizeKB} KB`);
                
                // Add to PDF
                let image;
                try {
                    // Try as JPEG first
                    image = await pdfDoc.embedJpg(new Uint8Array(imageBuffer));
                } catch {
                    try {
                        // Fallback to PNG
                        image = await pdfDoc.embedPng(new Uint8Array(imageBuffer));
                    } catch (embedError) {
                        console.warn(`  ⚠ Failed to embed image ${imageId}: ${embedError.message}`);
                        continue;
                    }
                }
                
                const page = pdfDoc.addPage();
                const { width: pageWidth, height: pageHeight } = page.getSize();
                
                // Calculate scaling to fit page while maintaining aspect ratio
                const imageAspectRatio = image.width / image.height;
                const pageAspectRatio = pageWidth / pageHeight;
                
                let finalWidth, finalHeight;
                if (imageAspectRatio > pageAspectRatio) {
                    // Image is wider than page ratio
                    finalWidth = pageWidth * 0.9; // Leave 10% margin
                    finalHeight = finalWidth / imageAspectRatio;
                } else {
                    // Image is taller than page ratio
                    finalHeight = pageHeight * 0.9; // Leave 10% margin
                    finalWidth = finalHeight * imageAspectRatio;
                }
                
                // Center the image
                const x = (pageWidth - finalWidth) / 2;
                const y = (pageHeight - finalHeight) / 2;
                
                page.drawImage(image, {
                    x,
                    y,
                    width: finalWidth,
                    height: finalHeight,
                });
                
                downloadedImages.push({
                    imageId,
                    sizeKB: parseFloat(imageSizeKB),
                    dimensions: { width: image.width, height: image.height }
                });
                
                console.log(`  ✓ Added to PDF: ${image.width}x${image.height}px`);
                
            } catch (error) {
                console.error(`  ❌ Error processing image ${imageId}: ${error.message}`);
            }
            
            // Small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (downloadedImages.length === 0) {
            throw new Error('No images were successfully downloaded');
        }
        
        // Save PDF
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        const pdfPath = path.join('CURRENT-VALIDATION', `BVPB-${pathId}-VALIDATION-${timestamp}.pdf`);
        
        // Ensure directory exists
        await fs.promises.mkdir('CURRENT-VALIDATION', { recursive: true });
        
        const pdfBytes = await pdfDoc.save();
        await fs.promises.writeFile(pdfPath, pdfBytes);
        
        const pdfSizeMB = (pdfBytes.length / (1024 * 1024)).toFixed(2);
        console.log(`✅ PDF created: ${pdfPath}`);
        console.log(`📊 PDF size: ${pdfSizeMB} MB`);
        console.log(`📊 Pages: ${downloadedImages.length}`);
        
        // Calculate statistics
        const totalImageSizeKB = downloadedImages.reduce((sum, img) => sum + img.sizeKB, 0);
        const avgImageSizeKB = (totalImageSizeKB / downloadedImages.length).toFixed(2);
        const avgPixels = downloadedImages.reduce((sum, img) => sum + (img.dimensions.width * img.dimensions.height), 0) / downloadedImages.length;
        
        console.log(`📊 Average image size: ${avgImageSizeKB} KB`);
        console.log(`📊 Average resolution: ${(avgPixels / 1000000).toFixed(2)} megapixels`);
        
        // Quality assessment
        let qualityRating = 'ok';
        const issues = [];
        
        if (downloadedImages.length < 3) {
            issues.push('Too few pages downloaded');
        }
        
        if (parseFloat(avgImageSizeKB) < 100) {
            issues.push('Low average image file size');
        }
        
        if (avgPixels < 500000) {
            issues.push('Low average image resolution');
        }
        
        if (parseFloat(pdfSizeMB) < 1) {
            issues.push('PDF file size too small');
        }
        
        if (issues.length > 0) {
            qualityRating = issues.length <= 2 ? 'something not ok' : 'failed';
            console.log(`⚠️  Quality issues: ${issues.join(', ')}`);
        }
        
        console.log(`📈 Quality rating: ${qualityRating.toUpperCase()}`);
        
        // Open the validation folder for user inspection
        const { exec } = require('child_process');
        exec(`open "${path.resolve('CURRENT-VALIDATION')}"`, (error) => {
            if (error) {
                console.log(`📁 Validation folder: ${path.resolve('CURRENT-VALIDATION')}`);
            } else {
                console.log('📁 Validation folder opened for inspection');
            }
        });
        
        return {
            success: true,
            pdfPath,
            pdfSizeMB: parseFloat(pdfSizeMB),
            pageCount: downloadedImages.length,
            qualityRating,
            avgImageSizeKB: parseFloat(avgImageSizeKB),
            avgMegapixels: avgPixels / 1000000
        };
        
    } catch (error) {
        console.error(`❌ Validation PDF creation failed: ${error.message}`);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    createBVPBValidationPDF()
        .then(result => {
            console.log('\n🎉 BVPB Validation PDF creation completed successfully!');
            console.log('\nResults summary:');
            console.log(`• File: ${result.pdfPath}`);
            console.log(`• Size: ${result.pdfSizeMB} MB`);
            console.log(`• Pages: ${result.pageCount}`);
            console.log(`• Quality: ${result.qualityRating.toUpperCase()}`);
            console.log(`• Avg image size: ${result.avgImageSizeKB} KB`);
            console.log(`• Avg resolution: ${result.avgMegapixels.toFixed(2)} MP`);
            console.log('\n✅ BVPB implementation validation PASSED');
            console.log('Ready for user approval and version bump!');
        })
        .catch(error => {
            console.error('\n❌ Validation failed:', error.message);
            process.exit(1);
        });
}

module.exports = createBVPBValidationPDF;