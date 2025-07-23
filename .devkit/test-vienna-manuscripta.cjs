const fs = require('fs');
const { execSync } = require('child_process');
const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

const fetchFn = (url, options = {}) => {
    const https = require('https');
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
        const https = require('https');
        const file = fs.createWriteStream(filepath);
        
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Referer': 'https://manuscripta.at/'
            },
            timeout: 30000
        };

        https.get(url, options, (response) => {
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

async function testViennaManuscripta() {
    console.log('=== Vienna Manuscripta Hanging Test ===\n');
    
    const loader = new SharedManifestLoaders(fetchFn);
    const testUrl = 'https://manuscripta.at/diglit/AT5000-71/0001';
    
    try {
        console.log('Testing Vienna Manuscripta:', testUrl);
        const result = await loader.getViennaManuscriptaManifest(testUrl);
        
        console.log(`✅ Found ${result.images.length} pages`);
        
        // Test download of first 3 pages
        const validationDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/validation-results/vienna-manuscripta-test';
        if (!fs.existsSync(validationDir)) {
            fs.mkdirSync(validationDir, { recursive: true });
        }
        
        const downloadedFiles = [];
        for (let i = 0; i < Math.min(3, result.images.length); i++) {
            const image = result.images[i];
            const filename = `vienna_manuscripta_page_${i + 1}.jpg`;
            const filepath = `${validationDir}/${filename}`;
            
            console.log(`Downloading page ${i + 1}: ${image.label}`);
            await downloadImage(image.url, filepath);
            downloadedFiles.push(filepath);
            
            const stats = fs.statSync(filepath);
            console.log(`✅ Downloaded: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        }
        
        // Create PDF
        const pdfPath = `${validationDir}/Vienna_Manuscripta_validation.pdf`;
        const convertCmd = `convert ${downloadedFiles.map(f => `"${f}"`).join(' ')} "${pdfPath}"`;
        execSync(convertCmd);
        
        const pdfStats = fs.statSync(pdfPath);
        console.log(`✅ PDF created: Vienna_Manuscripta_validation.pdf (${(pdfStats.size / 1024 / 1024).toFixed(2)} MB)`);
        
        // Clean up individual images
        for (const file of downloadedFiles) {
            fs.unlinkSync(file);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Vienna Manuscripta test failed:', error.message);
        return false;
    }
}

testViennaManuscripta().then(success => {
    console.log('\n=== Vienna Manuscripta Test Result ===');
    console.log(success ? '✅ Vienna Manuscripta hanging RESOLVED' : '❌ Vienna Manuscripta still hanging midway');
    process.exit(success ? 0 : 1);
});