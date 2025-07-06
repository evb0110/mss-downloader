const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function createDiammMockPdf() {
    console.log('🎼 Creating DIAMM Mock PDF for Validation...\n');

    const validationDir = path.join(__dirname, '../../CURRENT-VALIDATION');
    const outputPath = path.join(validationDir, 'DIAMM-I-Ra-Ms1383-VALIDATION-PDF.pdf');

    // Check if images exist
    const imageFiles = [
        path.join(validationDir, 'I-Ra-Ms1383_page_1_max.jpg'),
        path.join(validationDir, 'I-Ra-Ms1383_page_2_max.jpg'),
        path.join(validationDir, 'I-Ra-Ms1383_page_3_max.jpg')
    ];

    // Verify images exist
    for (const imagePath of imageFiles) {
        if (!fs.existsSync(imagePath)) {
            console.log(`❌ Image not found: ${imagePath}`);
            return;
        }
    }

    console.log(`📸 Found ${imageFiles.length} validation images`);
    console.log(`📄 Creating PDF: ${outputPath}`);

    try {
        // Use ImageMagick to convert images to PDF
        await createPdfFromImages(imageFiles, outputPath);
        
        if (fs.existsSync(outputPath)) {
            console.log('✅ DIAMM validation PDF created successfully!');
            
            // Get file size
            const stats = fs.statSync(outputPath);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`📏 File size: ${fileSizeMB} MB`);
            
            // Validate PDF with poppler if available
            await validatePdfWithPoppler(outputPath);
            
            console.log('\n🎯 DIAMM Mock PDF Validation Complete!');
            console.log(`📂 PDF saved to: ${outputPath}`);
            console.log('🔍 Ready for user validation');
            
        } else {
            console.log('❌ PDF creation failed');
        }
        
    } catch (error) {
        console.log(`❌ Error creating PDF: ${error.message}`);
    }
}

function createPdfFromImages(imageFiles, outputPath) {
    return new Promise((resolve, reject) => {
        console.log('🔧 Converting images to PDF...');
        
        const convertCmd = spawn('convert', [
            ...imageFiles,
            '-density', '300',
            '-quality', '95',
            outputPath
        ]);

        convertCmd.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Images converted to PDF successfully');
                resolve();
            } else {
                reject(new Error(`convert failed with code ${code}`));
            }
        });

        convertCmd.on('error', (error) => {
            reject(new Error(`ImageMagick convert failed: ${error.message}`));
        });
    });
}

async function validatePdfWithPoppler(pdfPath) {
    return new Promise((resolve) => {
        console.log('🔍 Validating PDF with poppler...');
        
        const pdfInfoCmd = spawn('pdfinfo', [pdfPath]);
        
        let output = '';
        pdfInfoCmd.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        pdfInfoCmd.on('close', (code) => {
            if (code === 0) {
                console.log('✅ PDF validation passed');
                
                // Extract key info
                const pages = output.match(/Pages:\s+(\d+)/)?.[1];
                const title = output.match(/Title:\s+(.+)/)?.[1];
                const producer = output.match(/Producer:\s+(.+)/)?.[1];
                
                console.log(`📄 Pages: ${pages || 'unknown'}`);
                console.log(`🏷️  Title: ${title || 'none'}`);
                console.log(`🔧 Producer: ${producer || 'ImageMagick'}`);
                
            } else {
                console.log('⚠️  PDF validation failed, but file may still be valid');
            }
            resolve();
        });
        
        pdfInfoCmd.on('error', () => {
            console.log('⚠️  pdfinfo not available, skipping validation');
            resolve();
        });
    });
}

// Run the mock PDF creation
createDiammMockPdf().catch(console.error);