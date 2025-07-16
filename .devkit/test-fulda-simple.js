const fs = require('fs').promises;
const path = require('path');

async function testFuldaManifests() {
    console.log('Testing Fulda manifest loading...\n');
    
    const testUrls = [
        {
            url: 'https://fuldig.hs-fulda.de/viewer/image/PPN314753702/',
            ppnId: 'PPN314753702'
        },
        {
            url: 'https://fuldig.hs-fulda.de/viewer/api/v1/records/PPN314753702/manifest/',
            ppnId: 'PPN314753702'
        },
        {
            url: 'https://fuldig.hs-fulda.de/viewer/image/PPN314755322/2/',
            ppnId: 'PPN314755322'
        }
    ];
    
    for (const testCase of testUrls) {
        console.log(`Testing: ${testCase.url}`);
        
        // Test PPN extraction with fixed regex
        const urlMatch = testCase.url.match(/(?:\/image\/|\/records\/)([^/]+)/);
        if (urlMatch && urlMatch[1] === testCase.ppnId) {
            console.log(`✅ PPN extracted correctly: ${urlMatch[1]}`);
        } else {
            console.log(`❌ PPN extraction failed`);
            continue;
        }
        
        // Test manifest URL construction and loading
        const manifestUrl = `https://fuldig.hs-fulda.de/viewer/api/v1/records/${testCase.ppnId}/manifest/`;
        console.log(`   Manifest URL: ${manifestUrl}`);
        
        try {
            const response = await fetch(manifestUrl);
            if (response.ok) {
                const manifest = await response.json();
                console.log(`   ✅ Manifest loaded successfully`);
                console.log(`   Title: ${manifest.label || 'No label'}`);
                
                // Check for sequences/canvases
                if (manifest.sequences && manifest.sequences[0].canvases) {
                    const pageCount = manifest.sequences[0].canvases.length;
                    console.log(`   Pages: ${pageCount}`);
                    
                    // Check first page for image quality
                    const firstCanvas = manifest.sequences[0].canvases[0];
                    if (firstCanvas.images && firstCanvas.images[0]) {
                        const imageResource = firstCanvas.images[0].resource;
                        const serviceUrl = imageResource.service ? imageResource.service['@id'] : imageResource['@id'];
                        
                        // Check if it's configured for maximum quality
                        const maxQualityUrl = `${serviceUrl}/full/full/0/default.jpg`;
                        console.log(`   First page max quality URL: ${maxQualityUrl}`);
                    }
                }
            } else {
                console.log(`   ❌ Failed to load manifest: HTTP ${response.status}`);
            }
        } catch (error) {
            console.log(`   ❌ Error loading manifest: ${error.message}`);
        }
        
        console.log('---\n');
    }
    
    // Download validation PDF for one manuscript
    console.log('Creating validation PDF...');
    await createValidationPdf();
}

async function createValidationPdf() {
    try {
        const manifestUrl = 'https://fuldig.hs-fulda.de/viewer/api/v1/records/PPN314753702/manifest/';
        const response = await fetch(manifestUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to load manifest: HTTP ${response.status}`);
        }
        
        const manifest = await response.json();
        const validationDir = path.join(__dirname, 'fulda-validation-' + Date.now());
        await fs.mkdir(validationDir, { recursive: true });
        
        // Download first 5 pages
        const pagesToDownload = Math.min(5, manifest.sequences[0].canvases.length);
        console.log(`Downloading ${pagesToDownload} pages from "${manifest.label}"...`);
        
        for (let i = 0; i < pagesToDownload; i++) {
            const canvas = manifest.sequences[0].canvases[i];
            const imageResource = canvas.images[0].resource;
            const serviceUrl = imageResource.service ? imageResource.service['@id'] : imageResource['@id'];
            
            // Use maximum quality
            const imageUrl = `${serviceUrl}/full/full/0/default.jpg`;
            
            console.log(`Downloading page ${i + 1}...`);
            const imgResponse = await fetch(imageUrl);
            
            if (!imgResponse.ok) {
                console.log(`  ❌ Failed to download page ${i + 1}`);
                continue;
            }
            
            const buffer = Buffer.from(await imgResponse.arrayBuffer());
            const imagePath = path.join(validationDir, `page_${String(i + 1).padStart(3, '0')}.jpg`);
            await fs.writeFile(imagePath, buffer);
            
            const stats = await fs.stat(imagePath);
            console.log(`  ✅ Page ${i + 1}: ${(stats.size / 1024).toFixed(1)} KB`);
        }
        
        console.log(`\n✅ Validation images saved to: ${validationDir}`);
        
        // Create PDF using poppler
        const { execSync } = require('child_process');
        const pdfPath = path.join(validationDir, 'fulda-validation.pdf');
        
        try {
            execSync(`cd "${validationDir}" && img2pdf page_*.jpg -o fulda-validation.pdf`, { stdio: 'pipe' });
            console.log(`✅ PDF created: ${pdfPath}`);
        } catch (error) {
            console.log('Note: img2pdf not available, skipping PDF creation');
        }
        
    } catch (error) {
        console.log(`❌ Validation failed: ${error.message}`);
    }
}

testFuldaManifests();