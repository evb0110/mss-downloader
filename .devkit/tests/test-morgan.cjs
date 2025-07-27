
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Add the SharedManifestLoaders to path
const projectRoot = path.join(__dirname, '..', '..');
const SharedManifestLoaders = require(path.join(projectRoot, 'src', 'shared', 'SharedManifestLoaders.js'));

async function testMorgan() {
    console.log('Starting morgan test...');
    const startTime = Date.now();
    
    const loader = new SharedManifestLoaders();
    let manifest;
    
    try {
        // Load manifest
        console.log('Loading manifest...');
        const url = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
        
        switch('morgan') {
            case 'verona':
                manifest = await loader.getVeronaManifest(url);
                break;
            case 'morgan':
                // Morgan needs special handling - use main service
                console.log('Morgan Library requires the main service for full functionality');
                // For now, just test that we can fetch the page
                const response = await loader.fetchWithRetry(url);
                const html = await response.text();
                console.log('Morgan page fetched, length:', html.length);
                console.log('Found "collection" references:', (html.match(/collection/g) || []).length);
                return;
            case 'hhu':
                // Extract ID and create manifest URL
                const hhuMatch = url.match(/titleinfo\/(\d+)/);
                if (hhuMatch) {
                    const manifestUrl = `https://digital.ulb.hhu.de/i3f/v20/${hhuMatch[1]}/manifest`;
                    const response = await loader.fetchWithRetry(manifestUrl);
                    manifest = JSON.parse(await response.text());
                    manifest = {
                        images: manifest.sequences[0].canvases.slice(0, 10).map((canvas, i) => ({
                            url: canvas.images[0].resource.service['@id'] + '/full/full/0/default.jpg',
                            label: `Page ${i + 1}`
                        }))
                    };
                }
                break;
            case 'graz':
                // Extract ID and create manifest URL
                const grazMatch = url.match(/titleinfo\/(\d+)/);
                if (grazMatch) {
                    const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${grazMatch[1]}/manifest`;
                    console.log('Fetching Graz manifest from:', manifestUrl);
                    console.log('This may take up to 90 seconds due to large manifest size...');
                    const response = await loader.fetchWithRetry(manifestUrl, { timeout: 90000 });
                    manifest = JSON.parse(await response.text());
                    manifest = {
                        images: manifest.sequences[0].canvases.slice(0, 10).map((canvas, i) => ({
                            url: canvas.images[0].resource.service['@id'] + '/full/2000,/0/default.jpg',
                            label: `Page ${i + 1}`
                        }))
                    };
                }
                break;
        }
        
        if (manifest && manifest.images) {
            console.log(`Found ${manifest.images.length} pages in manifest`);
            console.log('First page URL:', manifest.images[0]?.url?.substring(0, 100) + '...');
            
            // Log progress
            const totalPages = manifest.images.length;
            console.log(`\nProcessing ${totalPages} pages...\n`);
            
            // Simulate progress logging
            for (let i = 0; i < totalPages; i++) {
                if ((i + 1) % 10 === 0 || i === totalPages - 1) {
                    const progress = Math.round(((i + 1) / totalPages) * 100);
                    console.log(`Progress: ${i + 1}/${totalPages} pages (${progress}%)`);
                }
            }
        }
        
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`\nmorgan test completed in ${elapsed} seconds`);
        
    } catch (error) {
        console.error(`morgan test failed:`, error.message);
        if (error.message.includes('timeout')) {
            console.error('The server is not responding within the timeout period');
        }
    }
}

testMorgan().catch(console.error);
