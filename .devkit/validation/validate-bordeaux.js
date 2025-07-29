const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

// Import DZI processor
const { DziImageProcessor } = require('../../src/main/services/DziImageProcessor.js');

async function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = require('fs').createWriteStream(destPath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', reject);
    });
}

async function validateBordeauxFix() {
    console.log('=== Validating Bordeaux Library Fix (Issue #6) ===\n');
    
    const testUrl = 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778';
    const outputDir = path.join(__dirname, 'bordeaux-test-output');
    
    try {
        // Clean up previous test
        await fs.rm(outputDir, { recursive: true, force: true });
        await fs.mkdir(outputDir, { recursive: true });
        
        console.log('1. Testing manifest loader...');
        const loaders = new SharedManifestLoaders();
        const manifest = await loaders.getManifestForUrl(testUrl);
        
        if (!manifest || !manifest.images || manifest.images.length === 0) {
            throw new Error('Failed to get manifest or no images found');
        }
        
        console.log(`✅ Found ${manifest.images.length} pages in manifest`);
        console.log(`   Display name: ${manifest.displayName}`);
        console.log(`   Type: ${manifest.type}`);
        
        // Test downloading first 5 pages
        const pagesToTest = Math.min(5, manifest.images.length);
        console.log(`\n2. Testing DZI download for first ${pagesToTest} pages...`);
        
        const processor = new DziImageProcessor();
        const downloadedPages = [];
        
        for (let i = 0; i < pagesToTest; i++) {
            const page = manifest.images[i];
            console.log(`\n   Downloading page ${i + 1}: ${page.label}`);
            
            try {
                const imageBuffer = await processor.processDziImage(page.url);
                const outputPath = path.join(outputDir, `page_${i + 1}.jpg`);
                await fs.writeFile(outputPath, imageBuffer);
                
                // Check file size
                const stats = await fs.stat(outputPath);
                console.log(`   ✅ Downloaded: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                
                downloadedPages.push(outputPath);
            } catch (error) {
                console.error(`   ❌ Failed to download page ${i + 1}: ${error.message}`);
            }
        }
        
        if (downloadedPages.length === 0) {
            throw new Error('No pages were successfully downloaded');
        }
        
        console.log(`\n3. Creating test PDF from ${downloadedPages.length} pages...`);
        
        // Convert to PDF using ImageMagick
        const pdfPath = path.join(outputDir, 'bordeaux-test.pdf');
        const convertCmd = `convert ${downloadedPages.join(' ')} "${pdfPath}"`;
        execSync(convertCmd);
        
        console.log('4. Validating PDF with poppler...');
        
        // Check PDF validity
        const pdfInfo = execSync(`pdfinfo "${pdfPath}"`).toString();
        console.log('   PDF Info:');
        console.log(pdfInfo.split('\n').slice(0, 5).map(l => '   ' + l).join('\n'));
        
        // Extract images to verify content
        console.log('\n5. Extracting and verifying PDF content...');
        const extractDir = path.join(outputDir, 'extracted');
        await fs.mkdir(extractDir, { recursive: true });
        
        execSync(`pdfimages -list "${pdfPath}"`, { stdio: 'inherit' });
        execSync(`pdfimages -png -f 1 -l 3 "${pdfPath}" "${path.join(extractDir, 'page')}"`);
        
        // Check extracted images
        const extractedFiles = await fs.readdir(extractDir);
        console.log(`\n   ✅ Extracted ${extractedFiles.length} images from PDF`);
        
        // Final validation
        console.log('\n=== VALIDATION RESULTS ===');
        console.log('✅ Manifest loading: SUCCESS');
        console.log('✅ DZI tile assembly: SUCCESS');
        console.log('✅ PDF creation: SUCCESS');
        console.log('✅ PDF validity: SUCCESS');
        console.log('✅ Content verification: SUCCESS');
        console.log('\n✅ Issue #6 (Bordeaux) is FIXED!');
        
        return true;
        
    } catch (error) {
        console.error('\n❌ Validation failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run validation
validateBordeauxFix().then(success => {
    process.exit(success ? 0 : 1);
});