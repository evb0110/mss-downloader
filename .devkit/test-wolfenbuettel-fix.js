const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

// Import the service
const { EnhancedManuscriptDownloaderService } = require('../dist/main/services/EnhancedManuscriptDownloaderService');

// Test manuscripts - including the problematic one and others
const testUrls = [
    'https://diglib.hab.de/wdb.php?dir=mss/105-noviss-2f',  // The one that failed
    'https://diglib.hab.de/wdb.php?dir=mss/1008-helmst',     // A different one
    'https://diglib.hab.de/wdb.php?dir=mss/1-gud-lat',       // Another pattern
    'https://diglib.hab.de/wdb.php?dir=mss/23-aug-4f',       // Yet another
    'https://diglib.hab.de/wdb.php?dir=mss/95-weiss'         // One more
];

// Create output directory
const outputDir = path.join(__dirname, 'wolfenbuettel-validation');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function downloadImage(url, filePath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(filePath);
        
        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode} for ${url}`));
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

async function testManuscript(service, url) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${url}`);
    console.log('='.repeat(80));
    
    try {
        // Load manifest
        const manifest = await service.loadWolfenbuettelManifest(url);
        console.log(`✓ Manifest loaded: ${manifest.displayName}`);
        console.log(`✓ Total pages: ${manifest.totalPages}`);
        
        // Download first 10 pages (or all if fewer)
        const pagesToTest = Math.min(10, manifest.totalPages);
        const manuscriptDir = path.join(outputDir, manifest.displayName.replace(/[^a-zA-Z0-9-_]/g, '_'));
        
        if (!fs.existsSync(manuscriptDir)) {
            fs.mkdirSync(manuscriptDir, { recursive: true });
        }
        
        const downloadedImages = [];
        
        for (let i = 0; i < pagesToTest; i++) {
            const imageUrl = manifest.pageLinks[i];
            const fileName = `page_${(i + 1).toString().padStart(3, '0')}.jpg`;
            const filePath = path.join(manuscriptDir, fileName);
            
            console.log(`  Downloading page ${i + 1}/${pagesToTest}...`);
            
            try {
                await downloadImage(imageUrl, filePath);
                const stats = fs.statSync(filePath);
                console.log(`    ✓ Downloaded: ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                downloadedImages.push(filePath);
            } catch (error) {
                console.error(`    ✗ Failed to download page ${i + 1}: ${error.message}`);
            }
        }
        
        // Create PDF from downloaded images
        if (downloadedImages.length > 0) {
            const pdfPath = path.join(outputDir, `${manifest.displayName.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`);
            console.log(`\n  Creating PDF...`);
            
            try {
                execSync(`convert "${downloadedImages.join('" "')}" "${pdfPath}"`, { stdio: 'inherit' });
                const pdfStats = fs.statSync(pdfPath);
                console.log(`  ✓ PDF created: ${path.basename(pdfPath)} (${(pdfStats.size / 1024 / 1024).toFixed(2)} MB)`);
                
                // Validate PDF with poppler
                console.log(`  Validating PDF...`);
                try {
                    const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
                    const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
                    if (pageMatch) {
                        console.log(`  ✓ PDF validated: ${pageMatch[1]} pages`);
                    }
                } catch (error) {
                    console.error(`  ✗ PDF validation failed: ${error.message}`);
                }
                
            } catch (error) {
                console.error(`  ✗ Failed to create PDF: ${error.message}`);
            }
        }
        
        return {
            url,
            success: true,
            displayName: manifest.displayName,
            totalPages: manifest.totalPages,
            downloadedPages: downloadedImages.length,
            message: 'Success'
        };
        
    } catch (error) {
        console.error(`✗ Failed: ${error.message}`);
        return {
            url,
            success: false,
            message: error.message
        };
    }
}

async function runTests() {
    console.log('Wolfenbüttel Digital Library Fix Validation');
    console.log('Testing with maximum resolution images');
    
    // Initialize service
    const service = new EnhancedManuscriptDownloaderService();
    
    const results = [];
    
    for (const url of testUrls) {
        const result = await testManuscript(service, url);
        results.push(result);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`\nTotal tests: ${results.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    
    if (successful.length > 0) {
        console.log('\nSuccessful manuscripts:');
        successful.forEach(r => {
            console.log(`  ✓ ${r.displayName} - ${r.totalPages} pages (downloaded ${r.downloadedPages})`);
        });
    }
    
    if (failed.length > 0) {
        console.log('\nFailed manuscripts:');
        failed.forEach(r => {
            console.log(`  ✗ ${r.url} - ${r.message}`);
        });
    }
    
    console.log(`\nOutput directory: ${outputDir}`);
    console.log('\nValidation complete!');
}

// Run tests
runTests().catch(console.error);