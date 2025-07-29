#!/usr/bin/env node

const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');
const fs = require('fs');
const path = require('path');

async function validateHHUImages() {
    console.log('Validating HHU images...');
    
    const loader = new SharedManifestLoaders();
    const testUrl = 'https://digital.ulb.hhu.de/ms/content/titleinfo/9400252';
    
    try {
        // Get manifest
        const result = await loader.getHHUManifest(testUrl);
        console.log(`✅ Found ${result.images.length} images`);
        console.log(`✅ Manuscript: ${result.displayName}`);
        
        // Test first 3 images
        const maxImages = Math.min(3, result.images.length);
        const validationDir = path.join(__dirname, 'hhu-validation');
        
        // Create validation directory
        if (!fs.existsSync(validationDir)) {
            fs.mkdirSync(validationDir);
        }
        
        // Create validation report
        const reportPath = path.join(validationDir, 'validation-report.txt');
        let report = `HHU Regression Fix Validation Report\n`;
        report += `=====================================\n`;
        report += `URL: ${testUrl}\n`;
        report += `Manuscript: ${result.displayName}\n`;
        report += `Total pages found: ${result.images.length}\n`;
        report += `Testing first ${maxImages} images:\n\n`;
        
        let allSuccess = true;
        
        for (let i = 0; i < maxImages; i++) {
            console.log(`Testing image ${i + 1}/${maxImages}...`);
            const imageUrl = result.images[i].url;
            
            try {
                const response = await loader.fetchWithRetry(imageUrl, {}, 1);
                if (response.ok) {
                    const buffer = await response.buffer();
                    const fileName = `page-${i + 1}.jpg`;
                    const filePath = path.join(validationDir, fileName);
                    
                    fs.writeFileSync(filePath, buffer);
                    
                    console.log(`✅ Image ${i + 1}: ${buffer.length} bytes saved as ${fileName}`);
                    report += `✅ Image ${i + 1}: SUCCESS (${buffer.length} bytes)\n`;
                    report += `   URL: ${imageUrl}\n`;
                    report += `   File: ${fileName}\n\n`;
                } else {
                    console.log(`❌ Image ${i + 1}: HTTP ${response.status}`);
                    report += `❌ Image ${i + 1}: FAILED (HTTP ${response.status})\n`;
                    report += `   URL: ${imageUrl}\n\n`;
                    allSuccess = false;
                }
            } catch (error) {
                console.log(`❌ Image ${i + 1}: ${error.message}`);
                report += `❌ Image ${i + 1}: ERROR (${error.message})\n`;
                report += `   URL: ${imageUrl}\n\n`;
                allSuccess = false;
            }
        }
        
        report += `\nOverall result: ${allSuccess ? 'SUCCESS' : 'FAILED'}\n`;
        report += `Generated: ${new Date().toISOString()}\n`;
        
        fs.writeFileSync(reportPath, report);
        
        console.log(`\n✅ Validation complete!`);
        console.log(`📁 Files saved to: ${validationDir}`);
        console.log(`📄 Report: ${reportPath}`);
        
        return allSuccess;
        
    } catch (error) {
        console.log('❌ VALIDATION FAILED:', error.message);
        return false;
    }
}

validateHHUImages().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Validation script error:', error);
    process.exit(1);
});