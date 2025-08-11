/**
 * Simple test for Linz library integration
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

async function testLinzManifest(id) {
    const url = `https://digi.landesbibliothek.at/viewer/api/v1/records/${id}/manifest/`;
    console.log(`\nTesting manuscript ${id}...`);
    console.log(`URL: ${url}`);
    
    try {
        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const manifest = response.data;
        const title = manifest.label || `MS ${id}`;
        console.log(`✓ Title: ${title}`);
        
        // Count pages
        let pageCount = 0;
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            pageCount = manifest.sequences[0].canvases.length;
        }
        console.log(`✓ Pages: ${pageCount}`);
        
        // Get first page URL
        if (pageCount > 0) {
            const firstCanvas = manifest.sequences[0].canvases[0];
            if (firstCanvas.images && firstCanvas.images[0]) {
                const imageService = firstCanvas.images[0].resource?.service?.['@id'];
                if (imageService) {
                    const imageUrl = `${imageService}/full/max/0/default.jpg`;
                    console.log(`✓ First page URL: ${imageUrl}`);
                    
                    // Download first page
                    const imageResponse = await axios.get(imageUrl, {
                        responseType: 'arraybuffer',
                        headers: {
                            'User-Agent': 'Mozilla/5.0'
                        }
                    });
                    
                    const size = imageResponse.data.length;
                    console.log(`✓ First page size: ${(size / 1024 / 1024).toFixed(2)} MB`);
                    
                    // Save to file
                    const outputDir = path.join(__dirname, 'linz-samples');
                    await fs.mkdir(outputDir, { recursive: true });
                    const outputFile = path.join(outputDir, `${id}_page1.jpg`);
                    await fs.writeFile(outputFile, imageResponse.data);
                    console.log(`✓ Saved to: ${outputFile}`);
                }
            }
        }
        
        return true;
    } catch (error) {
        console.error(`✗ Error: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('=== Testing Linz Library Integration ===');
    
    const testIds = [116, 254, 279, 1194];
    let successCount = 0;
    
    for (const id of testIds) {
        const success = await testLinzManifest(id);
        if (success) successCount++;
    }
    
    console.log('\n' + '='.repeat(40));
    console.log(`Results: ${successCount}/${testIds.length} manuscripts tested successfully`);
    
    if (successCount === testIds.length) {
        console.log('✓ All tests passed!');
    } else {
        console.log('✗ Some tests failed');
    }
}

main().catch(console.error);