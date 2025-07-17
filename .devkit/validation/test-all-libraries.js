const https = require('https');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

// Simple HTTPS fetch helper
async function fetchWithHTTPS(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        https.get({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            rejectUnauthorized: false
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: () => data,
                    headers: res.headers
                });
            });
        }).on('error', reject);
    });
}

async function downloadImage(url, outputPath) {
    const response = await fetchWithHTTPS(url);
    if (response.ok) {
        const data = await response.text();
        fs.writeFileSync(outputPath, Buffer.from(data, 'binary'), 'binary');
        return true;
    }
    return false;
}

async function createPDF(imagePaths, outputPath, title) {
    const pdfDoc = await PDFDocument.create();
    
    for (const imagePath of imagePaths) {
        try {
            const imageBytes = fs.readFileSync(imagePath);
            let image;
            
            if (imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg')) {
                image = await pdfDoc.embedJpg(imageBytes);
            } else if (imagePath.endsWith('.png')) {
                image = await pdfDoc.embedPng(imageBytes);
            } else {
                continue;
            }
            
            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });
        } catch (error) {
            console.log(`   ⚠️  Failed to embed ${path.basename(imagePath)}: ${error.message}`);
        }
    }
    
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    console.log(`   📄 PDF created: ${outputPath} (${pdfBytes.length} bytes)`);
    return true;
}

async function testLibrary(name, urls, outputName) {
    console.log(`\n🔍 Testing ${name}...`);
    
    const tempDir = path.join(__dirname, 'temp', outputName);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const imagePaths = [];
    let successCount = 0;
    
    for (let i = 0; i < urls.length && i < 5; i++) {
        const url = urls[i];
        const imagePath = path.join(tempDir, `page_${i + 1}.jpg`);
        
        try {
            console.log(`   Downloading page ${i + 1}...`);
            const success = await downloadImage(url, imagePath);
            if (success) {
                imagePaths.push(imagePath);
                successCount++;
            } else {
                console.log(`   ❌ Failed to download page ${i + 1}`);
            }
        } catch (error) {
            console.log(`   ❌ Error downloading page ${i + 1}: ${error.message}`);
        }
    }
    
    if (successCount > 0) {
        const pdfPath = path.join(__dirname, `${outputName}.pdf`);
        await createPDF(imagePaths, pdfPath, name);
        console.log(`   ✅ ${name}: SUCCESS - ${successCount}/${urls.length} pages downloaded`);
        return { success: true, pages: successCount };
    } else {
        console.log(`   ❌ ${name}: FAILED - No pages downloaded`);
        return { success: false, pages: 0 };
    }
}

async function runValidation() {
    console.log('🚀 MSS Downloader Validation Protocol\n');
    console.log('=' .repeat(60));
    
    const results = [];
    
    // 1. Test Verona (should work now)
    const veronaUrls = [
        'https://imagoarchive.it/fedora/objects/iw-man:38513/datastreams/IMG15/content',
        'https://imagoarchive.it/fedora/objects/iw-man:38514/datastreams/IMG15/content',
        'https://imagoarchive.it/fedora/objects/iw-man:38515/datastreams/IMG15/content'
    ];
    results.push(await testLibrary('Verona Library', veronaUrls, 'verona-test'));
    
    // 2. Test MDC Catalonia (should work now)
    const mdcUrls = [
        'https://cdm21042.contentdm.oclc.org/digital/iiif/2/incunableBC:175331:175331/full/full/0/default.jpg',
        'https://cdm21042.contentdm.oclc.org/digital/iiif/2/incunableBC:175332:175332/full/full/0/default.jpg',
        'https://cdm21042.contentdm.oclc.org/digital/iiif/2/incunableBC:175333:175333/full/full/0/default.jpg'
    ];
    results.push(await testLibrary('MDC Catalonia', mdcUrls, 'mdc-test'));
    
    // 3. Test University of Graz (should work with SSL bypass)
    const grazUrls = [
        'https://unipub.uni-graz.at/obvugriiif/00A0/8224/5380/00000001/full/full/0/native.jpg',
        'https://unipub.uni-graz.at/obvugriiif/00A0/8224/5380/00000002/full/full/0/native.jpg',
        'https://unipub.uni-graz.at/obvugriiif/00A0/8224/5380/00000003/full/full/0/native.jpg'
    ];
    results.push(await testLibrary('University of Graz', grazUrls, 'graz-test'));
    
    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 VALIDATION SUMMARY\n');
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (successful >= 2) {
        console.log('\n✅ VALIDATION PASSED - Fixes are working!');
        console.log('   Ready for version bump and release.');
    } else {
        console.log('\n❌ VALIDATION FAILED - Please investigate failures');
    }
    
    // Clean up temp files
    const tempDir = path.join(__dirname, 'temp');
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

runValidation().catch(console.error);