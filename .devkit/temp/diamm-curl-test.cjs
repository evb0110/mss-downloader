const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testDiammWithCurl() {
    console.log('🎼 Testing DIAMM with curl...\n');

    // Create validation directory
    const validationDir = path.join(__dirname, '../../CURRENT-VALIDATION');
    if (fs.existsSync(validationDir)) {
        fs.rmSync(validationDir, { recursive: true, force: true });
    }
    fs.mkdirSync(validationDir, { recursive: true });

    console.log(`📁 Validation directory: ${validationDir}\n`);

    // Test manifest
    const manifestUrl = 'https://iiif.diamm.net/manifests/I-Ra-Ms1383/manifest.json';
    console.log(`📋 Loading manifest: ${manifestUrl}`);

    try {
        // Download manifest
        const manifestPath = path.join(validationDir, 'I-Ra-Ms1383-manifest.json');
        await downloadWithCurl(manifestUrl, manifestPath);
        console.log('✅ Manifest downloaded');

        // Parse manifest
        const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        console.log(`📄 Manifest loaded: ${manifestData.sequences[0].canvases.length} canvases`);
        console.log(`🏷️  Label: ${manifestData.label}`);

        // Test first 3 pages at max resolution
        const canvases = manifestData.sequences[0].canvases.slice(0, 3);
        console.log(`🖼️  Testing ${canvases.length} pages at maximum resolution...\n`);

        for (let i = 0; i < canvases.length; i++) {
            const canvas = canvases[i];
            const imageResource = canvas.images[0].resource;
            const imageId = imageResource.service['@id'];
            
            console.log(`📸 Page ${i + 1}: ${canvas.label}`);
            console.log(`🔗 Image ID: ${imageId}`);

            // Test max resolution
            const maxResUrl = `${imageId}/full/max/0/default.jpg`;
            const filename = `I-Ra-Ms1383_page_${i + 1}_max.jpg`;
            const filePath = path.join(validationDir, filename);
            
            console.log(`  🔽 Downloading max resolution...`);
            console.log(`  📎 URL: ${maxResUrl}`);

            try {
                await downloadWithCurl(maxResUrl, filePath);
                
                // Get file size
                const stats = fs.statSync(filePath);
                const fileSizeKB = Math.round(stats.size / 1024);
                console.log(`  ✅ Downloaded: ${filename} (${fileSizeKB} KB)`);
                
                // Get image dimensions using identify if available
                await getImageDimensions(filePath);
                
            } catch (error) {
                console.log(`  ❌ Download failed: ${error.message}`);
            }
            
            console.log('');
        }

        console.log('🎯 DIAMM Max Resolution Test Complete!');
        console.log(`📂 Sample images saved to: ${validationDir}`);
        console.log('🔍 Ready for manual validation');

    } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
    }
}

function downloadWithCurl(url, outputPath) {
    return new Promise((resolve, reject) => {
        const curl = spawn('curl', [
            '-L', // Follow redirects
            '-o', outputPath,
            '--max-time', '30',
            '--connect-timeout', '10',
            url
        ]);

        curl.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`curl failed with code ${code}`));
            }
        });

        curl.on('error', (error) => {
            reject(error);
        });
    });
}

function getImageDimensions(imagePath) {
    return new Promise((resolve) => {
        const identify = spawn('identify', [imagePath]);
        
        let output = '';
        identify.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        identify.on('close', (code) => {
            if (code === 0) {
                // Parse identify output: filename format WxH ...
                const match = output.match(/(\d+)x(\d+)/);
                if (match) {
                    console.log(`  📏 Dimensions: ${match[1]} x ${match[2]} pixels`);
                }
            } else {
                console.log(`  ⚠️  ImageMagick identify not available`);
            }
            resolve();
        });
        
        identify.on('error', () => {
            console.log(`  ⚠️  ImageMagick identify not available`);
            resolve();
        });
    });
}

// Run the test
testDiammWithCurl().catch((error) => {
    console.error('❌ Test failed:', error.message);
});