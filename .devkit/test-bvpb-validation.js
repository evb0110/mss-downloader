const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');
const fs = require('fs').promises;
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const https = require('https');
const { promisify } = require('util');
const { exec: execCallback } = require('child_process');
const exec = promisify(execCallback);

// Test URLs for BVPB manuscripts
const TEST_URLS = [
    'https://bvpb.mcu.es/es/consulta/registro.do?id=451885', // Apologia circa opportuna tempora
    'https://bvpb.mcu.es/es/consulta/registro.do?id=472568', // Cantigas de Santa María
    'https://bvpb.mcu.es/es/consulta/registro.do?id=472569', // Beato de Liébana
    'https://bvpb.mcu.es/es/consulta/registro.do?id=463334', // Códice Rico
    'https://bvpb.mcu.es/es/consulta/registro.do?id=451876', // Libro de horas
    'https://bvpb.mcu.es/es/consulta/registro.do?id=465821', // Breviario
    'https://bvpb.mcu.es/es/consulta/registro.do?id=451887', // Biblia
    'https://bvpb.mcu.es/es/consulta/registro.do?id=472567', // Apocalipsis
    'https://bvpb.mcu.es/es/consulta/registro.do?id=451883', // Evangeliario
    'https://bvpb.mcu.es/es/consulta/registro.do?id=451879'  // Misal
];

// Helper function to download image
async function downloadImage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        }).on('error', reject);
    });
}

// Main validation function
async function validateBVPB() {
    console.log('=== BVPB Validation Test ===\n');
    
    const loader = new SharedManifestLoaders();
    const outputDir = path.join(__dirname, 'validation-results', 'BVPB_VALIDATION');
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    const results = [];
    const successfulPdfs = [];
    
    for (let i = 0; i < TEST_URLS.length; i++) {
        const url = TEST_URLS[i];
        const manuscriptId = url.match(/id=(\d+)/)[1];
        console.log(`\n[${i + 1}/${TEST_URLS.length}] Testing manuscript ${manuscriptId}`);
        console.log(`URL: ${url}`);
        
        const result = {
            url,
            manuscriptId,
            status: 'pending',
            pageCount: 0,
            error: null,
            imageSizes: [],
            pdfPath: null
        };
        
        try {
            // Get manifest
            console.log('Fetching manifest...');
            const manifest = await loader.getBVPBManifest(url);
            
            if (!manifest.images || manifest.images.length === 0) {
                throw new Error('No images found in manifest');
            }
            
            console.log(`Found ${manifest.images.length} pages`);
            result.pageCount = manifest.images.length;
            
            // Create PDF
            const pdfDoc = await PDFDocument.create();
            
            // Download each page
            for (let j = 0; j < manifest.images.length; j++) {
                const image = manifest.images[j];
                console.log(`  Downloading page ${j + 1}/${manifest.images.length}...`);
                
                try {
                    const imageBuffer = await downloadImage(image.url);
                    
                    // Check image size
                    result.imageSizes.push({
                        page: j + 1,
                        size: (imageBuffer.length / 1024).toFixed(2) + ' KB'
                    });
                    
                    // Embed in PDF
                    const pdfImage = await pdfDoc.embedJpg(imageBuffer);
                    const page = pdfDoc.addPage([pdfImage.width, pdfImage.height]);
                    page.drawImage(pdfImage, {
                        x: 0,
                        y: 0,
                        width: pdfImage.width,
                        height: pdfImage.height
                    });
                    
                } catch (imgError) {
                    console.error(`  Error with page ${j + 1}:`, imgError.message);
                    result.error = `Page ${j + 1} error: ${imgError.message}`;
                }
            }
            
            // Save PDF
            const pdfPath = path.join(outputDir, `BVPB_${manuscriptId}.pdf`);
            const pdfBytes = await pdfDoc.save();
            await fs.writeFile(pdfPath, pdfBytes);
            
            // Verify PDF with poppler
            try {
                const { stdout } = await exec(`pdfinfo "${pdfPath}"`);
                if (stdout.includes('Pages:')) {
                    result.status = 'success';
                    result.pdfPath = pdfPath;
                    successfulPdfs.push(pdfPath);
                    console.log(`✓ PDF created successfully: ${path.basename(pdfPath)}`);
                }
            } catch (pdfError) {
                result.status = 'pdf_invalid';
                result.error = 'PDF validation failed';
            }
            
        } catch (error) {
            result.status = 'failed';
            result.error = error.message;
            console.error(`✗ Error: ${error.message}`);
        }
        
        results.push(result);
    }
    
    // Generate summary report
    const summary = {
        timestamp: new Date().toISOString(),
        totalTested: TEST_URLS.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length,
        results
    };
    
    // Save report
    await fs.writeFile(
        path.join(outputDir, 'validation-report.json'),
        JSON.stringify(summary, null, 2)
    );
    
    // Print summary
    console.log('\n=== Validation Summary ===');
    console.log(`Total manuscripts tested: ${summary.totalTested}`);
    console.log(`Successful: ${summary.successful}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`\nPDFs created in: ${outputDir}`);
    
    // Visual inspection of PDFs
    if (successfulPdfs.length > 0) {
        console.log('\n=== Visual PDF Inspection ===');
        for (const pdfPath of successfulPdfs) {
            console.log(`\nInspecting ${path.basename(pdfPath)}...`);
            
            // Extract first page as image
            const imagePath = pdfPath.replace('.pdf', '_page1.png');
            try {
                await exec(`pdfimages -png -f 1 -l 1 "${pdfPath}" "${imagePath.replace('_page1.png', '')}"`);
                
                // Get image info
                const { stdout: imgInfo } = await exec(`pdfimages -list "${pdfPath}" | head -10`);
                console.log('PDF images info:');
                console.log(imgInfo);
                
            } catch (error) {
                console.log('Could not extract images for inspection');
            }
        }
    }
    
    console.log('\nValidation complete!');
}

// Run validation
validateBVPB().catch(console.error);