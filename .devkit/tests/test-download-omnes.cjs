
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const { PDFDocument } = require('pdf-lib');

async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = require('fs').createWriteStream(filepath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', reject);
    });
}

async function createPDF(images, outputPath) {
    const pdfDoc = await PDFDocument.create();
    
    for (const imagePath of images) {
        const imageBytes = await fs.readFile(imagePath);
        const img = await pdfDoc.embedJpg(imageBytes);
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, {
            x: 0,
            y: 0,
            width: img.width,
            height: img.height,
        });
    }
    
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, pdfBytes);
}

async function testManuscript(manifestUrl, manuscriptId) {
    console.log('Testing manuscript:', manuscriptId);
    
    // Fetch manifest
    const manifestData = await new Promise((resolve, reject) => {
        https.get(manifestUrl, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
    
    const canvases = manifestData.sequences[0].canvases;
    console.log('Total pages:', canvases.length);
    
    // Download first 10 pages
    const outputDir = `.devkit/validation/omnes-vallicelliana/${manuscriptId}`;
    await fs.mkdir(outputDir, { recursive: true });
    
    const images = [];
    const pagesToDownload = Math.min(10, canvases.length);
    
    for (let i = 0; i < pagesToDownload; i++) {
        const canvas = canvases[i];
        const serviceId = canvas.images[0].resource.service['@id'];
        const canvasId = serviceId.split('/').pop();
        const imageUrl = `https://omnes.dbseret.com/vallicelliana/iiif/2/${canvasId}/full/full/0/default.jpg`;
        
        const imagePath = path.join(outputDir, `page-${String(i + 1).padStart(3, '0')}.jpg`);
        console.log(`Downloading page ${i + 1}/${pagesToDownload}...`);
        await downloadImage(imageUrl, imagePath);
        images.push(imagePath);
    }
    
    // Create PDF
    const pdfPath = `.devkit/validation/omnes-vallicelliana/${manuscriptId}.pdf`;
    await createPDF(images, pdfPath);
    console.log('Created PDF:', pdfPath);
    
    return pdfPath;
}

// Test both manuscripts
Promise.all([
    testManuscript('https://omnes.dbseret.com/vallicelliana/iiif/IT-RM0281_D5/manifest', 'IT-RM0281_D5'),
    testManuscript('https://omnes.dbseret.com/vallicelliana/iiif/IT-RM0281_B6/manifest', 'IT-RM0281_B6')
]).then(() => {
    console.log('\nAll tests completed successfully!');
}).catch(console.error);
