const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { PDFDocument } = require('pdf-lib');
const { execSync } = require('child_process');

async function fetchWithHTTPS(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        const options = url.startsWith('https') ? {
            rejectUnauthorized: false,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache'
            }
        } : {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };
        
        client.get(url, options, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                const redirectUrl = res.headers.location;
                console.log(`Redirected to: ${redirectUrl}`);
                fetchWithHTTPS(redirectUrl).then(resolve).catch(reject);
                return;
            }
            
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function downloadImage(url, outputPath, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Downloading: ${url}`);
            const response = await fetchWithHTTPS(url);
            
            return new Promise((resolve, reject) => {
                const client = url.startsWith('https') ? https : http;
                const options = url.startsWith('https') ? {
                    rejectUnauthorized: false,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'image/*',
                        'Accept-Language': 'en-US,en;q=0.9'
                    }
                } : {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                };
                
                const file = fs.createWriteStream(outputPath);
                client.get(url, options, (res) => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`HTTP ${res.statusCode}`));
                        return;
                    }
                    
                    res.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        const stats = fs.statSync(outputPath);
                        console.log(`Downloaded: ${path.basename(outputPath)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                        resolve();
                    });
                }).on('error', (err) => {
                    fs.unlink(outputPath, () => {});
                    reject(err);
                });
            });
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error.message);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

async function testHHU() {
    const manifestUrl = 'https://digital.ulb.hhu.de/i3f/v20/7674176/manifest';
    const outputDir = path.join(__dirname, 'hhu-validation-' + Date.now());
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log('Testing HHU Düsseldorf manuscript viewer...');
    console.log('Manifest URL:', manifestUrl);
    
    try {
        // Fetch manifest
        console.log('\nFetching manifest...');
        const manifestData = await fetchWithHTTPS(manifestUrl);
        const manifest = JSON.parse(manifestData);
        
        console.log('Manifest label:', manifest.label);
        
        if (!manifest.sequences || !manifest.sequences[0] || !manifest.sequences[0].canvases) {
            throw new Error('Invalid manifest structure');
        }
        
        const canvases = manifest.sequences[0].canvases;
        console.log(`Total pages in manifest: ${canvases.length}`);
        
        // Extract image URLs and test different resolutions
        const testPages = canvases.slice(0, Math.min(10, canvases.length));
        const imageUrls = [];
        
        console.log('\nTesting maximum resolution parameters...');
        
        for (let i = 0; i < testPages.length; i++) {
            const canvas = testPages[i];
            if (!canvas.images || !canvas.images[0]) continue;
            
            const image = canvas.images[0];
            const resource = image.resource;
            
            if (resource.service && resource.service['@id']) {
                const serviceId = resource.service['@id'];
                
                // Test different resolution parameters
                if (i === 0) {
                    console.log('\nTesting different IIIF parameters for first page:');
                    const resolutionTests = [
                        { param: 'full/full/0/default.jpg', desc: 'Maximum resolution (full/full)' },
                        { param: 'full/max/0/default.jpg', desc: 'Max parameter' },
                        { param: 'full/4000,/0/default.jpg', desc: '4000px width' },
                        { param: 'full/2000,/0/default.jpg', desc: '2000px width' },
                        { param: 'full/1000,/0/default.jpg', desc: '1000px width' }
                    ];
                    
                    for (const test of resolutionTests) {
                        try {
                            const testUrl = `${serviceId}/${test.param}`;
                            const testPath = path.join(outputDir, `resolution-test-${test.param.replace(/\//g, '-')}`);
                            await downloadImage(testUrl, testPath);
                            
                            // Get image info using sips
                            try {
                                const sipsOutput = execSync(`sips -g pixelWidth -g pixelHeight "${testPath}"`, { encoding: 'utf8' });
                                console.log(`  ${test.desc}: ${sipsOutput.trim()}`);
                            } catch (e) {
                                console.log(`  ${test.desc}: Downloaded successfully`);
                            }
                        } catch (err) {
                            console.log(`  ${test.desc}: Failed - ${err.message}`);
                        }
                    }
                }
                
                // Use maximum resolution for all pages
                const imageUrl = `${serviceId}/full/full/0/default.jpg`;
                imageUrls.push(imageUrl);
            }
        }
        
        console.log(`\nDownloading ${imageUrls.length} pages at maximum resolution...`);
        
        // Download pages
        const downloadedFiles = [];
        for (let i = 0; i < imageUrls.length; i++) {
            const outputPath = path.join(outputDir, `page-${String(i + 1).padStart(3, '0')}.jpg`);
            await downloadImage(imageUrls[i], outputPath);
            downloadedFiles.push(outputPath);
        }
        
        // Create PDF
        console.log('\nCreating PDF from downloaded images...');
        const pdfDoc = await PDFDocument.create();
        
        for (const imagePath of downloadedFiles) {
            const imageBytes = fs.readFileSync(imagePath);
            const image = await pdfDoc.embedJpg(imageBytes);
            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });
        }
        
        const pdfPath = path.join(outputDir, 'hhu-manuscript.pdf');
        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(pdfPath, pdfBytes);
        console.log(`PDF created: ${pdfPath}`);
        
        // Validate with poppler
        console.log('\nValidating PDF with poppler...');
        try {
            const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
            console.log('PDF validation passed!');
            console.log(pdfInfo.split('\n').slice(0, 10).join('\n'));
        } catch (error) {
            console.error('PDF validation failed:', error.message);
        }
        
        console.log('\nValidation complete! Check the output directory:', outputDir);
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testHHU().catch(console.error);