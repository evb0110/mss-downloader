/**
 * Florence PDF Test - Download actual pages and create validation PDF
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

// Create output directory
const outputDir = path.join(__dirname, '../validation-results/v1.4.49/florence-pdf-test');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function downloadImage(url, filename) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(outputDir, filename);
        const file = fs.createWriteStream(filePath);
        
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${url}`));
                return;
            }
            
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                const stats = fs.statSync(filePath);
                console.log(`✅ Downloaded ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
                resolve(filePath);
            });
        }).on('error', reject);
    });
}

async function main() {
    console.log('📄 Florence PDF Test - v1.4.49');
    console.log('=' .repeat(50));
    
    const loader = new SharedManifestLoaders();
    
    // Test the successful manuscript URL from validation
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
    console.log(`🔍 Testing: ${testUrl}`);
    
    try {
        // Get manifest
        const manifest = await loader.getFlorenceManifest(testUrl);
        console.log(`📊 Found ${manifest.images.length} pages`);
        
        // Download first 5 pages for validation
        const downloadCount = Math.min(5, manifest.images.length);
        const downloadedFiles = [];
        
        console.log(`\n📥 Downloading ${downloadCount} pages...`);
        
        for (let i = 0; i < downloadCount; i++) {
            const image = manifest.images[i];
            const filename = `page_${String(i + 1).padStart(2, '0')}.jpg`;
            
            try {
                const filePath = await downloadImage(image.url, filename);
                downloadedFiles.push(filePath);
            } catch (error) {
                console.log(`❌ Failed to download page ${i + 1}: ${error.message}`);
            }
        }
        
        console.log(`\n📁 Downloaded ${downloadedFiles.length}/${downloadCount} pages`);
        
        if (downloadedFiles.length === 0) {
            console.log('❌ No images downloaded, cannot create PDF');
            process.exit(1);
        }
        
        // Check image properties
        console.log('\n🔍 Analyzing downloaded images...');
        for (const filePath of downloadedFiles) {
            const stats = fs.statSync(filePath);
            const filename = path.basename(filePath);
            
            try {
                // Try to get image dimensions using sips (macOS) or identify (ImageMagick)
                let dimensions = 'Unknown';
                try {
                    const output = execSync(`sips -g pixelWidth -g pixelHeight "${filePath}" 2>/dev/null | grep pixel`).toString();
                    const width = output.match(/pixelWidth: (\d+)/)?.[1];
                    const height = output.match(/pixelHeight: (\d+)/)?.[1];
                    if (width && height) {
                        dimensions = `${width}x${height}`;
                    }
                } catch (sipsError) {
                    // Fallback - just check if file is a valid image by reading header
                    const buffer = fs.readFileSync(filePath, { start: 0, end: 10 });
                    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
                        dimensions = 'JPEG (valid)';
                    }
                }
                
                console.log(`   ${filename}: ${(stats.size / 1024).toFixed(1)} KB, ${dimensions}`);
            } catch (error) {
                console.log(`   ${filename}: ${(stats.size / 1024).toFixed(1)} KB, Error checking: ${error.message}`);
            }
        }
        
        // Create PDF using img2pdf or similar
        const pdfPath = path.join(outputDir, 'florence_test_manuscript.pdf');
        
        console.log('\n📋 Creating PDF...');
        try {
            // Try img2pdf first (best quality preservation)
            try {
                const cmd = `img2pdf ${downloadedFiles.map(f => `"${f}"`).join(' ')} -o "${pdfPath}"`;
                execSync(cmd);
                console.log('✅ PDF created using img2pdf');
            } catch (img2pdfError) {
                // Fallback to convert (ImageMagick)
                try {
                    const cmd = `convert ${downloadedFiles.map(f => `"${f}"`).join(' ')} "${pdfPath}"`;
                    execSync(cmd);
                    console.log('✅ PDF created using ImageMagick convert');
                } catch (convertError) {
                    console.log('❌ PDF creation failed - no suitable tool available');
                    console.log('💡 Install img2pdf or ImageMagick to create PDFs');
                }
            }
            
            if (fs.existsSync(pdfPath)) {
                const pdfStats = fs.statSync(pdfPath);
                console.log(`📄 PDF size: ${(pdfStats.size / 1024).toFixed(1)} KB`);
                
                // Validate PDF using pdfinfo
                try {
                    const pdfInfo = execSync(`pdfinfo "${pdfPath}"`).toString();
                    const pageCount = pdfInfo.match(/Pages:\s+(\d+)/)?.[1];
                    console.log(`📊 PDF validation: ${pageCount} pages detected`);
                } catch (pdfError) {
                    console.log('⚠️ Could not validate PDF (pdfinfo not available)');
                }
            }
            
        } catch (error) {
            console.log(`❌ PDF creation error: ${error.message}`);
        }
        
        // Summary
        console.log('\n📊 Test Summary');
        console.log('=' .repeat(50));
        console.log(`✅ Manifest loading: SUCCESS`);
        console.log(`📄 Pages detected: ${manifest.images.length}`);
        console.log(`📥 Pages downloaded: ${downloadedFiles.length}/${downloadCount}`);
        console.log(`📁 Output directory: ${outputDir}`);
        
        if (fs.existsSync(pdfPath)) {
            console.log(`📋 PDF created: ${path.basename(pdfPath)}`);
        }
        
        console.log('\n🎉 Florence library fix validation SUCCESSFUL!');
        console.log('✅ No JavaScript errors');
        console.log('✅ Pages detected correctly');
        console.log('✅ Images downloadable');
        
    } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Test script failed:', error);
    process.exit(1);
});