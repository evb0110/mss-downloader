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
            timeout: 45000
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
        const timeout = setTimeout(() => {
            file.destroy();
            fs.unlink(filepath, () => {});
            reject(new Error('Download timeout'));
        }, 45000);

        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': 'https://www.loc.gov/'
            }
        }, (response) => {
            clearTimeout(timeout);
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            clearTimeout(timeout);
            file.destroy();
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

async function testLOCFullDownload() {
    console.log('=== Library of Congress Full Download Test ===\n');
    
    const loader = new SharedManifestLoaders(fetchFn);
    const url = 'https://www.loc.gov/item/2010414164/';
    
    try {
        console.log('Getting manifest...');
        const result = await loader.getManifestForLibrary('loc', url);
        console.log(`Found ${result.images.length} pages`);
        
        // Create validation directory
        const validationDir = path.join(__dirname, 'validation-results', 'LOC_DEBUG');
        if (!fs.existsSync(validationDir)) {
            fs.mkdirSync(validationDir, { recursive: true });
        }
        
        // Download all pages to test where it might get stuck
        const downloadedFiles = [];
        
        console.log('\nDownloading all pages...');
        for (let i = 0; i < result.images.length; i++) {
            const image = result.images[i];
            console.log(`Downloading page ${i + 1}/${result.images.length}: ${image.label}`);
            
            const filename = `loc_page_${String(i + 1).padStart(2, '0')}.jpg`;
            const filepath = path.join(validationDir, filename);
            
            const startTime = Date.now();
            try {
                await downloadImage(image.url, filepath);
                const downloadTime = Date.now() - startTime;
                const stats = fs.statSync(filepath);
                console.log(`✅ Downloaded: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB) in ${downloadTime}ms`);
                downloadedFiles.push(filepath);
            } catch (error) {
                console.log(`❌ FAILED on page ${i + 1}: ${error.message}`);
                console.log(`🔍 This might be where the download gets stuck!`);
                break;
            }
        }
        
        if (downloadedFiles.length === result.images.length) {
            console.log('\n✅ All pages downloaded successfully!');
            
            // Test PDF creation
            console.log('\nTesting PDF creation...');
            const pdfPath = path.join(validationDir, 'LOC_test.pdf');
            
            try {
                const convertCmd = `convert ${downloadedFiles.map(f => `"${f}"`).join(' ')} "${pdfPath}"`;
                console.log('Running PDF conversion...');
                execSync(convertCmd, { timeout: 60000 });
                
                const pdfStats = fs.statSync(pdfPath);
                console.log(`✅ PDF created successfully: ${(pdfStats.size / 1024 / 1024).toFixed(2)} MB`);
                
                // Verify PDF with poppler
                const pdfInfo = execSync(`pdfinfo "${pdfPath}"`).toString();
                console.log('✅ PDF verification passed');
                
            } catch (error) {
                console.log(`❌ PDF creation failed: ${error.message}`);
                if (error.message.includes('timeout')) {
                    console.log('🔍 PDF creation might be the bottleneck causing "stuck" downloads');
                }
            }
        } else {
            console.log(`\n⚠️  Downloaded only ${downloadedFiles.length}/${result.images.length} pages`);
        }
        
        // Clean up individual images
        for (const file of downloadedFiles) {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testLOCFullDownload().catch(console.error);