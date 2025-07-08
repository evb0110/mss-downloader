const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuration based on discovery results
const CONFIG = {
    maxZoom: 3,
    maxResolution: { width: 6144, height: 7680 },
    tileSize: { width: 768, height: 768 },
    gridSize: { width: 8, height: 10 },
    totalTiles: 80,
    baseUrl: 'https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/zoomtiles/BE-KBR00_A-1589485_0000-00-00_00_0001/',
    referrer: 'https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/',
    testDir: '.devkit/reports/belgica-implementation-test/'
};

// Ensure test directory exists
if (!fs.existsSync(CONFIG.testDir)) {
    fs.mkdirSync(CONFIG.testDir, { recursive: true });
}

// Download a single tile with proper authentication
function downloadTile(x, y, zoom = CONFIG.maxZoom) {
    return new Promise((resolve, reject) => {
        const url = `${CONFIG.baseUrl}${zoom}-${x}-${y}.jpg`;
        const filename = path.join(CONFIG.testDir, `tile-${zoom}-${x}-${y}.jpg`);
        
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': CONFIG.referrer,
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: 15000
        }, (res) => {
            if (res.statusCode === 200) {
                const fileStream = fs.createWriteStream(filename);
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    const stats = fs.statSync(filename);
                    resolve({ 
                        success: true, 
                        x, y, zoom,
                        filename,
                        size: stats.size,
                        url
                    });
                });
            } else {
                resolve({ 
                    success: false, 
                    x, y, zoom,
                    error: `HTTP ${res.statusCode}`,
                    url
                });
            }
        });
        
        req.on('error', (err) => {
            resolve({ success: false, x, y, zoom, error: err.message, url });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, x, y, zoom, error: 'Request timeout', url });
        });
    });
}

// Download all tiles for the maximum zoom level
async function downloadAllTiles() {
    console.log('🔄 DOWNLOADING ALL TILES AT MAXIMUM ZOOM');
    console.log(`Grid size: ${CONFIG.gridSize.width}x${CONFIG.gridSize.height} = ${CONFIG.totalTiles} tiles`);
    console.log(`Target resolution: ${CONFIG.maxResolution.width}x${CONFIG.maxResolution.height}px`);
    
    const results = [];
    const batchSize = 5; // Download 5 tiles at a time to be respectful
    
    for (let y = 0; y < CONFIG.gridSize.height; y++) {
        for (let x = 0; x < CONFIG.gridSize.width; x += batchSize) {
            const batch = [];
            
            // Create batch of downloads
            for (let i = 0; i < batchSize && (x + i) < CONFIG.gridSize.width; i++) {
                batch.push(downloadTile(x + i, y));
            }
            
            // Download batch
            const batchResults = await Promise.all(batch);
            results.push(...batchResults);
            
            // Progress report
            const successful = batchResults.filter(r => r.success).length;
            const failed = batchResults.filter(r => !r.success).length;
            console.log(`Row ${y}, Tiles ${x}-${Math.min(x + batchSize - 1, CONFIG.gridSize.width - 1)}: ${successful} success, ${failed} failed`);
            
            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    const totalSuccessful = results.filter(r => r.success).length;
    const totalFailed = results.filter(r => !r.success).length;
    
    console.log(`\n📊 DOWNLOAD SUMMARY:`);
    console.log(`✓ Successful: ${totalSuccessful}/${CONFIG.totalTiles}`);
    console.log(`✗ Failed: ${totalFailed}/${CONFIG.totalTiles}`);
    
    return results;
}

// Stitch tiles into complete image using ImageMagick
async function stitchTiles(downloadResults) {
    console.log('\n🔧 STITCHING TILES INTO COMPLETE IMAGE');
    
    const successfulTiles = downloadResults.filter(r => r.success);
    
    if (successfulTiles.length === 0) {
        throw new Error('No tiles available for stitching');
    }
    
    // Create montage command for ImageMagick
    const outputFile = path.join(CONFIG.testDir, 'belgica-complete-page.jpg');
    const tileFiles = [];
    
    // Build the tile matrix in correct order
    for (let y = 0; y < CONFIG.gridSize.height; y++) {
        for (let x = 0; x < CONFIG.gridSize.width; x++) {
            const tile = successfulTiles.find(t => t.x === x && t.y === y);
            if (tile) {
                tileFiles.push(tile.filename);
            } else {
                // Create placeholder for missing tiles
                const placeholderFile = path.join(CONFIG.testDir, `placeholder-${x}-${y}.jpg`);
                await createPlaceholderTile(placeholderFile);
                tileFiles.push(placeholderFile);
            }
        }
    }
    
    // ImageMagick montage command
    const montageCmd = `montage ${tileFiles.map(f => `"${f}"`).join(' ')} -tile ${CONFIG.gridSize.width}x${CONFIG.gridSize.height} -geometry ${CONFIG.tileSize.width}x${CONFIG.tileSize.height}+0+0 "${outputFile}"`;
    
    console.log('Running ImageMagick montage...');
    
    return new Promise((resolve, reject) => {
        exec(montageCmd, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ ImageMagick montage failed:', error.message);
                reject(error);
            } else {
                console.log(`✅ Complete image created: ${outputFile}`);
                const stats = fs.statSync(outputFile);
                resolve({
                    success: true,
                    outputFile,
                    size: stats.size,
                    resolution: CONFIG.maxResolution
                });
            }
        });
    });
}

// Create placeholder tile for missing tiles
async function createPlaceholderTile(filename) {
    return new Promise((resolve, reject) => {
        const cmd = `convert -size ${CONFIG.tileSize.width}x${CONFIG.tileSize.height} xc:lightgray -gravity center -pointsize 24 -annotate +0+0 "Missing\\nTile" "${filename}"`;
        exec(cmd, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

// Test image quality and dimensions
async function validateOutput(outputFile) {
    console.log('\n🔍 VALIDATING OUTPUT IMAGE');
    
    return new Promise((resolve, reject) => {
        const cmd = `identify -ping -format "%w %h %m %[colorspace] %[bit-depth]" "${outputFile}"`;
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                const [width, height, format, colorspace, bitDepth] = stdout.trim().split(' ');
                const validation = {
                    width: parseInt(width),
                    height: parseInt(height),
                    format,
                    colorspace,
                    bitDepth: parseInt(bitDepth),
                    expectedWidth: CONFIG.maxResolution.width,
                    expectedHeight: CONFIG.maxResolution.height,
                    dimensionsMatch: parseInt(width) === CONFIG.maxResolution.width && parseInt(height) === CONFIG.maxResolution.height
                };
                
                console.log(`Image dimensions: ${width}x${height}px`);
                console.log(`Expected dimensions: ${CONFIG.maxResolution.width}x${CONFIG.maxResolution.height}px`);
                console.log(`Dimensions match: ${validation.dimensionsMatch ? '✅' : '❌'}`);
                console.log(`Format: ${format}, Colorspace: ${colorspace}, Bit depth: ${bitDepth}`);
                
                resolve(validation);
            }
        });
    });
}

// Generate PDF from the complete image
async function generatePDF(imageFile) {
    console.log('\n📄 GENERATING PDF FROM COMPLETE IMAGE');
    
    const pdfFile = path.join(CONFIG.testDir, 'belgica-manuscript-page.pdf');
    
    return new Promise((resolve, reject) => {
        const cmd = `convert "${imageFile}" -quality 95 -density 300 "${pdfFile}"`;
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ PDF generation failed:', error.message);
                reject(error);
            } else {
                console.log(`✅ PDF created: ${pdfFile}`);
                const stats = fs.statSync(pdfFile);
                resolve({
                    success: true,
                    pdfFile,
                    size: stats.size
                });
            }
        });
    });
}

// Main implementation test
async function testBelgicaImplementation() {
    console.log('🧪 BELGICA KBR ZOOMTILES IMPLEMENTATION TEST');
    console.log('==========================================');
    
    const testResults = {
        timestamp: new Date().toISOString(),
        config: CONFIG,
        phases: {}
    };
    
    try {
        // Phase 1: Download all tiles
        console.log('\n📥 PHASE 1: TILE DOWNLOADING');
        const downloadResults = await downloadAllTiles();
        testResults.phases.download = {
            success: true,
            totalTiles: downloadResults.length,
            successfulTiles: downloadResults.filter(r => r.success).length,
            failedTiles: downloadResults.filter(r => !r.success).length,
            results: downloadResults
        };
        
        // Phase 2: Stitch tiles into complete image
        console.log('\n🔧 PHASE 2: TILE STITCHING');
        const stitchResult = await stitchTiles(downloadResults);
        testResults.phases.stitch = stitchResult;
        
        // Phase 3: Validate output
        console.log('\n✅ PHASE 3: OUTPUT VALIDATION');
        const validation = await validateOutput(stitchResult.outputFile);
        testResults.phases.validation = validation;
        
        // Phase 4: Generate PDF
        console.log('\n📄 PHASE 4: PDF GENERATION');
        const pdfResult = await generatePDF(stitchResult.outputFile);
        testResults.phases.pdf = pdfResult;
        
        // Save test results
        const resultsFile = path.join(CONFIG.testDir, 'implementation-test-results.json');
        fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
        
        console.log('\n🎉 IMPLEMENTATION TEST COMPLETED SUCCESSFULLY!');
        console.log('============================================');
        console.log(`📊 Results saved to: ${resultsFile}`);
        console.log(`🖼️  Complete image: ${stitchResult.outputFile}`);
        console.log(`📄 PDF document: ${pdfResult.pdfFile}`);
        console.log(`📁 All files in: ${CONFIG.testDir}`);
        
        return testResults;
        
    } catch (error) {
        console.error('❌ Implementation test failed:', error);
        testResults.error = error.message;
        throw error;
    }
}

// Run the test
if (require.main === module) {
    testBelgicaImplementation().catch(console.error);
}

module.exports = { testBelgicaImplementation, CONFIG };