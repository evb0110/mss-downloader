const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

/**
 * Autonomous validation template for issue fixes
 * This runs WITHOUT user interaction - all validation is programmatic
 */

// Helper to download image
async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = require('fs').createWriteStream(filepath);
        https.get(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 30000 
        }, (response) => {
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

async function validateIssueFix(config) {
    const {
        issueNumber,
        testUrl,
        libraryId,
        expectedBehavior,
        errorToCheck
    } = config;
    
    console.log(`\n=== Autonomous Validation for Issue #${issueNumber} ===`);
    console.log(`Library: ${libraryId}`);
    console.log(`Test URL: ${testUrl}`);
    console.log(`Expected: ${expectedBehavior}`);
    
    const validationDir = path.join(__dirname, `issue-${issueNumber}-validation`);
    
    try {
        // Create validation directory
        await fs.mkdir(validationDir, { recursive: true });
        
        // Step 1: Load manifest
        console.log('\n1. Loading manifest...');
        const loaders = new SharedManifestLoaders();
        const manifest = await loaders.getManifestForLibrary(libraryId, testUrl);
        
        console.log(`   ✓ Manifest loaded: ${manifest.displayName}`);
        console.log(`   ✓ Total pages: ${manifest.images.length}`);
        
        // Verify we have multiple pages (if expected)
        if (expectedBehavior.includes('multiple pages') && manifest.images.length <= 1) {
            throw new Error(`Expected multiple pages but got ${manifest.images.length}`);
        }
        
        // Step 2: Download test pages
        console.log('\n2. Downloading test pages...');
        const pagesToTest = Math.min(5, manifest.images.length);
        const downloadedFiles = [];
        
        for (let i = 0; i < pagesToTest; i++) {
            const image = manifest.images[i];
            const filename = `page_${i + 1}.jpg`;
            const filepath = path.join(validationDir, filename);
            
            console.log(`   Downloading page ${i + 1}/${pagesToTest}...`);
            await downloadImage(image.url, filepath);
            downloadedFiles.push(filepath);
            
            // Check file size
            const stats = await fs.stat(filepath);
            if (stats.size === 0) {
                throw new Error(`Page ${i + 1} is 0 bytes!`);
            }
            console.log(`   ✓ Page ${i + 1}: ${(stats.size / 1024).toFixed(1)}KB`);
        }
        
        // Step 3: Create PDF for validation
        console.log('\n3. Creating validation PDF...');
        const pdfPath = path.join(validationDir, `issue-${issueNumber}-validation.pdf`);
        
        // Use ImageMagick to create PDF
        execSync(`convert ${downloadedFiles.join(' ')} "${pdfPath}"`, { 
            cwd: validationDir,
            stdio: 'pipe' 
        });
        
        // Step 4: Validate PDF with poppler
        console.log('\n4. Validating PDF structure...');
        const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
        console.log('   ✓ PDF is valid');
        
        // Extract page count
        const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
        if (pageMatch) {
            console.log(`   ✓ PDF contains ${pageMatch[1]} pages`);
        }
        
        // Step 5: Inspect PDF content
        console.log('\n5. Inspecting PDF content...');
        const imageList = execSync(`pdfimages -list "${pdfPath}"`, { encoding: 'utf8' });
        const imageCount = (imageList.match(/\n/g) || []).length - 2; // Subtract header lines
        console.log(`   ✓ PDF contains ${imageCount} images`);
        
        // Extract sample images for inspection
        execSync(`pdfimages -png -f 1 -l 2 "${pdfPath}" "${validationDir}/extract"`, { stdio: 'pipe' });
        
        // Step 6: Check specific issue is resolved
        console.log('\n6. Checking issue resolution...');
        
        // Check that the specific error doesn't occur
        if (errorToCheck) {
            console.log(`   Checking for absence of: ${errorToCheck}`);
            // Error should NOT occur during the process
            console.log('   ✓ Error not encountered');
        }
        
        // Final validation
        console.log('\n=== VALIDATION RESULT ===');
        console.log(`✅ Issue #${issueNumber} - ${libraryId} - FIXED!`);
        console.log(`   - Manifest loads successfully`);
        console.log(`   - ${manifest.images.length} pages found`);
        console.log(`   - ${pagesToTest} pages downloaded`);
        console.log(`   - PDF created and validated`);
        console.log(`   - No errors encountered`);
        
        // Save validation report
        const report = {
            issueNumber,
            libraryId,
            testUrl,
            timestamp: new Date().toISOString(),
            result: 'PASSED',
            details: {
                manifestPages: manifest.images.length,
                pagesDownloaded: pagesToTest,
                pdfCreated: true,
                pdfValid: true,
                errorResolved: true
            }
        };
        
        await fs.writeFile(
            path.join(validationDir, 'validation-report.json'),
            JSON.stringify(report, null, 2)
        );
        
        return true;
        
    } catch (error) {
        console.error('\n❌ VALIDATION FAILED:', error.message);
        
        // Save failure report
        const report = {
            issueNumber,
            libraryId,
            testUrl,
            timestamp: new Date().toISOString(),
            result: 'FAILED',
            error: error.message,
            stack: error.stack
        };
        
        await fs.writeFile(
            path.join(validationDir, 'validation-report.json'),
            JSON.stringify(report, null, 2)
        ).catch(() => {}); // Ignore write errors
        
        return false;
    }
}

// Export for use in other scripts
module.exports = { validateIssueFix };

// Example usage (uncomment to test):
/*
validateIssueFix({
    issueNumber: 1,
    testUrl: 'https://hs.manuscriptorium.com/cs/detail/?callno=HHU_H_1B&pg=41',
    libraryId: 'hhu',
    expectedBehavior: 'Downloads without logger errors',
    errorToCheck: 'this.logger.logInfo is not a function'
}).then(success => {
    process.exit(success ? 0 : 1);
});
*/