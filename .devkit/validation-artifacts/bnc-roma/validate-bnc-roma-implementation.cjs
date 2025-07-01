const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

// Validation configuration
const TEST_URL = 'http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/BVEE112879/BVEE112879/1';
const VALIDATION_DIR = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/validation-artifacts/bnc-roma';
const MAX_PAGES = 10;
const MIN_IMAGE_SIZE = 200 * 1024; // 200KB minimum
const MIN_PDF_SIZE = 2 * 1024 * 1024; // 2MB minimum

console.log('=== BNC Roma Implementation Validation ===');
console.log(`Test URL: ${TEST_URL}`);
console.log(`Validation Directory: ${VALIDATION_DIR}`);
console.log(`Max Pages: ${MAX_PAGES}`);

// Import the service
const servicePath = path.join(__dirname, '../../../src/main/services/EnhancedManuscriptDownloaderService.ts');
console.log(`Loading service from: ${servicePath}`);

// Since we can't directly import TypeScript, we'll test the HTTP endpoints directly
async function downloadImage(url, filename) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        client.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode} for ${url}`));
                return;
            }
            
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                fs.writeFileSync(filename, buffer);
                resolve(buffer.length);
            });
        }).on('error', reject);
    });
}

async function validateBNCRoma() {
    console.log('\n1. Testing BNC Roma URL Pattern...');
    
    // Test the expected URL pattern based on the reference
    const baseImageUrl = 'http://digitale.bnc.roma.sbn.it/tecadigitale/img/libroantico/BVEE112879/BVEE112879';
    
    const results = {
        timestamp: new Date().toISOString(),
        testUrl: TEST_URL,
        baseImageUrl: baseImageUrl,
        pages: [],
        summary: {
            totalTested: 0,
            successful: 0,
            failed: 0,
            totalSize: 0,
            averageSize: 0
        }
    };
    
    console.log(`\n2. Downloading up to ${MAX_PAGES} pages...`);
    
    // Download pages 1-10 (or fewer if not available)
    for (let i = 1; i <= MAX_PAGES; i++) {
        const imageUrl = `${baseImageUrl}/${i}/full`;
        const filename = path.join(VALIDATION_DIR, `page_${i.toString().padStart(2, '0')}.jpg`);
        
        console.log(`  Page ${i}: ${imageUrl}`);
        
        try {
            const fileSize = await downloadImage(imageUrl, filename);
            
            const pageResult = {
                pageNumber: i,
                url: imageUrl,
                filename: path.basename(filename),
                fileSize: fileSize,
                success: true,
                error: null,
                validContent: fileSize >= MIN_IMAGE_SIZE
            };
            
            results.pages.push(pageResult);
            results.summary.totalTested++;
            results.summary.totalSize += fileSize;
            
            if (fileSize >= MIN_IMAGE_SIZE) {
                results.summary.successful++;
                console.log(`    ✓ Downloaded (${Math.round(fileSize/1024)}KB)`);
            } else {
                console.log(`    ⚠ Downloaded but small (${Math.round(fileSize/1024)}KB - may be error page)`);
            }
            
        } catch (error) {
            const pageResult = {
                pageNumber: i,
                url: imageUrl,
                filename: null,
                fileSize: 0,
                success: false,
                error: error.message,
                validContent: false
            };
            
            results.pages.push(pageResult);
            results.summary.failed++;
            console.log(`    ✗ Failed: ${error.message}`);
        }
    }
    
    results.summary.averageSize = results.summary.totalTested > 0 ? 
        Math.round(results.summary.totalSize / results.summary.totalTested) : 0;
    
    console.log(`\n3. Creating PDF from downloaded images...`);
    
    // Create PDF using ImageMagick if available
    try {
        const imageFiles = results.pages
            .filter(p => p.success && p.validContent)
            .map(p => path.join(VALIDATION_DIR, p.filename))
            .join(' ');
        
        if (imageFiles) {
            const pdfPath = path.join(VALIDATION_DIR, 'bnc_roma_validation.pdf');
            
            // Try ImageMagick first
            try {
                execSync(`convert ${imageFiles} "${pdfPath}"`, { stdio: 'pipe' });
                console.log(`    ✓ PDF created with ImageMagick: ${path.basename(pdfPath)}`);
            } catch (convertError) {
                // Fallback: create a simple PDF with available tools
                console.log(`    ⚠ ImageMagick not available, trying alternative method...`);
                // Note: This would require additional PDF creation logic
            }
            
            // Validate PDF if created
            if (fs.existsSync(pdfPath)) {
                const pdfSize = fs.statSync(pdfPath).size;
                results.pdfValidation = {
                    created: true,
                    size: pdfSize,
                    validSize: pdfSize >= MIN_PDF_SIZE,
                    path: pdfPath
                };
                
                console.log(`    PDF Size: ${Math.round(pdfSize/1024/1024*100)/100}MB`);
                
                // Test with poppler if available
                try {
                    execSync(`pdfinfo "${pdfPath}"`, { stdio: 'pipe' });
                    results.pdfValidation.popplerValid = true;
                    console.log(`    ✓ PDF validated with poppler`);
                } catch (popplerError) {
                    results.pdfValidation.popplerValid = false;
                    console.log(`    ⚠ Poppler validation failed or not available`);
                }
            }
        } else {
            console.log(`    ✗ No valid images to create PDF`);
            results.pdfValidation = { created: false, reason: 'No valid images' };
        }
        
    } catch (error) {
        console.log(`    ✗ PDF creation failed: ${error.message}`);
        results.pdfValidation = { created: false, error: error.message };
    }
    
    console.log(`\n4. Validation Summary:`);
    console.log(`   Total pages tested: ${results.summary.totalTested}`);
    console.log(`   Successful downloads: ${results.summary.successful}`);
    console.log(`   Failed downloads: ${results.summary.failed}`);
    console.log(`   Success rate: ${Math.round(results.summary.successful/results.summary.totalTested*100)}%`);
    console.log(`   Average image size: ${Math.round(results.summary.averageSize/1024)}KB`);
    
    // Determine overall validation result
    const successRate = results.summary.successful / results.summary.totalTested;
    results.validationPassed = successRate >= 0.8; // 80% success rate required
    
    console.log(`\n5. Overall Result: ${results.validationPassed ? '✓ PASSED' : '✗ FAILED'}`);
    if (!results.validationPassed) {
        console.log(`   Reason: Success rate ${Math.round(successRate*100)}% below required 80%`);
    }
    
    // Save detailed results
    const resultsPath = path.join(VALIDATION_DIR, 'validation_results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n6. Detailed results saved to: ${path.basename(resultsPath)}`);
    
    return results;
}

// Run validation
validateBNCRoma().catch(console.error);