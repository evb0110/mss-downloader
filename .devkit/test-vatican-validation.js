#!/usr/bin/env node
/**
 * Vatican Digital Library (DigiVatLib) validation test
 * Tests manuscript downloads with maximum resolution (4000px width)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

// Test manuscripts - diverse collection from Vatican Library
const testManuscripts = [
    { url: 'https://digitalevat.vatlib.it/view/MSS_Vat.lat.1', name: 'Vat.lat.1 - Biblia sacra (1454)' },
    { url: 'https://digitalevat.vatlib.it/view/MSS_Vat.lat.3773', name: 'Vat.lat.3773 - Vergilius Vaticanus' },
    { url: 'https://digitalevat.vatlib.it/view/MSS_Vat.gr.1', name: 'Vat.gr.1 - Greek Bible' },
    { url: 'https://digitalevat.vatlib.it/view/MSS_Pal.lat.1', name: 'Pal.lat.1 - Palatine Latin MS' },
    { url: 'https://digitalevat.vatlib.it/view/MSS_Reg.lat.762', name: 'Reg.lat.762 - Reginensis Latin' },
    { url: 'https://digitalevat.vatlib.it/view/MSS_Barb.lat.570', name: 'Barb.lat.570 - Barberini Latin' },
    { url: 'https://digitalevat.vatlib.it/view/MSS_Urb.lat.365', name: 'Urb.lat.365 - Urbinas Latin' },
    { url: 'https://digitalevat.vatlib.it/view/MSS_Ott.lat.74', name: 'Ott.lat.74 - Ottobonianus Latin' },
    { url: 'https://digitalevat.vatlib.it/view/MSS_Chig.F.IV.75', name: 'Chig.F.IV.75 - Chigianus' },
    { url: 'https://digitalevat.vatlib.it/view/MSS_Ross.555', name: 'Ross.555 - Rossianus' }
];

async function testVaticanManuscript(manuscript, outputDir) {
    const loaders = new SharedManifestLoaders();
    
    console.log(`\n📚 Testing: ${manuscript.name}`);
    console.log(`   URL: ${manuscript.url}`);
    
    try {
        // Get manifest
        const manifest = await loaders.getVaticanManifest(manuscript.url);
        console.log(`   ✅ Manifest loaded: "${manifest.label}" with ${manifest.images.length} pages`);
        
        // Create directory for this manuscript
        const manuscriptDir = path.join(outputDir, manuscript.name.split(' - ')[0].replace(/\./g, '_'));
        fs.mkdirSync(manuscriptDir, { recursive: true });
        
        // Download first 10 pages (or all if fewer)
        const pagesToDownload = Math.min(manifest.images.length, 10);
        const downloadedImages = [];
        
        for (let i = 0; i < pagesToDownload; i++) {
            const page = manifest.images[i];
            const imageFile = path.join(manuscriptDir, `page_${String(i + 1).padStart(3, '0')}.jpg`);
            
            console.log(`   📥 Downloading page ${i + 1}/${pagesToDownload}: ${page.label}`);
            
            // Download image
            try {
                execSync(`curl -s -o "${imageFile}" "${page.url}"`, { stdio: 'pipe' });
                
                // Verify file exists and has content
                const stats = fs.statSync(imageFile);
                if (stats.size === 0) {
                    throw new Error('Downloaded file is empty');
                }
                
                downloadedImages.push(imageFile);
                console.log(`      ✅ Downloaded: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            } catch (error) {
                console.log(`      ❌ Failed to download: ${error.message}`);
                throw error;
            }
        }
        
        // Create PDF from downloaded images
        const pdfFile = path.join(outputDir, `${manuscript.name.split(' - ')[0]}.pdf`);
        console.log(`   📄 Creating PDF: ${path.basename(pdfFile)}`);
        
        // Use ImageMagick to create PDF
        const convertCmd = `convert ${downloadedImages.map(f => `"${f}"`).join(' ')} "${pdfFile}"`;
        execSync(convertCmd, { stdio: 'pipe' });
        
        // Verify PDF with poppler
        console.log('   🔍 Verifying PDF with poppler...');
        const pdfInfo = execSync(`pdfinfo "${pdfFile}"`, { encoding: 'utf8' });
        const pagesMatch = pdfInfo.match(/Pages:\s+(\d+)/);
        if (pagesMatch && parseInt(pagesMatch[1]) === downloadedImages.length) {
            console.log(`   ✅ PDF valid: ${downloadedImages.length} pages`);
        } else {
            throw new Error('PDF validation failed');
        }
        
        // Clean up individual images
        downloadedImages.forEach(img => fs.unlinkSync(img));
        fs.rmdirSync(manuscriptDir);
        
        return { success: true, pages: downloadedImages.length };
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function main() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const outputDir = path.join(__dirname, 'validation-results', `vatican-${timestamp}`);
    fs.mkdirSync(outputDir, { recursive: true });
    
    console.log('🏛️  Vatican Digital Library Validation Test');
    console.log('==========================================');
    console.log(`Output directory: ${outputDir}`);
    
    const results = [];
    
    for (const manuscript of testManuscripts) {
        const result = await testVaticanManuscript(manuscript, outputDir);
        results.push({ ...manuscript, ...result });
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log('===========');
    const successful = results.filter(r => r.success).length;
    console.log(`✅ Successful: ${successful}/${results.length}`);
    console.log(`❌ Failed: ${results.length - successful}/${results.length}`);
    
    // List all PDFs for inspection
    console.log('\n📚 Generated PDFs for inspection:');
    const pdfs = fs.readdirSync(outputDir).filter(f => f.endsWith('.pdf'));
    pdfs.forEach(pdf => {
        const stats = fs.statSync(path.join(outputDir, pdf));
        console.log(`   - ${pdf} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    });
    
    // Save detailed results
    const reportFile = path.join(outputDir, 'validation-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
    console.log(`\n📝 Detailed report saved to: ${reportFile}`);
    
    // Open output directory for manual inspection
    console.log('\n🔍 Opening output directory for inspection...');
    execSync(`open "${outputDir}"`);
}

main().catch(console.error);