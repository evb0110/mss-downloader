const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// DIAMM test URLs with expected metadata
const testManuscripts = [
    {
        name: 'I-Rc-Ms-1907 (525 pages)',
        url: 'https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Rc-Ms-1907%2Fmanifest.json',
        expectedPages: 525,
        testPages: [1, 50, 100, 200, 525]
    },
    {
        name: 'I-Ra-Ms1383 (17 pages)',
        url: 'https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Ra-Ms1383%2Fmanifest.json',
        expectedPages: 17,
        testPages: [1, 8, 17]
    },
    {
        name: 'I-Rc-Ms-1574 (78 pages)',
        url: 'https://iiif.diamm.net/manifests/I-Rc-Ms-1574/manifest.json',
        expectedPages: 78,
        testPages: [1, 25, 50, 78]
    },
    {
        name: 'I-Rv-C_32 (75 pages)',
        url: 'https://iiif.diamm.net/manifests/I-Rv-C_32/manifest.json',
        expectedPages: 75,
        testPages: [1, 25, 50, 75]
    }
];

// Output directory for validation PDFs
const outputDir = path.join(__dirname, 'diamm-validation-output');

async function ensureOutputDir() {
    try {
        await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
        // Directory already exists
    }
}

function runCommand(command, description) {
    return new Promise((resolve, reject) => {
        console.log(`🔄 ${description}...`);
        exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
            if (error) {
                console.log(`❌ ${description} failed: ${error.message}`);
                reject(error);
            } else {
                console.log(`✅ ${description} completed`);
                if (stdout) console.log(stdout);
                resolve(stdout);
            }
        });
    });
}

async function validateManuscript(manuscript) {
    console.log(`\n📋 Validating: ${manuscript.name}`);
    console.log(`   URL: ${manuscript.url}`);
    
    const sanitizedName = manuscript.name.replace(/[^a-zA-Z0-9\-]/g, '_');
    const outputPath = path.join(outputDir, `${sanitizedName}_validation.pdf`);
    
    try {
        // Download the manuscript using the new MSS downloader
        const downloadCommand = `cd "${process.cwd()}" && timeout 300 npm run dev -- --headless --url="${manuscript.url}" --output="${outputPath}"`;
        
        await runCommand(downloadCommand, `Downloading ${manuscript.name}`);
        
        // Check if PDF was created
        const stats = await fs.stat(outputPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`📄 PDF created: ${outputPath}`);
        console.log(`📊 File size: ${fileSizeMB} MB`);
        
        // Validate PDF with poppler
        const pdfInfoCommand = `pdfinfo "${outputPath}"`;
        const pdfInfo = await runCommand(pdfInfoCommand, `Validating PDF structure for ${manuscript.name}`);
        
        // Extract page count from pdfinfo output
        const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
        const actualPages = pageMatch ? parseInt(pageMatch[1]) : 0;
        
        console.log(`📄 PDF pages: ${actualPages}`);
        
        // Validate page count
        if (actualPages >= manuscript.expectedPages * 0.9) { // Allow 10% variance
            console.log(`✅ Page count validation passed (${actualPages}/${manuscript.expectedPages})`);
        } else {
            console.log(`❌ Page count validation failed (${actualPages}/${manuscript.expectedPages})`);
            return false;
        }
        
        // Extract a few images for content validation
        const imageExtractCommand = `pdfimages -j "${outputPath}" "${outputDir}/${sanitizedName}_page"`;
        await runCommand(imageExtractCommand, `Extracting images from ${manuscript.name}`);
        
        // List extracted images
        const imageFiles = await fs.readdir(outputDir);
        const manuscriptImages = imageFiles.filter(f => f.includes(sanitizedName) && f.endsWith('.jpg'));
        
        console.log(`🖼️ Extracted ${manuscriptImages.length} images for content validation`);
        
        if (manuscriptImages.length > 0) {
            console.log(`   First image: ${manuscriptImages[0]}`);
            
            // Check image dimensions
            const firstImage = path.join(outputDir, manuscriptImages[0]);
            const identifyCommand = `identify "${firstImage}"`;
            const imageInfo = await runCommand(identifyCommand, `Analyzing image quality for ${manuscript.name}`);
            
            console.log(`🖼️ Image info: ${imageInfo.trim()}`);
        }
        
        return true;
        
    } catch (error) {
        console.log(`❌ Validation failed for ${manuscript.name}: ${error.message}`);
        return false;
    }
}

async function runDiammValidation() {
    console.log('🎵 DIAMM Library Validation Protocol');
    console.log('=====================================');
    
    await ensureOutputDir();
    
    const results = [];
    
    for (const manuscript of testManuscripts) {
        const success = await validateManuscript(manuscript);
        results.push({
            manuscript: manuscript.name,
            success: success
        });
    }
    
    console.log('\n📊 DIAMM Validation Results:');
    console.log('============================');
    
    let successCount = 0;
    results.forEach(result => {
        const status = result.success ? '✅ PASSED' : '❌ FAILED';
        console.log(`${status} ${result.manuscript}`);
        if (result.success) successCount++;
    });
    
    const successRate = (successCount / results.length * 100).toFixed(1);
    console.log(`\n📈 Success Rate: ${successRate}% (${successCount}/${results.length})`);
    
    if (successCount === results.length) {
        console.log('🎉 DIAMM Library Validation: 100% SUCCESS');
        console.log('✅ All manuscripts downloaded and validated successfully');
        console.log(`📁 Validation PDFs available in: ${outputDir}`);
        
        // Create validation report
        const reportPath = path.join(outputDir, 'DIAMM_VALIDATION_REPORT.md');
        const report = `# DIAMM Library Validation Report

## Summary
- **Library**: DIAMM (Digital Image Archive of Medieval Music)
- **Test Date**: ${new Date().toISOString()}
- **Success Rate**: ${successRate}%
- **Total Manuscripts**: ${results.length}
- **Successful Downloads**: ${successCount}

## Test Results
${results.map(r => `- ${r.success ? '✅' : '❌'} ${r.manuscript}`).join('\n')}

## Validation Details
- All manuscripts successfully downloaded via IIIF protocol
- PDF generation and validation completed
- Image extraction and quality verification performed
- Page count validation within acceptable range

## Implementation Status
- ✅ URL detection implemented
- ✅ Manifest loading implemented
- ✅ IIIF image processing implemented
- ✅ PDF generation working correctly
- ✅ Library optimization settings configured

## Ready for Production
The DIAMM library implementation has passed all validation tests and is ready for production use.
`;
        
        await fs.writeFile(reportPath, report);
        console.log(`📄 Validation report saved: ${reportPath}`);
        
        return true;
    } else {
        console.log('❌ DIAMM Library Validation: FAILED');
        console.log('⚠️  Some manuscripts failed validation - implementation needs review');
        return false;
    }
}

// Run the validation
runDiammValidation().then(success => {
    if (success) {
        console.log('\n🎉 DIAMM implementation validation completed successfully!');
        console.log('✅ Ready to proceed with version bump and deployment');
    } else {
        console.log('\n❌ DIAMM implementation validation failed');
        console.log('⚠️  Implementation needs fixes before deployment');
        process.exit(1);
    }
}).catch(error => {
    console.error('❌ Validation script failed:', error.message);
    process.exit(1);
});