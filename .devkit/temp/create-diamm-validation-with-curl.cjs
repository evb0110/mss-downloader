const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// DIAMM test manuscripts - smaller ones for faster validation
const testManuscripts = [
    {
        name: 'I-Ra-Ms1383-SMALL-17-PAGES',
        manifestUrl: 'https://iiif.diamm.net/manifests/I-Ra-Ms1383/manifest.json',
        testPages: 3 // Download first 3 pages only for validation
    },
    {
        name: 'I-Rv-C_32-SAMPLE-10-PAGES', 
        manifestUrl: 'https://iiif.diamm.net/manifests/I-Rv-C_32/manifest.json',
        testPages: 5 // Download first 5 pages only for validation
    }
];

const outputDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/CURRENT-VALIDATION/DIAMM-VALIDATION';

async function fetchManifestWithCurl(manifestUrl) {
    console.log(`📥 Fetching manifest: ${manifestUrl}`);
    
    return new Promise((resolve, reject) => {
        const curl = spawn('curl', ['-L', '--max-time', '30', manifestUrl]);
        let data = '';
        
        curl.stdout.on('data', (chunk) => {
            data += chunk.toString();
        });
        
        curl.on('close', (code) => {
            if (code === 0) {
                try {
                    const manifest = JSON.parse(data);
                    resolve(manifest);
                } catch (parseError) {
                    reject(new Error(`Failed to parse JSON: ${parseError.message}`));
                }
            } else {
                reject(new Error(`curl failed with code ${code}`));
            }
        });
        
        curl.on('error', reject);
    });
}

async function getImageUrls(manifest, maxPages = 5) {
    const sequences = manifest.sequences || [];
    if (sequences.length === 0) {
        throw new Error('No sequences found in manifest');
    }
    
    const canvases = sequences[0].canvases || [];
    const imageUrls = [];
    
    for (let i = 0; i < Math.min(canvases.length, maxPages); i++) {
        const canvas = canvases[i];
        const images = canvas.images || [];
        
        if (images.length > 0) {
            const imageResource = images[0].resource;
            let imageUrl = imageResource['@id'] || imageResource.id;
            
            // For DIAMM, ensure we get maximum resolution
            if (imageUrl && imageUrl.includes('iiif.diamm.net')) {
                // Replace any size parameter with /full/max/0/default.jpg for maximum quality
                imageUrl = imageUrl.replace(/\/full\/[^\/]+\/0\/default\.jpg$/, '/full/max/0/default.jpg');
            }
            
            imageUrls.push({
                url: imageUrl,
                pageNumber: i + 1,
                label: canvas.label || `Page ${i + 1}`
            });
        }
    }
    
    return imageUrls;
}

async function downloadImage(imageUrl, outputPath) {
    return new Promise((resolve, reject) => {
        const curl = spawn('curl', [
            '-L', // Follow redirects
            '-o', outputPath,
            '--max-time', '30',
            '--retry', '3',
            imageUrl
        ]);
        
        curl.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`curl failed with code ${code}`));
            }
        });
        
        curl.on('error', reject);
    });
}

async function createValidationPdf(manuscript) {
    console.log(`\n📋 Creating validation PDF for: ${manuscript.name}`);
    
    try {
        // Fetch manifest
        const manifest = await fetchManifestWithCurl(manuscript.manifestUrl);
        console.log(`✅ Manifest loaded: ${manifest.label || 'Unknown title'}`);
        
        // Get image URLs 
        const imageUrls = await getImageUrls(manifest, manuscript.testPages);
        console.log(`📸 Found ${imageUrls.length} images to download`);
        
        // Download images
        const downloadedImages = [];
        for (const imageInfo of imageUrls) {
            const filename = `${manuscript.name}_page_${imageInfo.pageNumber.toString().padStart(3, '0')}.jpg`;
            const imagePath = path.join(outputDir, filename);
            
            console.log(`⬇️ Downloading page ${imageInfo.pageNumber}: ${imageInfo.url}`);
            
            try {
                await downloadImage(imageInfo.url, imagePath);
                
                // Check file size
                const stats = await fs.stat(imagePath);
                const fileSizeKB = (stats.size / 1024).toFixed(1);
                
                console.log(`✅ Downloaded: ${filename} (${fileSizeKB} KB)`);
                downloadedImages.push(imagePath);
                
                // Quick validation: check if file is not empty and has JPEG header
                const buffer = await fs.readFile(imagePath);
                if (buffer.length < 1000) {
                    throw new Error('File too small, probably an error response');
                }
                
                if (!buffer.slice(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]))) {
                    throw new Error('Not a valid JPEG file');
                }
                
                console.log(`🖼️ Image validated: JPEG format, ${fileSizeKB} KB`);
                
            } catch (downloadError) {
                console.log(`❌ Failed to download page ${imageInfo.pageNumber}: ${downloadError.message}`);
            }
        }
        
        if (downloadedImages.length === 0) {
            throw new Error('No images were downloaded successfully');
        }
        
        // Create PDF using ImageMagick
        const pdfPath = path.join(outputDir, `${manuscript.name}_VALIDATION.pdf`);
        console.log(`📄 Creating PDF: ${pdfPath}`);
        
        await new Promise((resolve, reject) => {
            const convert = spawn('convert', [...downloadedImages, pdfPath]);
            
            convert.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ PDF created successfully`);
                    resolve();
                } else {
                    reject(new Error(`convert failed with code ${code}`));
                }
            });
            
            convert.on('error', reject);
        });
        
        // Validate PDF
        const stats = await fs.stat(pdfPath);
        const pdfSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`📊 PDF size: ${pdfSizeMB} MB`);
        
        // Clean up individual images (optional)
        for (const imagePath of downloadedImages) {
            try {
                await fs.unlink(imagePath);
            } catch (err) {
                // Ignore cleanup errors
            }
        }
        
        return true;
        
    } catch (error) {
        console.log(`❌ Failed to create validation PDF: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🎵 DIAMM Library Validation Sample Creation');
    console.log('===========================================');
    
    let successCount = 0;
    
    for (const manuscript of testManuscripts) {
        const success = await createValidationPdf(manuscript);
        if (success) successCount++;
    }
    
    console.log(`\n📊 Validation Summary:`);
    console.log(`✅ Successful: ${successCount}/${testManuscripts.length}`);
    console.log(`📁 Output directory: ${outputDir}`);
    
    if (successCount === testManuscripts.length) {
        console.log('\n🎉 DIAMM validation samples created successfully!');
        console.log('✅ Ready for user validation');
        
        // List created files
        try {
            const files = await fs.readdir(outputDir);
            const pdfFiles = files.filter(f => f.endsWith('.pdf'));
            
            console.log('\n📄 Created validation PDFs:');
            pdfFiles.forEach(file => {
                console.log(`   - ${file}`);
            });
            
        } catch (err) {
            console.log('⚠️  Could not list created files');
        }
        
    } else {
        console.log('\n❌ Some validation samples failed to create');
        process.exit(1);
    }
}

main().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
});