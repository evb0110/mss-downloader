const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function downloadImage(url, filename) {
    return new Promise((resolve, reject) => {
        const file = require('fs').createWriteStream(filename);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', reject);
    });
}

async function validateMorganFix() {
    console.log('Validating Morgan Library fix by downloading sample pages...\n');
    
    // Create test directory
    const testDir = path.join(__dirname, 'morgan-validation');
    await fs.mkdir(testDir, { recursive: true });
    
    try {
        // Test URLs based on what we discovered
        const testPages = [
            {
                page: 1,
                url: 'https://www.themorgan.org/sites/default/files/facsimile/76874/m1-front-cover.jpg',
                name: 'page-1-front-cover.jpg'
            },
            {
                page: 2,
                url: 'https://www.themorgan.org/sites/default/files/facsimile/76874/76874v_0487-0001.jpg',
                name: 'page-2.jpg'
            },
            {
                page: 3,
                url: 'https://www.themorgan.org/sites/default/files/facsimile/76874/76874v_0002-0003.jpg',
                name: 'page-3.jpg'
            },
            {
                page: 4,
                url: 'https://www.themorgan.org/sites/default/files/facsimile/76874/76874v_0004_0005.jpg',
                name: 'page-4.jpg'
            },
            {
                page: 5,
                url: 'https://www.themorgan.org/sites/default/files/facsimile/76874/76874v_0006-0007.jpg',
                name: 'page-5.jpg'
            }
        ];
        
        console.log('Downloading sample pages...');
        
        for (const testPage of testPages) {
            const filepath = path.join(testDir, testPage.name);
            console.log(`\nDownloading page ${testPage.page}: ${testPage.url}`);
            
            try {
                await downloadImage(testPage.url, filepath);
                
                // Check file size
                const stats = await fs.stat(filepath);
                const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
                console.log(`  ✓ Downloaded: ${sizeMB} MB`);
                
                // Check if it's a valid image using file command
                try {
                    const fileInfo = execSync(`file "${filepath}"`, { encoding: 'utf8' });
                    if (fileInfo.includes('JPEG')) {
                        console.log('  ✓ Valid JPEG image');
                    } else {
                        console.log(`  ⚠️  Unexpected file type: ${fileInfo}`);
                    }
                } catch (e) {
                    // file command might not be available
                }
                
            } catch (error) {
                console.error(`  ✗ Failed to download: ${error.message}`);
            }
        }
        
        // Create a test PDF to verify quality
        console.log('\nCreating test PDF from downloaded images...');
        
        const pdfPath = path.join(testDir, 'morgan-test.pdf');
        try {
            // Use ImageMagick if available
            execSync(`convert "${testDir}"/*.jpg "${pdfPath}" 2>/dev/null`);
            const pdfStats = await fs.stat(pdfPath);
            const pdfSizeMB = (pdfStats.size / 1024 / 1024).toFixed(2);
            console.log(`✓ PDF created: ${pdfSizeMB} MB`);
            
            // Validate PDF with poppler if available
            try {
                const pdfInfo = execSync(`pdfinfo "${pdfPath}" 2>&1`, { encoding: 'utf8' });
                const pageCount = pdfInfo.match(/Pages:\s+(\d+)/)?.[1];
                console.log(`✓ PDF validated: ${pageCount} pages`);
            } catch (e) {
                // pdfinfo might not be available
            }
            
        } catch (e) {
            console.log('Note: ImageMagick not available for PDF creation');
        }
        
        console.log('\n✅ Morgan Library validation complete!');
        console.log(`Test files saved in: ${testDir}`);
        
        // Open finder
        execSync(`open "${testDir}"`);
        
    } catch (error) {
        console.error('Validation error:', error.message);
    }
}

validateMorganFix();