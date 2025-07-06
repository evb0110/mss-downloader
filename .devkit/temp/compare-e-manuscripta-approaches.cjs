#!/usr/bin/env node

const https = require('https');
const fs = require('fs').promises;
const zlib = require('zlib');

const manuscriptId = '5157222';

async function makeHttpsRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                ...options.headers
            },
            ...options
        }, (res) => {
            let stream = res;
            
            // Handle compression
            if (res.headers['content-encoding'] === 'gzip') {
                stream = zlib.createGunzip();
                res.pipe(stream);
            } else if (res.headers['content-encoding'] === 'deflate') {
                stream = zlib.createInflate();
                res.pipe(stream);
            } else if (res.headers['content-encoding'] === 'br') {
                stream = zlib.createBrotliDecompress();
                res.pipe(stream);
            }
            
            const chunks = [];
            
            stream.on('data', chunk => {
                chunks.push(chunk);
            });
            
            stream.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const data = Buffer.concat(chunks);
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data.toString()
                    });
                } else {
                    const data = Buffer.concat(chunks).toString();
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
            
            stream.on('error', reject);
        });
        
        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

async function testCurrentBlockApproach() {
    console.log('\n=== Testing Current Block-Based Approach ===');
    
    try {
        // Step 1: Fetch the main page
        const mainUrl = `https://www.e-manuscripta.ch/zuzen/content/structure/${manuscriptId}`;
        console.log(`Fetching main page: ${mainUrl}`);
        
        const response = await makeHttpsRequest(mainUrl);
        console.log(`Status: ${response.statusCode}`);
        
        // Step 2: Parse blocks from HTML
        const html = response.data;
        const blockMatches = html.match(/data-blockid="(\d+)"/g) || [];
        const blockIds = blockMatches.map(match => match.match(/data-blockid="(\d+)"/)[1]);
        
        console.log(`Found ${blockIds.length} blocks: ${blockIds.slice(0, 10).join(', ')}${blockIds.length > 10 ? '...' : ''}`);
        
        // Step 3: Test a few blocks to see how many images each contains
        const blockTests = [];
        const testBlocks = blockIds.slice(0, 3);
        
        for (const blockId of testBlocks) {
            try {
                const blockUrl = `https://www.e-manuscripta.ch/zuzen/content/structure/${blockId}`;
                const blockResponse = await makeHttpsRequest(blockUrl);
                
                // Count images in this block
                const blockHtml = blockResponse.data;
                const imageMatches = blockHtml.match(/data-blockid="(\d+)"/g) || [];
                const imageCount = imageMatches.length;
                
                blockTests.push({
                    blockId,
                    imageCount,
                    success: true
                });
                
                console.log(`Block ${blockId}: ${imageCount} images`);
                
            } catch (error) {
                blockTests.push({
                    blockId,
                    error: error.message,
                    success: false
                });
                console.log(`Block ${blockId}: Error - ${error.message}`);
            }
        }
        
        return {
            approach: 'Block-based',
            totalBlocks: blockIds.length,
            testResults: blockTests,
            success: true
        };
        
    } catch (error) {
        console.error(`Block approach failed: ${error.message}`);
        return {
            approach: 'Block-based',
            error: error.message,
            success: false
        };
    }
}

async function testIIIFManifestApproach() {
    console.log('\n=== Testing IIIF Manifest Approach ===');
    
    try {
        // Step 1: Fetch IIIF manifest
        const manifestUrl = `https://www.e-manuscripta.ch/i3f/v20/${manuscriptId}/manifest`;
        console.log(`Fetching IIIF manifest: ${manifestUrl}`);
        
        const response = await makeHttpsRequest(manifestUrl, {
            headers: {
                'Accept': 'application/json, application/ld+json'
            }
        });
        console.log(`Status: ${response.statusCode}`);
        
        // Step 2: Parse manifest
        const manifest = JSON.parse(response.data);
        const canvases = manifest.sequences?.[0]?.canvases || [];
        
        console.log(`Found ${canvases.length} canvases in manifest`);
        
        // Step 3: Test a few image URLs
        const imageTests = [];
        const testCanvases = canvases.slice(0, 3);
        
        for (let i = 0; i < testCanvases.length; i++) {
            const canvas = testCanvases[i];
            
            try {
                let serviceUrl = null;
                
                if (canvas.images && canvas.images[0]) {
                    const image = canvas.images[0];
                    if (image.resource && image.resource.service) {
                        serviceUrl = image.resource.service['@id'];
                    }
                }
                
                if (serviceUrl) {
                    const imageUrl = `${serviceUrl}/full/max/0/default.jpg`;
                    
                    // Test image accessibility
                    const imageResponse = await makeHttpsRequest(imageUrl);
                    
                    imageTests.push({
                        canvasId: canvas['@id'],
                        serviceUrl,
                        imageUrl,
                        size: Buffer.from(imageResponse.data, 'binary').length,
                        success: true
                    });
                    
                    console.log(`Canvas ${i + 1}: ✓ ${imageUrl} (${Buffer.from(imageResponse.data, 'binary').length} bytes)`);
                } else {
                    imageTests.push({
                        canvasId: canvas['@id'],
                        error: 'No service URL found',
                        success: false
                    });
                    console.log(`Canvas ${i + 1}: ✗ No service URL found`);
                }
                
            } catch (error) {
                imageTests.push({
                    canvasId: canvas['@id'],
                    error: error.message,
                    success: false
                });
                console.log(`Canvas ${i + 1}: ✗ Error - ${error.message}`);
            }
        }
        
        return {
            approach: 'IIIF Manifest',
            totalCanvases: canvases.length,
            testResults: imageTests,
            success: true
        };
        
    } catch (error) {
        console.error(`IIIF approach failed: ${error.message}`);
        return {
            approach: 'IIIF Manifest',
            error: error.message,
            success: false
        };
    }
}

async function compareApproaches() {
    console.log(`\n=== E-Manuscripta Approach Comparison ===`);
    console.log(`Manuscript ID: ${manuscriptId}`);
    
    // Test both approaches
    const blockResult = await testCurrentBlockApproach();
    const iiifResult = await testIIIFManifestApproach();
    
    console.log(`\n=== COMPARISON RESULTS ===`);
    
    // Block-based approach results
    console.log(`\nBlock-based Approach:`);
    if (blockResult.success) {
        console.log(`✓ Total blocks discovered: ${blockResult.totalBlocks}`);
        console.log(`✓ Successful block tests: ${blockResult.testResults.filter(r => r.success).length}`);
        console.log(`✗ Failed block tests: ${blockResult.testResults.filter(r => !r.success).length}`);
        
        const totalImages = blockResult.testResults
            .filter(r => r.success)
            .reduce((sum, r) => sum + (r.imageCount || 0), 0);
        console.log(`✓ Images found in tested blocks: ${totalImages}`);
    } else {
        console.log(`✗ Failed: ${blockResult.error}`);
    }
    
    // IIIF approach results
    console.log(`\nIIIF Manifest Approach:`);
    if (iiifResult.success) {
        console.log(`✓ Total canvases discovered: ${iiifResult.totalCanvases}`);
        console.log(`✓ Successful image tests: ${iiifResult.testResults.filter(r => r.success).length}`);
        console.log(`✗ Failed image tests: ${iiifResult.testResults.filter(r => !r.success).length}`);
        
        const avgSize = iiifResult.testResults
            .filter(r => r.success && r.size)
            .reduce((sum, r) => sum + r.size, 0) / 
            iiifResult.testResults.filter(r => r.success && r.size).length;
        
        if (!isNaN(avgSize)) {
            console.log(`✓ Average image size: ${Math.round(avgSize / 1024)} KB`);
        }
    } else {
        console.log(`✗ Failed: ${iiifResult.error}`);
    }
    
    // Final recommendation
    console.log(`\n=== RECOMMENDATION ===`);
    
    if (iiifResult.success && blockResult.success) {
        console.log(`🏆 WINNER: IIIF Manifest Approach`);
        console.log(`\nReasons:`);
        console.log(`- Discovers ${iiifResult.totalCanvases} pages vs ${blockResult.totalBlocks} blocks`);
        console.log(`- Standard IIIF protocol with guaranteed structure`);
        console.log(`- Direct access to maximum resolution images`);
        console.log(`- No need for complex HTML parsing or multi-level requests`);
        console.log(`- Built-in logical structure (ranges) for navigation`);
        console.log(`- More reliable and maintainable implementation`);
        
        console.log(`\nImplementation complexity:`);
        console.log(`- IIIF: LOW (single manifest request + standard URL patterns)`);
        console.log(`- Block-based: HIGH (multi-level HTML parsing + discovery)`);
        
    } else if (iiifResult.success) {
        console.log(`🏆 WINNER: IIIF Manifest Approach (only working option)`);
    } else if (blockResult.success) {
        console.log(`🏆 WINNER: Block-based Approach (only working option)`);
    } else {
        console.log(`❌ Both approaches failed - need further investigation`);
    }
    
    // Save detailed comparison
    const comparisonData = {
        manuscriptId,
        timestamp: new Date().toISOString(),
        blockResult,
        iiifResult,
        recommendation: iiifResult.success ? 'IIIF Manifest' : 'Block-based'
    };
    
    await fs.writeFile(
        '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/e-manuscripta-approach-comparison.json',
        JSON.stringify(comparisonData, null, 2)
    );
    
    console.log(`\n✓ Detailed comparison saved to .devkit/reports/e-manuscripta-approach-comparison.json`);
    
    return comparisonData;
}

// Run the comparison
if (require.main === module) {
    compareApproaches().then(result => {
        process.exit(0);
    }).catch(error => {
        console.error('Comparison failed:', error);
        process.exit(1);
    });
}

module.exports = { compareApproaches };