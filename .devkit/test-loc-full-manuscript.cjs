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
            timeout: 60000
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

function downloadImage(url, filepath, pageNum, totalPages) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        const timeout = setTimeout(() => {
            file.destroy();
            fs.unlink(filepath, () => {});
            reject(new Error(`Download timeout on page ${pageNum}/${totalPages}`));
        }, 120000); // 2 minute timeout per image

        console.log(`[${pageNum}/${totalPages}] Starting download...`);
        const startTime = Date.now();

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
            
            if (response.statusCode !== 200) {
                file.destroy();
                fs.unlink(filepath, () => {});
                reject(new Error(`HTTP ${response.statusCode} on page ${pageNum}`));
                return;
            }

            let downloadedBytes = 0;
            response.on('data', (chunk) => {
                downloadedBytes += chunk.length;
            });

            response.pipe(file);
            file.on('finish', () => {
                file.close();
                const downloadTime = Date.now() - startTime;
                console.log(`[${pageNum}/${totalPages}] ✅ Downloaded (${(downloadedBytes / 1024 / 1024).toFixed(2)} MB) in ${downloadTime}ms`);
                resolve();
            });
        }).on('error', (err) => {
            clearTimeout(timeout);
            file.destroy();
            fs.unlink(filepath, () => {});
            reject(new Error(`Network error on page ${pageNum}: ${err.message}`));
        });
    });
}

async function testLOCFullManuscript() {
    console.log('=== Library of Congress FULL Manuscript Download Test ===\n');
    console.log('This will test downloading ALL pages to find where it gets stuck');
    
    const loader = new SharedManifestLoaders(fetchFn);
    const url = 'https://www.loc.gov/item/2010414164/';
    
    try {
        console.log('Getting manifest...');
        const result = await loader.getManifestForLibrary('loc', url);
        console.log(`Found ${result.images.length} pages total\n`);
        
        // Create test directory
        const testDir = path.join(__dirname, 'loc-full-test');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        
        const downloadedFiles = [];
        let stuckAt = -1;
        
        console.log('Starting FULL manuscript download...\n');
        
        for (let i = 0; i < result.images.length; i++) {
            const image = result.images[i];
            const filename = `loc_page_${String(i + 1).padStart(2, '0')}.jpg`;
            const filepath = path.join(testDir, filename);
            
            try {
                await downloadImage(image.url, filepath, i + 1, result.images.length);
                downloadedFiles.push(filepath);
                
                // Small delay to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.log(`\n❌ STUCK AT PAGE ${i + 1}: ${error.message}`);
                console.log(`🔍 This is where the download gets stuck!`);
                stuckAt = i + 1;
                break;
            }
        }
        
        if (stuckAt === -1) {
            console.log('\n✅ ALL PAGES DOWNLOADED SUCCESSFULLY!');
            console.log('The Library of Congress download issue appears to be resolved');
            
            // Test PDF creation with all pages
            console.log('\nTesting PDF creation with all pages...');
            const pdfPath = path.join(testDir, 'LOC_FULL_test.pdf');
            
            try {
                const convertCmd = `convert ${downloadedFiles.map(f => `"${f}"`).join(' ')} "${pdfPath}"`;
                console.log('Creating PDF (this may take a while)...');
                execSync(convertCmd, { timeout: 300000 }); // 5 minute timeout
                
                const pdfStats = fs.statSync(pdfPath);
                console.log(`✅ Full PDF created: ${(pdfStats.size / 1024 / 1024).toFixed(2)} MB`);
                
                // Verify with poppler
                const pdfInfo = execSync(`pdfinfo "${pdfPath}"`).toString();
                console.log('✅ PDF verification passed');
                
            } catch (pdfError) {
                console.log(`❌ PDF creation failed: ${pdfError.message}`);
                if (pdfError.message.includes('timeout')) {
                    console.log('🔍 PDF creation timeout may be the cause of "stuck" downloads in production');
                }
            }
        } else {
            console.log(`\n📊 DOWNLOAD STATISTICS:`);
            console.log(`- Successfully downloaded: ${downloadedFiles.length}/${result.images.length} pages`);
            console.log(`- Stuck at page: ${stuckAt}`);
            console.log(`- Success rate: ${((downloadedFiles.length / result.images.length) * 100).toFixed(1)}%`);
        }
        
        // Clean up test files
        console.log('\nCleaning up test files...');
        for (const file of downloadedFiles) {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        }
        
        if (fs.existsSync(testDir)) {
            try {
                fs.rmdirSync(testDir);
            } catch (e) {
                // Directory may not be empty, try to clean remaining files
                const remaining = fs.readdirSync(testDir);
                for (const file of remaining) {
                    fs.unlinkSync(path.join(testDir, file));
                }
                fs.rmdirSync(testDir);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testLOCFullManuscript().catch(console.error);