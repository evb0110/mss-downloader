const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test Vatican manifest directly
const manifestUrl = 'https://digi.vatlib.it/iiif/MSS_Vat.lat.3773/manifest.json';

function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
            }
        }, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

async function testVatican() {
    console.log('=== Direct Vatican Test ===\n');
    
    // Fetch manifest
    https.get(manifestUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json'
        }
    }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', async () => {
            try {
                const manifest = JSON.parse(data);
                console.log(`Found ${manifest.sequences[0].canvases.length} pages`);
                
                // Create validation directory
                const validationDir = path.join(__dirname, 'validation-results', 'FINAL_VALIDATION');
                if (!fs.existsSync(validationDir)) {
                    fs.mkdirSync(validationDir, { recursive: true });
                }
                
                // Test 3 pages
                const testPages = [0, 44, 88];
                const downloadedFiles = [];
                
                for (const pageIndex of testPages) {
                    const canvas = manifest.sequences[0].canvases[pageIndex];
                    const service = canvas.images[0].resource.service['@id'];
                    const imageUrl = `${service}/full/4000,/0/default.jpg`;
                    
                    console.log(`\nDownloading page ${pageIndex + 1}: ${canvas.label}`);
                    console.log(`URL: ${imageUrl}`);
                    
                    const filename = `vatican_page_${pageIndex + 1}.jpg`;
                    const filepath = path.join(validationDir, filename);
                    
                    await downloadImage(imageUrl, filepath);
                    downloadedFiles.push(filepath);
                    
                    const stats = fs.statSync(filepath);
                    console.log(`Downloaded: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                    
                    // Check resolution
                    try {
                        const dimensions = execSync(`identify -format "%wx%h" "${filepath}"`).toString().trim();
                        const [width, height] = dimensions.split('x').map(Number);
                        const megapixels = (width * height / 1000000).toFixed(1);
                        console.log(`Resolution: ${dimensions} (${megapixels} MP)`);
                    } catch (e) {
                        console.log('Could not determine dimensions');
                    }
                }
                
                // Create PDF
                console.log('\nCreating validation PDF...');
                const pdfPath = path.join(validationDir, 'Vatican_validation.pdf');
                
                const convertCmd = `convert ${downloadedFiles.map(f => `"${f}"`).join(' ')} "${pdfPath}"`;
                execSync(convertCmd);
                
                // Verify PDF
                const pdfInfo = execSync(`pdfinfo "${pdfPath}"`).toString();
                console.log('PDF created successfully');
                
                const pdfStats = fs.statSync(pdfPath);
                console.log(`PDF size: ${(pdfStats.size / 1024 / 1024).toFixed(2)} MB`);
                
                // Clean up
                for (const file of downloadedFiles) {
                    fs.unlinkSync(file);
                }
                
                console.log('\n✅ Vatican validation completed successfully');
                
            } catch (error) {
                console.error('❌ Failed:', error.message);
            }
        });
    }).on('error', console.error);
}

testVatican();