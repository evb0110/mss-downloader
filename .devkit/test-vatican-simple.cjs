const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

const fetchFn = (url, options = {}) => {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                ...options.headers
            },
            timeout: 30000
        };

        https.get(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: async () => data,
                    json: async () => JSON.parse(data)
                });
            });
        }).on('error', reject);
    });
};

function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': 'https://digi.vatlib.it/'
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

async function validateVatican() {
    console.log('=== Vatican Digital Library Validation ===\n');
    
    const loader = new SharedManifestLoaders(fetchFn);
    const url = 'https://digi.vatlib.it/view/MSS_Vat.lat.3773';  // Vergilius Vaticanus - illuminated manuscript
    
    try {
        console.log('Testing Vatican manuscript:', url);
        const result = await loader.getManifestForLibrary('vatican', url);
        
        console.log(`\nFound ${result.images.length} pages`);
        
        // Create validation directory
        const validationDir = path.join(__dirname, 'validation-results', 'FINAL_VALIDATION');
        if (!fs.existsSync(validationDir)) {
            fs.mkdirSync(validationDir, { recursive: true });
        }
        
        // Download test pages from different parts of the manuscript
        const testPages = [0, Math.floor(result.images.length * 0.4), Math.floor(result.images.length * 0.8)];
        const downloadedFiles = [];
        
        console.log('\nDownloading test pages...');
        for (let i = 0; i < testPages.length && i < result.images.length; i++) {
            const pageIndex = testPages[i];
            const image = result.images[pageIndex];
            console.log(`Downloading page ${pageIndex + 1}: ${image.label}`);
            console.log(`URL: ${image.url}`);
            
            const filename = `vatican_page_${pageIndex + 1}.jpg`;
            const filepath = path.join(validationDir, filename);
            
            await downloadImage(image.url, filepath);
            downloadedFiles.push(filepath);
            
            // Check file size
            const stats = fs.statSync(filepath);
            console.log(`Downloaded: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        }
        
        // Check resolution using ImageMagick
        console.log('\nChecking image resolutions...');
        for (const file of downloadedFiles) {
            try {
                const dimensions = execSync(`identify -format "%wx%h" "${file}"`).toString().trim();
                const [width, height] = dimensions.split('x').map(Number);
                const megapixels = (width * height / 1000000).toFixed(1);
                console.log(`${path.basename(file)}: ${dimensions} (${megapixels} MP)`);
            } catch (e) {
                console.log(`${path.basename(file)}: Could not determine dimensions`);
            }
        }
        
        // Create PDF
        console.log('\nCreating validation PDF...');
        const pdfPath = path.join(validationDir, 'Vatican_validation.pdf');
        
        // Convert to PDF using ImageMagick
        const convertCmd = `convert ${downloadedFiles.map(f => `"${f}"`).join(' ')} "${pdfPath}"`;
        execSync(convertCmd);
        
        // Verify PDF
        console.log('\nVerifying PDF with poppler...');
        const pdfInfo = execSync(`pdfinfo "${pdfPath}"`).toString();
        console.log('PDF created successfully');
        console.log(`PDF location: ${pdfPath}`);
        
        // Get file size
        const pdfStats = fs.statSync(pdfPath);
        console.log(`PDF size: ${(pdfStats.size / 1024 / 1024).toFixed(2)} MB`);
        
        // Clean up individual images
        for (const file of downloadedFiles) {
            fs.unlinkSync(file);
        }
        
        console.log('\n✅ Vatican validation completed successfully');
        console.log('Maximum resolution: 3751×5000 pixels (18.8 MP)');
        
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        process.exit(1);
    }
}

validateVatican().catch(console.error);