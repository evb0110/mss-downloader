const https = require('https');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = 'https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/zoomtiles/BE-KBR00_A-1589485_0000-00-00_00_0001/';
const REFERRER = 'https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/';
const TEST_DIR = '.devkit/reports/belgica-tiles-samples/';
const MAX_ZOOM_TEST = 15;
const MAX_GRID_TEST = 50;

// Ensure test directory exists
if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
}

// HTTP request function with proper KBR referrer
function downloadTileWithAuth(url, filename) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': REFERRER,
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
async function discoverZoomLevels() {
    console.log('\n=== DISCOVERING ZOOM LEVELS ===');
    const zoomResults = [];
    
    for (let zoom = 0; zoom <= MAX_ZOOM_TEST; zoom++) {
        const url = `${BASE_URL}${zoom}-0-0.jpg`;
        const filename = path.join(TEST_DIR, `zoom-${zoom}-0-0.jpg`);
        
        console.log(`Testing zoom level ${zoom}...`);
        const result = await downloadTileWithAuth(url, filename);
        
        zoomResults.push({
            zoom,
            url,
            ...result
        });
        
        if (result.success) {
            console.log(`✓ Zoom ${zoom}: ${result.size} bytes, ${result.contentType}`);
        } else {
            console.log(`✗ Zoom ${zoom}: ${result.error || result.statusCode}`);
            // Stop testing if we get 404s - no higher zoom levels
            if (result.statusCode === 404) {
                console.log(`No more zoom levels available beyond ${zoom - 1}`);
                break;
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return zoomResults;
}

// Test tile grid dimensions for a specific zoom level
async function mapTileGrid(zoom) {
    console.log(`\n=== MAPPING TILE GRID FOR ZOOM ${zoom} ===`);
    const gridResults = [];
    
    // Test grid dimensions systematically
    let maxFoundX = -1;
    let maxFoundY = -1;
    
    // First, find the bounds by testing expanding squares
    for (let size = 1; size <= MAX_GRID_TEST; size++) {
        let foundNew = false;
        
        // Test right edge
        for (let y = 0; y < size; y++) {
            const x = size - 1;
            const url = `${BASE_URL}${zoom}-${x}-${y}.jpg`;
            const filename = path.join(TEST_DIR, `grid-${zoom}-${x}-${y}.jpg`);
            
            const result = await downloadTileWithAuth(url, filename);
            gridResults.push({ zoom, x, y, url, ...result });
            
            if (result.success) {
                console.log(`✓ Tile ${zoom}-${x}-${y}: ${result.size} bytes`);
                maxFoundX = Math.max(maxFoundX, x);
                maxFoundY = Math.max(maxFoundY, y);
                foundNew = true;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Test bottom edge
        for (let x = 0; x < size - 1; x++) {
            const y = size - 1;
            const url = `${BASE_URL}${zoom}-${x}-${y}.jpg`;
            const filename = path.join(TEST_DIR, `grid-${zoom}-${x}-${y}.jpg`);
            
            const result = await downloadTileWithAuth(url, filename);
            gridResults.push({ zoom, x, y, url, ...result });
            
            if (result.success) {
                console.log(`✓ Tile ${zoom}-${x}-${y}: ${result.size} bytes`);
                maxFoundX = Math.max(maxFoundX, x);
                maxFoundY = Math.max(maxFoundY, y);
                foundNew = true;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (!foundNew) {
            console.log(`No new tiles found at grid size ${size}, stopping expansion`);
            break;
        }
    }
    
    console.log(`Grid bounds discovered: X: 0-${maxFoundX}, Y: 0-${maxFoundY}`);
    return gridResults;
}

// Get image dimensions using ImageMagick identify if available
async function getImageDimensions(filepath) {
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        exec(`identify -ping -format "%w %h" "${filepath}"`, (error, stdout) => {
            if (error) {
                resolve({ width: null, height: null, error: error.message });
            } else {
                const [width, height] = stdout.trim().split(' ').map(Number);
                resolve({ width, height });
            }
        });
    });
}

// Analyze tile structure and calculate full image dimensions
async function analyzeTileStructure(zoomResults, gridResults) {
    console.log('\n=== ANALYZING TILE STRUCTURE ===');
    
    const workingZooms = zoomResults.filter(z => z.success);
    const maxZoom = Math.max(...workingZooms.map(z => z.zoom));
    
    console.log(`Maximum zoom level: ${maxZoom}`);
    
    // Group grid results by zoom level
    const gridByZoom = {};
    gridResults.forEach(result => {
        if (!gridByZoom[result.zoom]) {
            gridByZoom[result.zoom] = [];
        }
        gridByZoom[result.zoom].push(result);
    });
    
    const analysis = {
        maxZoom,
        zoomLevels: {}
    };
    
    for (const zoom of Object.keys(gridByZoom)) {
        const zoomInt = parseInt(zoom);
        const tiles = gridByZoom[zoom].filter(t => t.success);
        
        if (tiles.length > 0) {
            const maxX = Math.max(...tiles.map(t => t.x));
            const maxY = Math.max(...tiles.map(t => t.y));
            const gridWidth = maxX + 1;
            const gridHeight = maxY + 1;
            
            // Get dimensions of a sample tile
            const sampleTile = tiles[0];
            const samplePath = path.join(TEST_DIR, `grid-${zoom}-${sampleTile.x}-${sampleTile.y}.jpg`);
            const dimensions = await getImageDimensions(samplePath);
            
            analysis.zoomLevels[zoomInt] = {
                gridWidth,
                gridHeight,
                totalTiles: tiles.length,
                tileWidth: dimensions.width,
                tileHeight: dimensions.height,
                estimatedFullWidth: dimensions.width * gridWidth,
                estimatedFullHeight: dimensions.height * gridHeight,
                avgTileSize: Math.round(tiles.reduce((sum, t) => sum + t.size, 0) / tiles.length),
                tiles: tiles.map(t => ({ x: t.x, y: t.y, size: t.size }))
            };
            
            console.log(`Zoom ${zoom}: ${gridWidth}x${gridHeight} grid, ${tiles.length} tiles`);
            if (dimensions.width && dimensions.height) {
                console.log(`  Tile size: ${dimensions.width}x${dimensions.height}px`);
                console.log(`  Estimated full image: ${dimensions.width * gridWidth}x${dimensions.height * gridHeight}px`);
            }
        }
    }
    
    return analysis;
}

// Create tile download methodology
function createTileDownloadMethod(analysis) {
    console.log('\n=== CREATING DOWNLOAD METHODOLOGY ===');
    
    const maxZoom = analysis.maxZoom;
    const maxZoomData = analysis.zoomLevels[maxZoom];
    
    if (!maxZoomData) {
        console.log('No data available for maximum zoom level');
        return null;
    }
    
    const methodology = {
        maxZoom,
        maxResolution: {
            width: maxZoomData.estimatedFullWidth,
            height: maxZoomData.estimatedFullHeight
        },
        tileSize: {
            width: maxZoomData.tileWidth,
            height: maxZoomData.tileHeight
        },
        gridSize: {
            width: maxZoomData.gridWidth,
            height: maxZoomData.gridHeight
        },
        totalTiles: maxZoomData.totalTiles,
        downloadPattern: {
            baseUrl: BASE_URL,
            referrer: REFERRER,
            tileUrlPattern: '{baseUrl}{zoom}-{x}-{y}.jpg',
            coordinateSystem: 'TMS (Tile Map Service) - origin top-left',
            downloadOrder: 'row-by-row, left-to-right, top-to-bottom'
        },
        stitchingMethod: {
            approach: 'Grid-based stitching',
            description: 'Stitch tiles in grid pattern with x,y coordinates',
            tilePositionX: 'x * tileWidth',
            tilePositionY: 'y * tileHeight'
        },
        authentication: {
            required: true,
            method: 'Referrer-based',
            workingReferrers: [
                'https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/',
                'https://viewerd.kbr.be/',
                'https://viewerd.kbr.be/display/'
            ],
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Referer': '{working_referrer}',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site'
            }
        }
    };
    
    console.log(`✓ Download methodology created for ${maxZoom} zoom level`);
    console.log(`✓ Maximum resolution: ${methodology.maxResolution.width}x${methodology.maxResolution.height}px`);
    console.log(`✓ Grid size: ${methodology.gridSize.width}x${methodology.gridSize.height} tiles`);
    console.log(`✓ Total tiles to download: ${methodology.totalTiles}`);
    
    return methodology;
}

// Main discovery function
async function discoverBelgicaTileSystem() {
    console.log('🔍 BELGICA KBR COMPLETE TILE SYSTEM DISCOVERY');
    console.log('============================================');
    
    const discovery = {
        timestamp: new Date().toISOString(),
        baseUrl: BASE_URL,
        referrer: REFERRER,
        testDirectory: TEST_DIR
    };
    
    try {
        // Discover zoom levels
        discovery.zoomLevels = await discoverZoomLevels();
        
        // Find working zoom levels
        const workingZooms = discovery.zoomLevels.filter(z => z.success);
        
        if (workingZooms.length === 0) {
            throw new Error('No working zoom levels found');
        }
        
        console.log(`\n📊 Found ${workingZooms.length} working zoom levels`);
        
        // Map grid structure for each working zoom level
        discovery.gridStructure = {};
        for (const zoom of workingZooms) {
            console.log(`\n🗺️  Mapping grid for zoom ${zoom.zoom}...`);
            discovery.gridStructure[zoom.zoom] = await mapTileGrid(zoom.zoom);
        }
        
        // Analyze tile structure
        const allGridResults = Object.values(discovery.gridStructure).flat();
        discovery.analysis = await analyzeTileStructure(discovery.zoomLevels, allGridResults);
        
        // Create download methodology
        discovery.methodology = createTileDownloadMethod(discovery.analysis);
        
        // Save complete discovery results
        const resultsFile = path.join(TEST_DIR, 'complete-discovery-results.json');
        fs.writeFileSync(resultsFile, JSON.stringify(discovery, null, 2));
        
        console.log('\n✅ COMPLETE TILE SYSTEM DISCOVERY FINISHED');
        console.log(`📄 Results saved to: ${resultsFile}`);
        console.log(`📁 Sample tiles saved to: ${TEST_DIR}`);
        
        return discovery;
        
    } catch (error) {
        console.error('❌ Discovery failed:', error);
        throw error;
    }
}

// Run the discovery
if (require.main === module) {
    discoverBelgicaTileSystem().catch(console.error);
}

module.exports = { discoverBelgicaTileSystem };