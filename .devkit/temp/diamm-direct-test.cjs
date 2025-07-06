const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService.js');
const { EnhancedPdfMerger } = require('../../dist/main/services/EnhancedPdfMerger.js');
const { ElectronImageCache } = require('../../dist/main/services/ElectronImageCache.js');
const { ManifestCache } = require('../../dist/main/services/ManifestCache.js');
const { LibraryOptimizationService } = require('../../dist/main/services/LibraryOptimizationService.js');
const path = require('path');
const fs = require('fs');

async function testDiammDirectly() {
    console.log('🎼 Testing DIAMM Implementation Directly...\n');

    // Test manuscripts for validation
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
        }
    ];

    // Create validation directory
    const validationDir = path.join(__dirname, '../../CURRENT-VALIDATION');
    if (fs.existsSync(validationDir)) {
        fs.rmSync(validationDir, { recursive: true, force: true });
    }
    fs.mkdirSync(validationDir, { recursive: true });

    console.log(`📁 Validation directory: ${validationDir}\n`);

    // Initialize services
    const cacheDir = path.join(__dirname, '../../cache');
    const imageCache = new ElectronImageCache(cacheDir);
    const manifestCache = new ManifestCache(cacheDir);
    const pdfMerger = new EnhancedPdfMerger(cacheDir);
    const optimizationService = new LibraryOptimizationService();

    const manuscriptService = new EnhancedManuscriptDownloaderService(
        imageCache,
        manifestCache,
        pdfMerger,
        optimizationService
    );

    // Test each manuscript
    for (const manuscript of testManuscripts) {
        console.log(`📜 Testing: ${manuscript.name}`);
        console.log(`📝 Description: ${manuscript.description}`);
        console.log(`🔗 URL: ${manuscript.url}`);

        try {
            // 1. Test library detection
            console.log('🔍 Testing library detection...');
            const detectedLibrary = manuscriptService.detectLibrary(manuscript.url);
            console.log(`📚 Detected library: ${detectedLibrary}`);

            if (detectedLibrary !== 'diamm') {
                console.log(`❌ Library detection failed! Expected 'diamm', got '${detectedLibrary}'`);
                continue;
            }

            // 2. Test manifest loading
            console.log('📋 Testing manifest loading...');
            const manifest = await manuscriptService.loadManifest(manuscript.url);
            console.log(`📄 Manifest loaded: ${manifest.totalPages} pages`);
            console.log(`🏷️  Library: ${manifest.library}`);
            console.log(`🎯 Display name: ${manifest.displayName}`);

            // 3. Test image URL extraction (first 3 pages)
            console.log('🖼️  Testing image URL extraction...');
            const testPages = manifest.pageLinks.slice(0, 3);
            console.log(`📸 Testing ${testPages.length} pages:`);
            
            for (let i = 0; i < testPages.length; i++) {
                console.log(`  Page ${i + 1}: ${testPages[i]}`);
            }

            // 4. Test PDF generation with limited pages
            console.log('📄 Testing PDF generation...');
            const outputPath = path.join(validationDir, `${manuscript.name}.pdf`);
            
            // Create a limited manifest for testing (first 3 pages)
            const limitedManifest = {
                ...manifest,
                pageLinks: testPages,
                totalPages: testPages.length
            };

            const result = await manuscriptService.downloadManuscript(
                manuscript.url,
                outputPath,
                limitedManifest
            );

            if (result.success) {
                console.log(`✅ PDF generated successfully: ${path.basename(outputPath)}`);
                
                // Get file size
                const stats = fs.statSync(outputPath);
                const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                console.log(`📏 File size: ${fileSizeMB} MB`);

                // Extract pages for validation
                await extractPagesForValidation(outputPath, manuscript.name);
                
            } else {
                console.log(`❌ PDF generation failed: ${result.error}`);
            }

        } catch (error) {
            console.log(`❌ Error testing ${manuscript.name}: ${error.message}`);
            console.log(`Stack: ${error.stack}`);
        }

        console.log('─'.repeat(60));
    }

    console.log('\n🎯 DIAMM Direct Test Complete!');
    console.log(`📂 Validation files saved to: ${validationDir}`);
}

async function extractPagesForValidation(pdfPath, manuscriptName) {
    return new Promise((resolve) => {
        const outputDir = path.dirname(pdfPath);
        const baseName = path.basename(pdfPath, '.pdf');
        
        console.log(`🔍 Extracting pages for validation...`);
        
        const { spawn } = require('child_process');
        
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

// Run the test
testDiammDirectly().catch((error) => {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
});