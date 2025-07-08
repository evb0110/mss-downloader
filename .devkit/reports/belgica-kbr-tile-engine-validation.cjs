const { TileEngineService } = require('../../src/main/services/tile-engine/TileEngineService');
const { BelgicaKbrAdapter } = require('../../src/main/services/tile-engine/adapters/BelgicaKbrAdapter');
const { TileEngineCore } = require('../../src/main/services/tile-engine/TileEngineCore');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function validateBelgicaKbrTileEngine() {
    console.log('🔍 BELGICA KBR TILE ENGINE VALIDATION');
    console.log('=====================================');
    
    const testUrl = 'https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/zoomtiles/BE-KBR00_A-1589485_0000-00-00_00_0001/';
    const outputDir = '.devkit/reports/belgica-kbr-tile-validation';
    const outputFile = path.join(outputDir, 'belgica-kbr-complete-page.jpg');
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const results = {
        timestamp: new Date().toISOString(),
        testUrl,
        phases: {},
        errors: [],
        success: false,
        metrics: {}
    };
    
    try {
        // Phase 1: Test BelgicaKbrAdapter directly
        console.log('\n📋 Phase 1: Testing BelgicaKbrAdapter');
        const adapter = new BelgicaKbrAdapter();
        
        // Test URL validation
        const isValidUrl = await adapter.validateUrl(testUrl);
        console.log(`✓ URL validation: ${isValidUrl ? 'PASSED' : 'FAILED'}`);
        results.phases.urlValidation = { success: isValidUrl };
        
        if (!isValidUrl) {
            throw new Error('URL validation failed');
        }
        
        // Test manuscript page analysis
        const gridConfig = await adapter.analyzeManuscriptPage(testUrl);
        console.log(`✓ Grid analysis: ${gridConfig.gridWidth}x${gridConfig.gridHeight} tiles at zoom ${gridConfig.zoomLevel}`);
        results.phases.gridAnalysis = { 
            success: true, 
            gridConfig: {
                gridWidth: gridConfig.gridWidth,
                gridHeight: gridConfig.gridHeight,
                zoomLevel: gridConfig.zoomLevel,
                tileWidth: gridConfig.tileWidth,
                tileHeight: gridConfig.tileHeight,
                totalTiles: gridConfig.gridWidth * gridConfig.gridHeight
            }
        };
        
        // Test tile URL generation
        const tileUrls = await adapter.generateTileUrls(testUrl, gridConfig);
        console.log(`✓ Tile URL generation: ${tileUrls.length} URLs generated`);
        results.phases.tileUrlGeneration = { 
            success: true, 
            totalUrls: tileUrls.length,
            sampleUrls: tileUrls.slice(0, 5)
        };
        
        // Test authentication config
        const authConfig = await adapter.getAuthConfig(testUrl);
        console.log(`✓ Authentication config: ${authConfig.type} with referrer: ${authConfig.referrer}`);
        results.phases.authConfig = { 
            success: true, 
            authType: authConfig.type,
            referrer: authConfig.referrer
        };
        
        // Phase 2: Test TileEngineService
        console.log('\n⚙️ Phase 2: Testing TileEngineService');
        const tileEngineService = new TileEngineService();
        
        // Test adapter detection
        const detectedAdapter = await tileEngineService.detectAdapter(testUrl);
        console.log(`✓ Adapter detection: ${detectedAdapter ? detectedAdapter.name : 'FAILED'}`);
        results.phases.adapterDetection = { 
            success: !!detectedAdapter,
            adapterName: detectedAdapter?.name
        };
        
        // Test URL analysis
        const analysis = await tileEngineService.analyzeUrl(testUrl);
        console.log(`✓ URL analysis: ${analysis.estimatedTiles} tiles, ~${Math.round(analysis.estimatedSize / 1024 / 1024)}MB`);
        results.phases.urlAnalysis = { 
            success: true,
            estimatedTiles: analysis.estimatedTiles,
            estimatedSizeMB: Math.round(analysis.estimatedSize / 1024 / 1024),
            estimatedTimeSeconds: analysis.estimatedTime
        };
        
        // Test tile system validation
        const validation = await tileEngineService.validateTileSystem(testUrl);
        console.log(`✓ Tile system validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`);
        if (validation.warnings.length > 0) {
            console.log(`⚠️ Warnings: ${validation.warnings.join(', ')}`);
        }
        results.phases.systemValidation = { 
            success: validation.isValid,
            warnings: validation.warnings,
            errors: validation.errors
        };
        
        // Phase 3: Test actual tile download and stitching
        console.log('\n🔄 Phase 3: Testing tile download and stitching');
        
        const startTime = Date.now();
        let progressUpdates = 0;
        let lastPercentage = 0;
        
        const progressCallback = (progress) => {
            if (progress.percentage > lastPercentage + 10) {
                console.log(`📊 Progress: ${Math.round(progress.percentage)}% (${progress.downloadedTiles}/${progress.totalTiles} tiles)`);
                lastPercentage = progress.percentage;
                progressUpdates++;
            }
        };
        
        const statusCallback = (status) => {
            console.log(`📢 Status: ${status.phase} - ${status.message}`);
        };
        
        const downloadResult = await tileEngineService.downloadWithProgressIntegration(
            testUrl,
            outputFile,
            progressCallback,
            statusCallback
        );
        
        const downloadTime = Date.now() - startTime;
        
        console.log(`✓ Download completed in ${Math.round(downloadTime / 1000)}s`);
        console.log(`✓ Downloaded ${downloadResult.downloadedTiles}/${downloadResult.totalTiles} tiles`);
        console.log(`✓ Failed tiles: ${downloadResult.failedTiles.length}`);
        console.log(`✓ Output file: ${downloadResult.outputPath}`);
        
        results.phases.tileDownload = {
            success: downloadResult.success,
            downloadedTiles: downloadResult.downloadedTiles,
            totalTiles: downloadResult.totalTiles,
            failedTiles: downloadResult.failedTiles.length,
            downloadTimeSeconds: Math.round(downloadTime / 1000),
            outputPath: downloadResult.outputPath,
            progressUpdates
        };
        
        // Phase 4: Validate output file
        console.log('\n🔍 Phase 4: Validating output file');
        
        if (fs.existsSync(outputFile)) {
            const stats = fs.statSync(outputFile);
            const fileSizeMB = Math.round(stats.size / 1024 / 1024 * 100) / 100;
            console.log(`✓ Output file exists: ${fileSizeMB}MB`);
            
            // Test file dimensions using ImageMagick
            const dimensionResult = await new Promise((resolve) => {
                exec(`identify -format "%wx%h" "${outputFile}"`, (error, stdout) => {
                    if (error) {
                        resolve({ error: error.message });
                    } else {
                        const dimensions = stdout.trim().split('x');
                        resolve({ 
                            width: parseInt(dimensions[0]), 
                            height: parseInt(dimensions[1]) 
                        });
                    }
                });
            });
            
            if (dimensionResult.error) {
                console.log(`⚠️ Could not determine dimensions: ${dimensionResult.error}`);
            } else {
                console.log(`✓ Image dimensions: ${dimensionResult.width}x${dimensionResult.height}px`);
                
                // Expected dimensions for 8x10 tiles at 768px each
                const expectedWidth = 8 * 768;
                const expectedHeight = 10 * 768;
                
                const dimensionsMatch = dimensionResult.width === expectedWidth && 
                                      dimensionResult.height === expectedHeight;
                
                console.log(`✓ Dimensions match expected: ${dimensionsMatch ? 'YES' : 'NO'}`);
                console.log(`  Expected: ${expectedWidth}x${expectedHeight}px`);
                console.log(`  Actual: ${dimensionResult.width}x${dimensionResult.height}px`);
            }
            
            results.phases.outputValidation = {
                success: true,
                fileExists: true,
                fileSizeMB,
                dimensions: dimensionResult.error ? null : dimensionResult,
                dimensionsMatch: dimensionResult.error ? false : 
                    (dimensionResult.width === 8 * 768 && dimensionResult.height === 10 * 768)
            };
        } else {
            console.log(`❌ Output file not found: ${outputFile}`);
            results.phases.outputValidation = { success: false, fileExists: false };
        }
        
        // Phase 5: Create PDF test
        console.log('\n📄 Phase 5: Testing PDF creation');
        
        if (fs.existsSync(outputFile)) {
            const pdfFile = path.join(outputDir, 'belgica-kbr-test.pdf');
            
            const pdfResult = await new Promise((resolve) => {
                exec(`magick "${outputFile}" -quality 95 "${pdfFile}"`, (error, stdout, stderr) => {
                    if (error) {
                        resolve({ success: false, error: error.message });
                    } else {
                        resolve({ success: true, pdfPath: pdfFile });
                    }
                });
            });
            
            if (pdfResult.success) {
                const pdfStats = fs.statSync(pdfFile);
                const pdfSizeMB = Math.round(pdfStats.size / 1024 / 1024 * 100) / 100;
                console.log(`✓ PDF created successfully: ${pdfSizeMB}MB`);
                
                results.phases.pdfCreation = {
                    success: true,
                    pdfPath: pdfFile,
                    pdfSizeMB
                };
            } else {
                console.log(`❌ PDF creation failed: ${pdfResult.error}`);
                results.phases.pdfCreation = { success: false, error: pdfResult.error };
            }
        } else {
            console.log(`❌ Cannot create PDF: source image not found`);
            results.phases.pdfCreation = { success: false, error: 'Source image not found' };
        }
        
        // Calculate overall success
        const allPhasesSuccessful = Object.values(results.phases).every(phase => phase.success);
        results.success = allPhasesSuccessful;
        
        console.log('\n🎯 VALIDATION SUMMARY');
        console.log('====================');
        console.log(`Overall Success: ${results.success ? '✅ PASSED' : '❌ FAILED'}`);
        
        Object.entries(results.phases).forEach(([phase, data]) => {
            console.log(`${phase}: ${data.success ? '✅' : '❌'}`);
        });
        
        if (results.success) {
            console.log('\n🎉 Belgica KBR Tile Engine is working correctly!');
            console.log(`📊 Performance: ${results.phases.tileDownload.downloadTimeSeconds}s for ${results.phases.tileDownload.totalTiles} tiles`);
            console.log(`📁 Output: ${results.phases.outputValidation.fileSizeMB}MB image file`);
            console.log(`📄 PDF: ${results.phases.pdfCreation.pdfSizeMB}MB PDF file`);
        } else {
            console.log('\n❌ Validation failed. Check individual phase results above.');
        }
        
    } catch (error) {
        console.error(`\n💥 Validation error: ${error.message}`);
        results.errors.push(error.message);
        results.success = false;
    }
    
    // Save results
    const resultsFile = path.join(outputDir, 'validation-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n📊 Detailed results saved to: ${resultsFile}`);
    
    return results;
}

// Run validation if called directly
if (require.main === module) {
    validateBelgicaKbrTileEngine().catch(console.error);
}

module.exports = { validateBelgicaKbrTileEngine };