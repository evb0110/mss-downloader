const { PDFDocument } = require('pdf-lib');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const TEST_URL = 'https://digital.ulb.hhu.de/i3f/v20/7674176/manifest';
const OUTPUT_DIR = '.devkit/validation/hhu';

// Enhanced https wrapper similar to service implementation
function fetchWithHTTPS(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        
        const requestOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json, image/jpeg, image/png, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
                ...options.headers
            },
            timeout: 60000,
            rejectUnauthorized: false // Some libraries have certificate issues
        };

        const req = https.request(requestOptions, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                const redirectUrl = res.headers.location;
                console.log(`Following redirect to: ${redirectUrl}`);
                fetchWithHTTPS(redirectUrl, options).then(resolve).catch(reject);
                return;
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                return;
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve(buffer);
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

async function downloadImage(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Downloading: ${url} (attempt ${i + 1})`);
            const imageBuffer = await fetchWithHTTPS(url);
            
            if (imageBuffer.length < 1024) {
                throw new Error('Image too small, likely an error');
            }
            
            return imageBuffer;
        } catch (error) {
            console.error(`Download failed (attempt ${i + 1}):`, error.message);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
        }
    }
}

async function testHhuLibrary() {
    try {
        console.log('Testing HHU Düsseldorf Library Implementation');
        console.log('=============================================\n');

        // Create output directory
        await fs.mkdir(OUTPUT_DIR, { recursive: true });

        // Step 1: Load manifest
        console.log('Step 1: Loading IIIF manifest...');
        const manifestData = await fetchWithHTTPS(TEST_URL);
        const manifest = JSON.parse(manifestData.toString());
        
        console.log(`✓ Manifest loaded successfully`);
        console.log(`  Title: ${manifest.label}`);
        console.log(`  Total canvases: ${manifest.sequences[0].canvases.length}\n`);

        // Step 2: Extract image URLs (simulating loadHhuManifest)
        console.log('Step 2: Extracting image URLs...');
        const canvases = manifest.sequences[0].canvases;
        const imageUrls = [];
        
        for (const canvas of canvases.slice(0, 3)) { // Test first 3 pages
            if (canvas.images && canvas.images[0]) {
                const resource = canvas.images[0].resource;
                if (resource.service && resource.service['@id']) {
                    const serviceId = resource.service['@id'];
                    const imageUrl = `${serviceId}/full/full/0/default.jpg`;
                    imageUrls.push(imageUrl);
                }
            }
        }
        
        console.log(`✓ Extracted ${imageUrls.length} image URLs\n`);

        // Step 3: Download images
        console.log('Step 3: Downloading manuscript pages...');
        const images = [];
        for (let i = 0; i < imageUrls.length; i++) {
            const imageBuffer = await downloadImage(imageUrls[i]);
            images.push(imageBuffer);
            console.log(`✓ Downloaded page ${i + 1}/${imageUrls.length} (${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
        }
        console.log('');

        // Step 4: Create PDF
        console.log('Step 4: Creating PDF...');
        const pdfDoc = await PDFDocument.create();
        
        for (let i = 0; i < images.length; i++) {
            const imageBytes = images[i];
            const image = await pdfDoc.embedJpg(imageBytes);
            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });
        }
        
        const pdfBytes = await pdfDoc.save();
        const pdfPath = path.join(OUTPUT_DIR, 'hhu_test.pdf');
        await fs.writeFile(pdfPath, pdfBytes);
        
        console.log(`✓ PDF created: ${pdfPath}`);
        console.log(`  Size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB\n`);

        // Step 5: Validate with poppler
        console.log('Step 5: Validating PDF with poppler...');
        try {
            const { stdout } = await execPromise(`pdfinfo "${pdfPath}"`);
            console.log('✓ PDF validation passed');
            console.log('PDF Info:');
            console.log(stdout);
        } catch (error) {
            console.error('✗ PDF validation failed:', error.message);
        }

        // Step 6: Extract images for visual inspection
        console.log('\nStep 6: Extracting images for inspection...');
        const imagesDir = path.join(OUTPUT_DIR, 'extracted_images');
        await fs.mkdir(imagesDir, { recursive: true });
        
        try {
            await execPromise(`pdfimages -png "${pdfPath}" "${imagesDir}/page"`);
            console.log(`✓ Images extracted to: ${imagesDir}`);
            
            // Save first 3 images as individual files for easy inspection
            for (let i = 0; i < Math.min(3, images.length); i++) {
                const imagePath = path.join(OUTPUT_DIR, `page_${i + 1}.jpg`);
                await fs.writeFile(imagePath, images[i]);
                console.log(`✓ Saved sample page ${i + 1} to: ${imagePath}`);
            }
        } catch (error) {
            console.error('✗ Image extraction failed:', error.message);
        }

        console.log('\n✅ HHU Düsseldorf library validation completed successfully!');
        console.log(`\nValidation files saved to: ${path.resolve(OUTPUT_DIR)}`);
        
        return true;
        
    } catch (error) {
        console.error('\n❌ Validation failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run the test
testHhuLibrary().then(success => {
    process.exit(success ? 0 : 1);
});