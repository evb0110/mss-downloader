// Test the Graz implementation fix
const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Updated ID extraction logic matching the fix
function extractManuscriptId(grazUrl) {
    let manuscriptId;
    
    // Handle direct image download URL pattern
    if (grazUrl.includes('/download/webcache/')) {
        throw new Error('Direct webcache image URLs cannot be used to download full manuscripts. Please use a titleinfo or pageview URL instead (e.g., https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538)');
    } else {
        // Handle standard content URLs
        const manuscriptIdMatch = grazUrl.match(/\/(\d+)$/);
        if (!manuscriptIdMatch) {
            throw new Error('Could not extract manuscript ID from Graz URL');
        }
        
        manuscriptId = manuscriptIdMatch[1];
        
        // If this is a pageview URL, convert to titleinfo ID using known pattern
        // Pattern: pageview ID - 2 = titleinfo ID (e.g., 8224540 -> 8224538)
        if (grazUrl.includes('/pageview/')) {
            const pageviewId = parseInt(manuscriptId);
            const titleinfoId = (pageviewId - 2).toString();
            console.log(`Converting pageview ID ${pageviewId} to titleinfo ID ${titleinfoId}`);
            manuscriptId = titleinfoId;
        }
    }
    
    return manuscriptId;
}

// Download and validate manuscript pages
async function downloadAndValidate(url, testDir) {
    console.log(`\n📋 Testing URL: ${url}`);
    
    try {
        // Extract ID
        const manuscriptId = extractManuscriptId(url);
        const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${manuscriptId}/manifest`;
        
        console.log(`   Extracted manuscript ID: ${manuscriptId}`);
        console.log(`   Loading manifest from: ${manifestUrl}`);
        
        // Fetch manifest
        const manifestData = await new Promise((resolve, reject) => {
            https.get(manifestUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            }, (res) => {
                let data = '';
                
                if (res.statusCode !== 200) {
                    reject(new Error(`Manifest fetch failed: HTTP ${res.statusCode}`));
                    return;
                }
                
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
        
        const manifest = JSON.parse(manifestData);
        const canvases = manifest.sequences[0].canvases;
        const title = typeof manifest.label === 'string' ? manifest.label : 'Graz Manuscript';
        
        console.log(`   ✅ Manifest loaded: "${title}"`);
        console.log(`   📄 Total pages: ${canvases.length}`);
        
        // Download 10 different pages for validation
        const pagesToDownload = Math.min(10, canvases.length);
        const pageIndices = Array.from({length: pagesToDownload}, (_, i) => 
            Math.floor(i * canvases.length / pagesToDownload)
        );
        
        console.log(`   📥 Downloading ${pagesToDownload} pages for validation...`);
        
        const downloadedImages = [];
        
        for (let i = 0; i < pageIndices.length; i++) {
            const pageIdx = pageIndices[i];
            const canvas = canvases[pageIdx];
            const imageUrl = canvas.images[0]?.resource?.['@id'];
            
            if (!imageUrl) continue;
            
            // Convert to highest resolution URL (2000px)
            const highResUrl = imageUrl.replace('/webcache/1000/', '/webcache/2000/');
            
            console.log(`   Downloading page ${pageIdx + 1}/${canvases.length}...`);
            
            const imageData = await new Promise((resolve, reject) => {
                https.get(highResUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    }
                }, (res) => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`Image download failed: HTTP ${res.statusCode}`));
                        return;
                    }
                    
                    const chunks = [];
                    res.on('data', chunk => chunks.push(chunk));
                    res.on('end', () => resolve(Buffer.concat(chunks)));
                }).on('error', reject);
            });
            
            const imagePath = path.join(testDir, `graz_${manuscriptId}_page_${pageIdx + 1}.jpg`);
            await fs.writeFile(imagePath, imageData);
            downloadedImages.push(imagePath);
            
            console.log(`   ✅ Page ${pageIdx + 1} downloaded: ${imageData.length} bytes`);
        }
        
        // Create PDF for validation
        if (downloadedImages.length > 0) {
            const pdfPath = path.join(testDir, `graz_${manuscriptId}_validation.pdf`);
            console.log(`   📄 Creating validation PDF...`);
            
            try {
                await execAsync(`convert ${downloadedImages.join(' ')} "${pdfPath}"`);
                console.log(`   ✅ PDF created: ${pdfPath}`);
                
                // Validate with poppler
                const { stdout } = await execAsync(`pdfinfo "${pdfPath}"`);
                console.log(`   ✅ PDF validated with poppler`);
            } catch (error) {
                console.log(`   ⚠️ Could not create/validate PDF: ${error.message}`);
            }
        }
        
        console.log(`   ✅ Validation complete for ${url}`);
        return true;
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return false;
    }
}

// Main test function
async function validateGrazFix() {
    console.log('🧪 Validating University of Graz fix...\n');
    
    const testUrls = [
        'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
        'https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540',
        'https://unipub.uni-graz.at/download/webcache/1504/8224544'
    ];
    
    const timestamp = Date.now();
    const testDir = path.join(__dirname, `graz-validation-${timestamp}`);
    await fs.mkdir(testDir, { recursive: true });
    
    const results = [];
    
    for (const url of testUrls) {
        const success = await downloadAndValidate(url, testDir);
        results.push({ url, success });
    }
    
    console.log('\n📊 Summary:');
    results.forEach(({ url, success }) => {
        console.log(`   ${success ? '✅' : '❌'} ${url}`);
    });
    
    console.log(`\n📁 Validation files saved to: ${testDir}`);
    console.log('\n✅ Validation complete');
}

validateGrazFix().catch(console.error);