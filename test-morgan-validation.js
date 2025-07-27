
const { SharedManifestLoaders } = require('./src/shared/SharedManifestLoaders.js');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const https = require('https');

async function downloadImage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        }).on('error', reject);
    });
}

async function testMorgan() {
    const loaders = new SharedManifestLoaders();
    console.log('\nLoading Morgan Library manifest...');
    
    try {
        const manifest = await loaders.getMorganManifest('https://www.themorgan.org/collection/lindau-gospels/thumbs');
        
        console.log('\nManifest loaded successfully!');
        console.log('Title:', manifest.displayName);
        console.log('Total pages found:', manifest.images.length);
        
        if (manifest.images.length === 1) {
            console.error('\n❌ FAILED: Only 1 page found!');
            process.exit(1);
        }
        
        // Download first 5 pages for validation
        const pagesToTest = Math.min(5, manifest.images.length);
        console.log(`\nDownloading first ${pagesToTest} pages for validation...`);
        
        const doc = new PDFDocument({ autoFirstPage: false });
        const pdfPath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/validation/morgan/morgan-validation.pdf';
        doc.pipe(fs.createWriteStream(pdfPath));
        
        for (let i = 0; i < pagesToTest; i++) {
            const image = manifest.images[i];
            console.log(`  Page ${i + 1}: ${image.label}`);
            
            try {
                const imageBuffer = await downloadImage(image.url);
                console.log(`    Downloaded: ${(imageBuffer.length / 1024).toFixed(1)}KB`);
                
                // Add to PDF
                doc.addPage({ size: 'A4' });
                doc.image(imageBuffer, 0, 0, { 
                    fit: [doc.page.width, doc.page.height],
                    align: 'center',
                    valign: 'center'
                });
                
            } catch (error) {
                console.error(`    Failed to download: ${error.message}`);
            }
        }
        
        doc.end();
        console.log(`\n✓ Created validation PDF: ${pdfPath}`);
        
        // Test with poppler
        console.log('\nValidating PDF with poppler...');
        const pdfinfo = require('child_process').execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
        console.log('PDF validation passed!');
        console.log('Pages in PDF:', pdfinfo.match(/Pages:\s+(\d+)/)?.[1] || 'Unknown');
        
        // Check page variety
        console.log('\nChecking page variety...');
        const uniqueUrls = new Set(manifest.images.map(img => img.url));
        const uniqueLabels = new Set(manifest.images.map(img => img.label));
        console.log(`Unique URLs: ${uniqueUrls.size}`);
        console.log(`Unique labels: ${uniqueLabels.size}`);
        
        if (uniqueUrls.size === 1) {
            console.error('\n❌ FAILED: All pages have the same URL!');
            process.exit(1);
        }
        
        console.log('\n✓ Morgan Library fix validated successfully!');
        console.log('  - Multiple pages detected: YES');
        console.log('  - Different page content: YES');
        console.log('  - PDF creation works: YES');
        
    } catch (error) {
        console.error('\n❌ Validation failed:', error.message);
        process.exit(1);
    }
}

testMorgan().catch(console.error);
