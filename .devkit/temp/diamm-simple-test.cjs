const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function testDiammManifests() {
    console.log('🎼 Testing DIAMM Manifests and Max Resolution...\n');

    // Test manifests
    const testManuscripts = [
        {
            name: 'I-Ra-Ms1383-SMALL-17-PAGES',
            manifestUrl: 'https://iiif.diamm.net/manifests/I-Ra-Ms1383/manifest.json',
            description: 'Small manuscript (17 pages) - Medieval music notation from Rome'
        },
        {
            name: 'I-Rv-C_32-MEDIUM-75-PAGES',
            manifestUrl: 'https://iiif.diamm.net/manifests/I-Rv-C_32/manifest.json',
            description: 'Medium manuscript (75 pages) - Medieval chant collection'
        }
    ];

    // Create validation directory
    const validationDir = path.join(__dirname, '../../CURRENT-VALIDATION');
    if (fs.existsSync(validationDir)) {
        fs.rmSync(validationDir, { recursive: true, force: true });
    }
    fs.mkdirSync(validationDir, { recursive: true });

    console.log(`📁 Validation directory: ${validationDir}\n`);

    for (const manuscript of testManuscripts) {
        console.log(`📜 Testing: ${manuscript.name}`);
        console.log(`📝 Description: ${manuscript.description}`);
        console.log(`🔗 Manifest URL: ${manuscript.manifestUrl}`);

        try {
            // 1. Load manifest
            console.log('📋 Loading manifest...');
            const manifestResponse = await fetch(manuscript.manifestUrl);
            const manifestData = await manifestResponse.json();
            
            console.log(`📄 Manifest loaded: ${manifestData.sequences[0].canvases.length} canvases`);
            console.log(`🏷️  Label: ${manifestData.label}`);

            // 2. Test maximum resolution for first 3 pages
            console.log('🖼️  Testing maximum resolution for first 3 pages...');
            const canvases = manifestData.sequences[0].canvases.slice(0, 3);

            for (let i = 0; i < canvases.length; i++) {
                const canvas = canvases[i];
                const imageResource = canvas.images[0].resource;
                const imageId = imageResource.service['@id'];
                
                console.log(`\n  📸 Page ${i + 1}: ${canvas.label}`);
                console.log(`  🔗 Image ID: ${imageId}`);

                // Test different resolutions
                const resolutions = ['max', '4000,', '2000,', '1000,', '500,'];
                
                for (const resolution of resolutions) {
                    const imageUrl = `${imageId}/full/${resolution}/0/default.jpg`;
                    
                    try {
                        console.log(`    Testing ${resolution}...`);
                        
                        const imageResponse = await fetch(imageUrl, { 
                            method: 'HEAD',
                            timeout: 10000
                        });
                        
                        if (imageResponse.ok) {
                            const contentLength = imageResponse.headers.get('content-length');
                            const sizeKB = contentLength ? Math.round(contentLength / 1024) : 'unknown';
                            console.log(`    ✅ ${resolution}: ${sizeKB} KB`);
                            
                            // Download the 'max' resolution for validation
                            if (resolution === 'max') {
                                console.log(`    🔽 Downloading max resolution...`);
                                const downloadResponse = await fetch(imageUrl);
                                const buffer = await downloadResponse.buffer();
                                
                                const filename = `${manuscript.name}_page_${i + 1}_${resolution.replace(',', 'px')}.jpg`;
                                const filePath = path.join(validationDir, filename);
                                fs.writeFileSync(filePath, buffer);
                                
                                console.log(`    💾 Saved: ${filename} (${Math.round(buffer.length / 1024)} KB)`);
                            }
                        } else {
                            console.log(`    ❌ ${resolution}: ${imageResponse.status}`);
                        }
                    } catch (error) {
                        console.log(`    ❌ ${resolution}: ${error.message}`);
                    }
                }
            }

        } catch (error) {
            console.log(`❌ Error testing ${manuscript.name}: ${error.message}`);
        }

        console.log('─'.repeat(60));
    }

    console.log('\n🎯 DIAMM Manifest Test Complete!');
    console.log(`📂 Sample images saved to: ${validationDir}`);
    console.log('📋 Ready to build full PDFs using the app');
}

// Run the test
testDiammManifests().catch((error) => {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
});