const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function runDiammValidation() {
    console.log('🎼 Starting DIAMM Library Validation Protocol...\n');

    // Test manuscripts with different sizes for comprehensive validation
    const testManuscripts = [
        {
            name: 'I-Ra-Ms1383-SMALL-17-PAGES',
            url: 'https://iiif.diamm.net/manifests/I-Ra-Ms1383/manifest.json',
            description: 'Small manuscript (17 pages) - Medieval music notation from Rome'
        },
        {
            name: 'I-Rv-C_32-MEDIUM-75-PAGES',
            url: 'https://iiif.diamm.net/manifests/I-Rv-C_32/manifest.json',
            description: 'Medium manuscript (75 pages) - Medieval chant collection'
        },
        {
            name: 'I-Rc-Ms-1574-LARGE-78-PAGES',
            url: 'https://iiif.diamm.net/manifests/I-Rc-Ms-1574/manifest.json',
            description: 'Large manuscript (78 pages) - Complex medieval music notation'
        }
    ];

    const validationDir = path.join(__dirname, '../../CURRENT-VALIDATION');
    
    // Clean and create validation directory
    if (fs.existsSync(validationDir)) {
        fs.rmSync(validationDir, { recursive: true, force: true });
    }
    fs.mkdirSync(validationDir, { recursive: true });

    console.log(`📁 Validation directory: ${validationDir}\n`);

    // Process each manuscript
    for (const manuscript of testManuscripts) {
        console.log(`📜 Processing: ${manuscript.name}`);
        console.log(`📝 Description: ${manuscript.description}`);
        console.log(`🔗 URL: ${manuscript.url}`);
        
        const outputPath = path.join(validationDir, `${manuscript.name}.pdf`);
        
        try {
            // Run the electron app download
            const result = await runElectronDownload(manuscript.url, outputPath);
            
            if (result.success) {
                console.log(`✅ Successfully generated: ${manuscript.name}.pdf`);
                
                // Get file size
                const stats = fs.statSync(outputPath);
                const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                console.log(`📏 File size: ${fileSizeMB} MB`);
                
                // Extract first few pages for validation
                await extractPagesForValidation(outputPath, manuscript.name);
                
            } else {
                console.log(`❌ Failed to process ${manuscript.name}: ${result.error}`);
            }
            
        } catch (error) {
            console.log(`❌ Error processing ${manuscript.name}: ${error.message}`);
        }
        
        console.log('─'.repeat(50));
    }

    console.log('\n🎯 DIAMM Validation Protocol Complete!');
    console.log(`📂 All PDFs saved to: ${validationDir}`);
    console.log('🔍 Ready for manual PDF inspection by user');
}

function runElectronDownload(url, outputPath) {
    return new Promise((resolve) => {
        const appPath = path.join(__dirname, '../../dist/mac/Manuscript Downloader.app/Contents/MacOS/Manuscript Downloader');
        
        console.log(`🚀 Starting download with Electron app...`);
        
        const child = spawn(appPath, [
            '--url', url,
            '--output', outputPath,
            '--headless'
        ], {
            stdio: 'pipe',
            detached: false
        });

        let output = '';
        let errorOutput = '';

        child.stdout.on('data', (data) => {
            output += data.toString();
            // Show progress
            if (data.toString().includes('progress') || data.toString().includes('Downloaded') || data.toString().includes('Merging')) {
                process.stdout.write('.');
            }
        });

        child.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        child.on('close', (code) => {
            console.log(''); // New line after progress dots
            
            if (code === 0) {
                console.log('✅ Download completed successfully');
                resolve({ success: true, output });
            } else {
                console.log(`❌ Download failed with code: ${code}`);
                console.log(`Error: ${errorOutput}`);
                resolve({ success: false, error: errorOutput });
            }
        });

        child.on('error', (error) => {
            console.log(`❌ Failed to start electron app: ${error.message}`);
            resolve({ success: false, error: error.message });
        });

        // Timeout after 10 minutes
        setTimeout(() => {
            child.kill();
            resolve({ success: false, error: 'Download timeout (10 minutes)' });
        }, 600000);
    });
}

async function extractPagesForValidation(pdfPath, manuscriptName) {
    return new Promise((resolve) => {
        const outputDir = path.dirname(pdfPath);
        const baseName = path.basename(pdfPath, '.pdf');
        
        console.log(`🔍 Extracting pages for validation...`);
        
        // Extract first 3 pages as images for validation
        const pdfImagesCmd = spawn('pdfimages', [
            '-png',
            '-f', '1',
            '-l', '3',
            pdfPath,
            path.join(outputDir, `${baseName}_page`)
        ]);

        pdfImagesCmd.on('close', (code) => {
            if (code === 0) {
                console.log('📸 Page extraction completed');
            } else {
                console.log('⚠️  Page extraction failed, but PDF is still valid');
            }
            resolve();
        });

        pdfImagesCmd.on('error', (error) => {
            console.log('⚠️  pdfimages not available, skipping page extraction');
            resolve();
        });
    });
}

// Run the validation
runDiammValidation().catch(console.error);