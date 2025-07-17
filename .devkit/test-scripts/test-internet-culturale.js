const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { PDFDocument } = require('pdf-lib');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const TEST_URL = 'https://dam.iccu.sbn.it/mol_46/containers/avQYk0e/manifest';
const OUTPUT_DIR = path.join(__dirname, '..', 'test-outputs', 'internet-culturale');

async function downloadImage(url, outputPath) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(outputPath, response.data);
        return true;
    } catch (error) {
        console.error(`Failed to download ${url}:`, error.message);
        return false;
    }
}

async function createPDF(images, outputPath) {
    const pdfDoc = await PDFDocument.create();
    
    for (const imagePath of images) {
        const imageBytes = fs.readFileSync(imagePath);
        let image;
        
        if (imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg')) {
            image = await pdfDoc.embedJpg(imageBytes);
        } else if (imagePath.endsWith('.png')) {
            image = await pdfDoc.embedPng(imageBytes);
        } else {
            continue;
        }
        
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
        });
    }
    
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
}

async function testInternetCulturale() {
    console.log('Testing Internet Culturale with URL:', TEST_URL);
    
    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    try {
        // Fetch manifest
        console.log('Fetching manifest...');
        const manifestResponse = await axios.get(TEST_URL);
        const manifest = manifestResponse.data;
        
        console.log('Manifest type:', manifest['@type'] || manifest.type);
        console.log('Total canvases:', manifest.sequences?.[0]?.canvases?.length || 'Unknown');
        
        // Extract all image URLs
        const imageUrls = [];
        const canvases = manifest.sequences?.[0]?.canvases || [];
        
        console.log('\nProcessing canvases...');
        for (let i = 0; i < canvases.length; i++) {
            const canvas = canvases[i];
            const images = canvas.images || [];
            
            for (const image of images) {
                const resource = image.resource;
                if (resource) {
                    // Try different possible URL formats
                    let imageUrl = resource['@id'] || resource.id;
                    
                    // Check if it's a IIIF image service
                    const service = resource.service || image.service;
                    if (service) {
                        const serviceId = service['@id'] || service.id;
                        if (serviceId) {
                            // Try highest quality IIIF URL
                            imageUrl = `${serviceId}/full/full/0/default.jpg`;
                        }
                    }
                    
                    imageUrls.push({
                        url: imageUrl,
                        pageNum: i + 1
                    });
                }
            }
        }
        
        console.log(`Found ${imageUrls.length} images in manifest`);
        
        // Download images
        const downloadedImages = [];
        console.log('\nDownloading images...');
        
        for (const { url, pageNum } of imageUrls) {
            const imagePath = path.join(OUTPUT_DIR, `page_${pageNum.toString().padStart(3, '0')}.jpg`);
            console.log(`Downloading page ${pageNum}...`);
            
            if (await downloadImage(url, imagePath)) {
                downloadedImages.push(imagePath);
            }
        }
        
        console.log(`\nSuccessfully downloaded ${downloadedImages.length} images`);
        
        // Create PDF
        if (downloadedImages.length > 0) {
            const pdfPath = path.join(OUTPUT_DIR, 'internet_culturale_test.pdf');
            await createPDF(downloadedImages, pdfPath);
            console.log('\nPDF created:', pdfPath);
            
            // Verify PDF with poppler
            try {
                const { stdout } = await execPromise(`pdfinfo "${pdfPath}"`);
                console.log('\nPDF Info:', stdout);
            } catch (error) {
                console.error('Failed to verify PDF:', error.message);
            }
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testInternetCulturale().catch(console.error);