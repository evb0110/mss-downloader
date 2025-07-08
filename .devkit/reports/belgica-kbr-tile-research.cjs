const https = require('https');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = 'https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/zoomtiles/BE-KBR00_A-1589485_0000-00-00_00_0001/';
const TEST_DIR = '.devkit/reports/belgica-tiles-samples/';
const MAX_ZOOM_TEST = 10;
const MAX_GRID_TEST = 20;

// Ensure test directory exists
if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
}

// HTTP request function with better error handling
function downloadTile(url, filename) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site'
            },
            timeout: 10000
        }, (res) => {
            if (res.statusCode === 200) {
                const fileStream = fs.createWriteStream(filename);
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    const stats = fs.statSync(filename);
                    resolve({ 
                        success: true, 
                        statusCode: res.statusCode, 
                        contentType: res.headers['content-type'],
                        size: stats.size,
                        headers: res.headers
                    });
                });
            } else {
                resolve({ 
                    success: false, 
                    statusCode: res.statusCode, 
                    error: `HTTP ${res.statusCode}`,
                    headers: res.headers
                });
            }
        });
        
        req.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });
    });
}

// Test zoom levels to find maximum available
async function testZoomLevels() {
    console.log('\n=== TESTING ZOOM LEVELS ===');
    const zoomResults = [];
    
    for (let zoom = 0; zoom <= MAX_ZOOM_TEST; zoom++) {
        const url = `${BASE_URL}${zoom}-0-0.jpg`;
        const filename = path.join(TEST_DIR, `zoom-${zoom}-0-0.jpg`);
        
        console.log(`Testing zoom level ${zoom}...`);
        const result = await downloadTile(url, filename);
        
        zoomResults.push({
            zoom,
            url,
            ...result
        });
        
        if (result.success) {
            console.log(`✓ Zoom ${zoom}: ${result.size} bytes, ${result.contentType}`);
        } else {
            console.log(`✗ Zoom ${zoom}: ${result.error || result.statusCode}`);
        }
        
        // Small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return zoomResults;
}

// Test tile grid dimensions for a specific zoom level
async function testTileGrid(zoom) {
    console.log(`\n=== TESTING TILE GRID FOR ZOOM ${zoom} ===`);
    const gridResults = [];
    
    // Test grid dimensions
    for (let x = 0; x < MAX_GRID_TEST; x++) {
        for (let y = 0; y < MAX_GRID_TEST; y++) {
            const url = `${BASE_URL}${zoom}-${x}-${y}.jpg`;
            const filename = path.join(TEST_DIR, `grid-${zoom}-${x}-${y}.jpg`);
            
            const result = await downloadTile(url, filename);
            gridResults.push({
                zoom, x, y, url, ...result
            });
            
            if (result.success) {
                console.log(`✓ Tile ${zoom}-${x}-${y}: ${result.size} bytes`);
            } else {
                // Only log first few failures to avoid spam
                if (x < 3 && y < 3) {
                    console.log(`✗ Tile ${zoom}-${x}-${y}: ${result.error || result.statusCode}`);
                }
            }
            
            // If we get 404s for early coordinates, likely no more tiles
            if (!result.success && result.statusCode === 404 && x === 0 && y === 0) {
                console.log(`No tiles found at zoom ${zoom}, stopping grid test`);
                return gridResults;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    return gridResults;
}

// Analyze tile patterns and determine grid structure
function analyzeGridStructure(gridResults) {
    console.log('\n=== ANALYZING GRID STRUCTURE ===');
    
    const successfulTiles = gridResults.filter(r => r.success);
    
    if (successfulTiles.length === 0) {
        console.log('No successful tiles found');
        return { maxX: 0, maxY: 0, totalTiles: 0 };
    }
    
    const maxX = Math.max(...successfulTiles.map(t => t.x));
    const maxY = Math.max(...successfulTiles.map(t => t.y));
    const totalTiles = successfulTiles.length;
    
    console.log(`Grid dimensions: ${maxX + 1} x ${maxY + 1} (${totalTiles} tiles)`);
    console.log(`X range: 0 to ${maxX}`);
    console.log(`Y range: 0 to ${maxY}`);
    
    // Analyze tile sizes
    const tileSizes = successfulTiles.map(t => t.size);
    const avgSize = tileSizes.reduce((a, b) => a + b, 0) / tileSizes.length;
    const minSize = Math.min(...tileSizes);
    const maxSize = Math.max(...tileSizes);
    
    console.log(`Tile sizes: avg=${Math.round(avgSize)}, min=${minSize}, max=${maxSize} bytes`);
    
    return { maxX, maxY, totalTiles, avgSize, minSize, maxSize };
}

// Test authentication requirements
async function testAuthRequirements() {
    console.log('\n=== TESTING AUTHENTICATION REQUIREMENTS ===');
    
    const testUrl = `${BASE_URL}0-0-0.jpg`;
    
    // Test without headers
    console.log('Testing without headers...');
    const noHeadersResult = await downloadTile(testUrl, path.join(TEST_DIR, 'auth-test-no-headers.jpg'));
    
    // Test with minimal headers
    console.log('Testing with minimal headers...');
    const minimalResult = await downloadTile(testUrl, path.join(TEST_DIR, 'auth-test-minimal.jpg'));
    
    return {
        noHeaders: noHeadersResult,
        minimal: minimalResult
    };
}

// Main research function
async function researchBelgicaTileSystem() {
    console.log('🔍 BELGICA KBR ZOOMTILES SYSTEM RESEARCH');
    console.log('========================================');
    
    const research = {
        timestamp: new Date().toISOString(),
        baseUrl: BASE_URL,
        testDirectory: TEST_DIR
    };
    
    try {
        // Test zoom levels
        research.zoomLevels = await testZoomLevels();
        
        // Find the highest working zoom level
        const workingZooms = research.zoomLevels.filter(z => z.success);
        const maxWorkingZoom = Math.max(...workingZooms.map(z => z.zoom));
        
        console.log(`\n📊 Maximum working zoom level: ${maxWorkingZoom}`);
        
        // Test grid structure for the highest zoom (highest resolution)
        if (maxWorkingZoom >= 0) {
            research.gridStructure = await testTileGrid(maxWorkingZoom);
            research.gridAnalysis = analyzeGridStructure(research.gridStructure);
            
            // Also test lower zoom levels for comparison
            if (maxWorkingZoom > 0) {
                research.lowerZoomGrid = await testTileGrid(0);
                research.lowerZoomAnalysis = analyzeGridStructure(research.lowerZoomGrid);
            }
        }
        
        // Test authentication
        research.authTests = await testAuthRequirements();
        
        // Save research results
        const resultsFile = path.join(TEST_DIR, 'research-results.json');
        fs.writeFileSync(resultsFile, JSON.stringify(research, null, 2));
        
        console.log('\n✅ RESEARCH COMPLETE');
        console.log(`Results saved to: ${resultsFile}`);
        console.log(`Sample tiles saved to: ${TEST_DIR}`);
        
        return research;
        
    } catch (error) {
        console.error('❌ Research failed:', error);
        throw error;
    }
}

// Run the research
if (require.main === module) {
    researchBelgicaTileSystem().catch(console.error);
}

module.exports = { researchBelgicaTileSystem };