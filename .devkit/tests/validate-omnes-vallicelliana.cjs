const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test the parsing of Omnes Vallicelliana URLs
async function testParsing() {
    console.log('Testing Omnes Vallicelliana URL parsing...\n');
    
    const testUrls = [
        'https://omnes.dbseret.com/vallicelliana/iiif/IT-RM0281_D5/manifest',
        'https://omnes.dbseret.com/vallicelliana/iiif/IT-RM0281_B6/manifest',
        'https://omnes.dbseret.com/vallicelliana/'
    ];
    
    // Create a test script that uses the actual manuscript downloader
    const testScript = `
const { app } = require('electron');
const { EnhancedManuscriptDownloaderService } = require('./src/main/services/EnhancedManuscriptDownloaderService');
const { ElectronPdfMerger } = require('./src/main/services/ElectronPdfMerger');
const { ApplicationLogger } = require('./src/main/services/ApplicationLogger');

app.whenReady().then(async () => {
    const logger = new ApplicationLogger();
    const pdfMerger = new ElectronPdfMerger();
    const downloader = new EnhancedManuscriptDownloaderService(pdfMerger, logger);
    
    const urls = ${JSON.stringify(testUrls)};
    
    for (const url of urls) {
        try {
            console.log('\\nTesting URL:', url);
            const library = downloader.detectLibrary(url);
            console.log('Detected library:', library);
            
            if (library === 'omnes_vallicelliana' && url.includes('/manifest')) {
                const manifest = await downloader.parseManuscriptUrl(url);
                console.log('Successfully parsed manifest:');
                console.log('- Display name:', manifest.displayName);
                console.log('- Total pages:', manifest.totalPages);
                console.log('- Library:', manifest.library);
                console.log('- First page URL:', manifest.pageLinks[0]);
            }
        } catch (error) {
            console.error('Error:', error.message);
        }
    }
    
    app.quit();
});
`;
    
    fs.writeFileSync('.devkit/tests/test-parsing.js', testScript);
    
    try {
        const output = execSync('npm run test:parsing', { 
            encoding: 'utf-8',
            cwd: process.cwd() 
        });
        console.log(output);
    } catch (error) {
        console.error('Parsing test failed:', error.message);
    }
}

// Test downloading and creating PDFs
async function testDownload() {
    console.log('\nTesting Omnes Vallicelliana PDF creation...\n');
    
    const testScript = `
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
    const outputDir = \`.devkit/validation/omnes-vallicelliana/\${manuscriptId}\`;
    await fs.mkdir(outputDir, { recursive: true });
    
    const images = [];
    const pagesToDownload = Math.min(10, canvases.length);
    
    for (let i = 0; i < pagesToDownload; i++) {
        const canvas = canvases[i];
        const serviceId = canvas.images[0].resource.service['@id'];
        const canvasId = serviceId.split('/').pop();
        const imageUrl = \`https://omnes.dbseret.com/vallicelliana/iiif/2/\${canvasId}/full/full/0/default.jpg\`;
        
        const imagePath = path.join(outputDir, \`page-\${String(i + 1).padStart(3, '0')}.jpg\`);
        console.log(\`Downloading page \${i + 1}/\${pagesToDownload}...\`);
        await downloadImage(imageUrl, imagePath);
        images.push(imagePath);
    }
    
    // Create PDF
    const pdfPath = \`.devkit/validation/omnes-vallicelliana/\${manuscriptId}.pdf\`;
    await createPDF(images, pdfPath);
    console.log('Created PDF:', pdfPath);
    
    return pdfPath;
}

// Test both manuscripts
Promise.all([
    testManuscript('https://omnes.dbseret.com/vallicelliana/iiif/IT-RM0281_D5/manifest', 'IT-RM0281_D5'),
    testManuscript('https://omnes.dbseret.com/vallicelliana/iiif/IT-RM0281_B6/manifest', 'IT-RM0281_B6')
]).then(() => {
    console.log('\\nAll tests completed successfully!');
}).catch(console.error);
`;
    
    fs.writeFileSync('.devkit/tests/test-download-omnes.cjs', testScript);
    
    try {
        execSync('node .devkit/tests/test-download-omnes.cjs', { 
            stdio: 'inherit',
            cwd: process.cwd() 
        });
    } catch (error) {
        console.error('Download test failed:', error.message);
    }
}

// Run tests
async function main() {
    console.log('=== Omnes Vallicelliana Library Validation ===\n');
    
    // Create output directory
    if (!fs.existsSync('.devkit/validation/omnes-vallicelliana')) {
        fs.mkdirSync('.devkit/validation/omnes-vallicelliana', { recursive: true });
    }
    
    await testDownload();
    
    console.log('\n=== Validation Complete ===');
    console.log('Check .devkit/validation/omnes-vallicelliana/ for the generated PDFs');
}

main().catch(console.error);