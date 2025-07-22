// Simple test to download Florence image and create PDF
const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const { PDFDocument } = require('pdf-lib');

async function fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fetchUrl(url);
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`  Retry ${i + 1}/${retries} after error: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        }
    }
}

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': '*/*'
            },
            timeout: 30000
        };

        const req = https.request(requestOptions, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchUrl(res.headers.location).then(resolve).catch(reject);
                return;
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    headers: res.headers,
                    buffer: () => Promise.resolve(buffer)
                });
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

async function testFlorence() {
    const url = 'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:317515/full/full/0/default.jpg';
    const outputDir = path.join(__dirname, 'validation-results', '2025-07-22', 'Florence_Simple');
    
    await fs.mkdir(outputDir, { recursive: true });
    
    console.log('Testing Florence ContentDM...');
    console.log(`URL: ${url}`);
    
    try {
        const response = await fetchWithRetry(url);
        console.log(`Status: ${response.status} (${response.ok ? 'OK' : 'FAILED'})`);
        
        if (response.ok) {
            const buffer = await response.buffer();
            console.log(`Downloaded: ${(buffer.length / 1024).toFixed(2)} KB`);
            
            // Save image
            const imagePath = path.join(outputDir, 'florence_test.jpg');
            await fs.writeFile(imagePath, buffer);
            
            // Create PDF
            console.log('Creating PDF...');
            const pdfDoc = await PDFDocument.create();
            const jpgImage = await pdfDoc.embedJpg(buffer);
            const page = pdfDoc.addPage([jpgImage.width, jpgImage.height]);
            page.drawImage(jpgImage, {
                x: 0,
                y: 0,
                width: jpgImage.width,
                height: jpgImage.height
            });
            
            const pdfBytes = await pdfDoc.save();
            const pdfPath = path.join(outputDir, 'Florence_test.pdf');
            await fs.writeFile(pdfPath, pdfBytes);
            
            console.log(`PDF created: ${pdfPath}`);
            console.log(`PDF size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
            
            // Validate with poppler
            try {
                execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8', stdio: 'pipe' });
                console.log('✓ PDF validation passed');
                
                // Extract and check image
                execSync(`pdfimages -png -f 1 -l 1 "${pdfPath}" "${outputDir}/test"`);
                console.log('✓ Image extracted successfully');
                
                return true;
            } catch (error) {
                console.log('✗ PDF validation failed:', error.message);
                return false;
            }
        } else {
            console.log('✗ Download failed');
            return false;
        }
    } catch (error) {
        console.log('✗ Error:', error.message);
        return false;
    }
}

testFlorence().then(success => {
    console.log(success ? '\n🎉 Florence test PASSED!' : '\n❌ Florence test FAILED!');
}).catch(console.error);