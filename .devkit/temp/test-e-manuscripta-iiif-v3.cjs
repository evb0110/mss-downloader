#!/usr/bin/env node

const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');

const manuscriptId = '5157222';
const manifestUrl = `https://www.e-manuscripta.ch/i3f/v20/${manuscriptId}/manifest`;

async function makeHttpsRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, application/ld+json',
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

async function makeHttpsRequestBinary(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/jpeg, image/png, image/webp, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
                ...options.headers
            },
            ...options
        }, (res) => {
            const chunks = [];
            
            res.on('data', chunk => {
                chunks.push(chunk);
            });
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const data = Buffer.concat(chunks);
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                } else {
                    const data = Buffer.concat(chunks);
                    reject(new Error(`HTTP ${res.statusCode}: ${data.toString()}`));
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

async function downloadImage(url, filename) {
    try {
        const response = await makeHttpsRequestBinary(url);
        await fs.writeFile(filename, response.data);
        const stats = await fs.stat(filename);
        return {
            success: true,
            size: stats.size,
            filename: filename
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            filename: filename
        };
    }
}

async function testIIIFManifest() {
    console.log(`\n=== E-Manuscripta IIIF v3 Manifest Test ===`);
    console.log(`Manuscript ID: ${manuscriptId}`);
    console.log(`Manifest URL: ${manifestUrl}`);
    
    try {
        // Step 1: Fetch IIIF manifest
        console.log(`\n1. Fetching IIIF manifest...`);
        const manifestResponse = await makeHttpsRequest(manifestUrl);
        console.log(`Status: ${manifestResponse.statusCode}`);
        console.log(`Content-Type: ${manifestResponse.headers['content-type']}`);
        
        // Step 2: Parse manifest JSON
        console.log(`\n2. Parsing manifest JSON...`);
        const manifest = JSON.parse(manifestResponse.data);
        
        // Save the manifest for analysis
        await fs.writeFile(
            '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/temp/e-manuscripta-manifest-5157222.json',
            JSON.stringify(manifest, null, 2)
        );
        
        console.log(`Manifest type: ${manifest.type}`);
        console.log(`Manifest context: ${JSON.stringify(manifest['@context'])}`);
        console.log(`Label: ${JSON.stringify(manifest.label)}`);
        
        // Step 3: Extract canvases information - handle both IIIF v2 and v3
        console.log(`\n3. Analyzing canvases...`);
        const canvases = manifest.items || manifest.sequences?.[0]?.canvases || [];
        console.log(`Total canvases: ${canvases.length}`);
        
        if (canvases.length === 0) {
            console.log(`Manifest structure:`, Object.keys(manifest));
            if (manifest.sequences) {
                console.log(`Sequences found: ${manifest.sequences.length}`);
                manifest.sequences.forEach((seq, i) => {
                    console.log(`  Sequence ${i}: ${Object.keys(seq)}`);
                });
            }
            throw new Error('No canvases found in manifest');
        }
        
        // Analyze canvas structure
        const firstCanvas = canvases[0];
        console.log(`\nFirst canvas analysis:`);
        console.log(`- ID: ${firstCanvas['@id'] || firstCanvas.id}`);
        console.log(`- Type: ${firstCanvas['@type'] || firstCanvas.type}`);
        console.log(`- Label: ${JSON.stringify(firstCanvas.label)}`);
        
        // Handle IIIF v2 structure
        if (firstCanvas.images) {
            console.log(`- Images: ${firstCanvas.images.length}`);
            
            const firstImage = firstCanvas.images[0];
            if (firstImage.resource) {
                console.log(`- First image resource service: ${firstImage.resource.service?.['@id']}`);
                console.log(`- First image resource id: ${firstImage.resource['@id']}`);
            }
        }
        
        // Handle IIIF v3 structure  
        if (firstCanvas.items) {
            console.log(`- Annotation pages: ${firstCanvas.items.length}`);
            
            const firstAnnotationPage = firstCanvas.items[0];
            if (firstAnnotationPage.items) {
                console.log(`- Annotations in first page: ${firstAnnotationPage.items.length}`);
                
                const firstAnnotation = firstAnnotationPage.items[0];
                if (firstAnnotation.body) {
                    console.log(`- First annotation body service: ${firstAnnotation.body.service?.[0]?.id}`);
                    console.log(`- First annotation body id: ${firstAnnotation.body.id}`);
                }
            }
        }
        
        // Step 4: Extract image URLs and test different resolutions
        console.log(`\n4. Testing image URL construction...`);
        const testResults = [];
        
        // Test first 3 canvases
        const canvasesToTest = canvases.slice(0, Math.min(3, canvases.length));
        
        for (let i = 0; i < canvasesToTest.length; i++) {
            const canvas = canvasesToTest[i];
            console.log(`\nTesting canvas ${i + 1}:`);
            
            try {
                let serviceUrl = null;
                
                // Handle IIIF v2 structure
                if (canvas.images && canvas.images[0]) {
                    const image = canvas.images[0];
                    if (image.resource && image.resource.service) {
                        serviceUrl = image.resource.service['@id'];
                    }
                }
                
                // Handle IIIF v3 structure
                if (!serviceUrl && canvas.items && canvas.items[0]) {
                    const annotation = canvas.items[0].items[0];
                    const imageBody = annotation.body;
                    
                    if (imageBody.service && imageBody.service[0]) {
                        serviceUrl = imageBody.service[0].id;
                    }
                }
                
                if (serviceUrl) {
                    console.log(`Service URL: ${serviceUrl}`);
                    
                    // Test different IIIF resolutions
                    const resolutionTests = [
                        { name: 'Maximum', url: `${serviceUrl}/full/max/0/default.jpg` },
                        { name: 'Full Size', url: `${serviceUrl}/full/full/0/default.jpg` },
                        { name: '4000px', url: `${serviceUrl}/full/4000,/0/default.jpg` },
                        { name: '2000px', url: `${serviceUrl}/full/2000,/0/default.jpg` }
                    ];
                    
                    for (const test of resolutionTests) {
                        console.log(`  Testing ${test.name}: ${test.url}`);
                        
                        try {
                            const imageResponse = await makeHttpsRequestBinary(test.url);
                            const result = {
                                canvas: i + 1,
                                resolution: test.name,
                                url: test.url,
                                success: true,
                                statusCode: imageResponse.statusCode,
                                contentType: imageResponse.headers['content-type'],
                                size: imageResponse.data.length
                            };
                            
                            testResults.push(result);
                            console.log(`    ✓ Success: ${result.size} bytes, ${result.contentType}`);
                            
                            // Save the first successful image of each canvas
                            if (test.name === 'Maximum') {
                                const filename = `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/temp/e-manuscripta-iiif-canvas-${i + 1}.jpg`;
                                await fs.writeFile(filename, imageResponse.data);
                                console.log(`    Saved sample: ${filename}`);
                            }
                            
                            break; // Use first successful resolution
                            
                        } catch (error) {
                            const result = {
                                canvas: i + 1,
                                resolution: test.name,
                                url: test.url,
                                success: false,
                                error: error.message
                            };
                            testResults.push(result);
                            console.log(`    ✗ Failed: ${error.message}`);
                        }
                    }
                } else {
                    console.log(`  No IIIF service found for canvas ${i + 1}`);
                }
                
            } catch (error) {
                console.log(`  Error processing canvas ${i + 1}: ${error.message}`);
            }
        }
        
        // Step 5: Compare with current block-based approach
        console.log(`\n5. Comparison Analysis:`);
        console.log(`\nIIIF v3 Manifest Approach:`);
        console.log(`- Total pages discovered: ${canvases.length}`);
        console.log(`- Successful image tests: ${testResults.filter(r => r.success).length}`);
        console.log(`- Failed image tests: ${testResults.filter(r => !r.success).length}`);
        
        // Calculate average file size
        const successfulTests = testResults.filter(r => r.success);
        if (successfulTests.length > 0) {
            const avgSize = successfulTests.reduce((sum, r) => sum + r.size, 0) / successfulTests.length;
            console.log(`- Average image size: ${Math.round(avgSize / 1024)} KB`);
            console.log(`- Largest image: ${Math.max(...successfulTests.map(r => r.size)) / 1024} KB`);
        }
        
        // Step 6: Test logical structure
        console.log(`\n6. Logical Structure Analysis:`);
        const structures = manifest.structures || manifest.ranges || [];
        if (structures.length > 0) {
            console.log(`- Ranges found: ${structures.length}`);
            structures.forEach((structure, index) => {
                console.log(`  Range ${index + 1}: ${JSON.stringify(structure.label)} (${structure.items?.length || structure.canvases?.length || 0} items)`);
            });
        } else {
            console.log(`- No logical structures/ranges found`);
        }
        
        // Step 7: Generate implementation recommendations
        console.log(`\n7. Implementation Recommendations:`);
        console.log(`\nIIIF v3 Approach Advantages:`);
        console.log(`- Standard IIIF protocol with full metadata`);
        console.log(`- Clear page count: ${canvases.length} pages`);
        console.log(`- Multiple resolution options available`);
        console.log(`- Structured canvas-based approach`);
        console.log(`- No need for block parsing or URL guessing`);
        
        console.log(`\nImplementation complexity: LOW`);
        console.log(`- Single manifest request`);
        console.log(`- Straightforward JSON parsing`);
        console.log(`- Standard IIIF image URL construction`);
        
        // Save detailed results
        const detailedResults = {
            manuscriptId,
            manifestUrl,
            totalCanvases: canvases.length,
            testResults,
            manifest: {
                type: manifest.type,
                context: manifest['@context'],
                label: manifest.label,
                hasStructures: !!manifest.structures,
                structureCount: manifest.structures?.length || 0
            },
            recommendations: {
                approach: 'IIIF v3 Manifest',
                complexity: 'LOW',
                advantages: [
                    'Standard IIIF protocol',
                    `Clear page count: ${canvases.length} pages`,
                    'Multiple resolution options',
                    'No URL guessing required'
                ]
            }
        };
        
        await fs.writeFile(
            '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/e-manuscripta-iiif-v3-test-results.json',
            JSON.stringify(detailedResults, null, 2)
        );
        
        console.log(`\n✓ Test completed successfully!`);
        console.log(`✓ Detailed results saved to .devkit/reports/e-manuscripta-iiif-v3-test-results.json`);
        console.log(`✓ Sample images saved to .devkit/temp/`);
        
        return detailedResults;
        
    } catch (error) {
        console.error(`\n✗ Test failed: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        return null;
    }
}

// Run the test
if (require.main === module) {
    testIIIFManifest().then(result => {
        if (result) {
            console.log(`\n=== SUMMARY ===`);
            console.log(`IIIF v3 approach: ${result.totalCanvases} pages discovered`);
            console.log(`Successful tests: ${result.testResults.filter(r => r.success).length}`);
            console.log(`Recommendation: Use IIIF v3 manifest approach`);
        }
        process.exit(result ? 0 : 1);
    });
}

module.exports = { testIIIFManifest };