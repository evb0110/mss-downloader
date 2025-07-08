#!/usr/bin/env node

/**
 * Internet Culturale Debug Analysis
 * 
 * This script analyzes the Internet Culturale manifest loading
 * to understand why only 2 pages are being downloaded instead of the full manuscript.
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// Test URL from the user's request
const testUrl = 'https://dam.iccu.sbn.it/mol_46/containers/avQYk0e/manifest';

async function main() {
    console.log('🔍 Internet Culturale Debug Analysis');
    console.log('=' .repeat(60));
    console.log(`📖 Test URL: ${testUrl}`);
    console.log('');

    try {
        // Step 1: Fetch manifest directly
        console.log('🔄 Step 1: Fetching IIIF manifest...');
        const manifestData = await fetchManifest(testUrl);
        
        console.log(`✅ Manifest fetched successfully`);
        console.log(`📄 Manifest type: ${manifestData['@type'] || manifestData.type || 'Unknown'}`);
        console.log(`📋 Label: ${getLabel(manifestData.label)}`);
        
        // Step 2: Analyze sequences and canvases
        console.log('');
        console.log('🔄 Step 2: Analyzing manifest structure...');
        const analysis = analyzeManifest(manifestData);
        
        console.log(`📊 Analysis Results:`);
        console.log(`   • Sequences found: ${analysis.sequenceCount}`);
        console.log(`   • Total canvases: ${analysis.totalCanvases}`);
        console.log(`   • Image URLs extracted: ${analysis.imageUrls.length}`);
        
        if (analysis.imageUrls.length === 0) {
            console.log('❌ No image URLs found in manifest!');
            console.log('📋 Full manifest structure:');
            console.log(JSON.stringify(manifestData, null, 2));
            return;
        }
        
        // Step 3: Show first few image URLs
        console.log('');
        console.log('🔗 First 10 image URLs:');
        analysis.imageUrls.slice(0, 10).forEach((url, i) => {
            console.log(`   ${i + 1}. ${url}`);
        });
        
        if (analysis.imageUrls.length > 10) {
            console.log(`   ... and ${analysis.imageUrls.length - 10} more`);
        }
        
        // Step 4: Test a few image downloads
        console.log('');
        console.log('🔄 Step 3: Testing image downloads...');
        const testUrls = analysis.imageUrls.slice(0, 3);
        const downloadResults = await testImageDownloads(testUrls);
        
        console.log(`📥 Download Results:`);
        downloadResults.forEach((result, i) => {
            if (result.success) {
                console.log(`   ${i + 1}. ✅ Size: ${Math.round(result.size / 1024)}KB`);
            } else {
                console.log(`   ${i + 1}. ❌ Error: ${result.error}`);
            }
        });
        
        // Step 5: Compare with current implementation issue
        console.log('');
        console.log('🔄 Step 4: Checking for implementation issues...');
        
        if (analysis.imageUrls.length === 2) {
            console.log('🚨 ISSUE CONFIRMED: Only 2 image URLs found in manifest');
            console.log('   This suggests the manifest itself only contains 2 pages');
            console.log('   Need to check if this is the correct manifest URL');
        } else if (analysis.imageUrls.length > 2) {
            console.log(`✅ Manifest contains ${analysis.imageUrls.length} pages`);
            console.log('   The issue is likely in the implementation, not the manifest');
        }
        
        // Step 6: Write detailed report
        const reportPath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/internet-culturale-analysis-report.json';
        const report = {
            timestamp: new Date().toISOString(),
            testUrl,
            manifestType: manifestData['@type'] || manifestData.type,
            label: getLabel(manifestData.label),
            totalPages: analysis.imageUrls.length,
            sequenceCount: analysis.sequenceCount,
            totalCanvases: analysis.totalCanvases,
            imageUrls: analysis.imageUrls,
            downloadTests: downloadResults,
            recommendations: generateRecommendations(analysis)
        };
        
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log('');
        console.log(`📄 Detailed report saved to: ${reportPath}`);
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        console.error(error.stack);
    }
}

function fetchManifest(url) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json,application/ld+json,*/*'
            }
        }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                return;
            }

            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const manifest = JSON.parse(data);
                    resolve(manifest);
                } catch (parseError) {
                    reject(new Error(`Failed to parse JSON: ${parseError.message}`));
                }
            });
            res.on('error', reject);
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

function analyzeManifest(manifest) {
    const analysis = {
        sequenceCount: 0,
        totalCanvases: 0,
        imageUrls: []
    };
    
    // Handle IIIF Presentation API v2 and v3
    const sequences = manifest.sequences || (manifest.items ? [{ canvases: manifest.items }] : []);
    analysis.sequenceCount = sequences.length;
    
    for (const sequence of sequences) {
        const canvases = sequence.canvases || sequence.items || [];
        analysis.totalCanvases += canvases.length;
        
        for (const canvas of canvases) {
            // IIIF v2: canvas.images[0].resource
            // IIIF v3: canvas.items[0].items[0].body
            const images = canvas.images || (canvas.items ? canvas.items[0]?.items : []);
            
            if (canvas.images) {
                // IIIF v2
                for (const image of images) {
                    const resource = image.resource;
                    if (resource.service && resource.service['@id']) {
                        // Use highest quality
                        analysis.imageUrls.push(`${resource.service['@id']}/full/full/0/default.jpg`);
                    } else if (resource['@id'] || resource.id) {
                        analysis.imageUrls.push(resource['@id'] || resource.id);
                    }
                }
            } else if (canvas.items) {
                // IIIF v3
                for (const annotationPage of canvas.items) {
                    for (const annotation of annotationPage.items || []) {
                        const body = annotation.body;
                        if (body && body.service) {
                            const serviceId = Array.isArray(body.service) ? body.service[0].id : body.service.id;
                            analysis.imageUrls.push(`${serviceId}/full/full/0/default.jpg`);
                        } else if (body && body.id) {
                            analysis.imageUrls.push(body.id);
                        }
                    }
                }
            }
        }
    }
    
    return analysis;
}

function testImageDownloads(urls) {
    return Promise.all(urls.map(url => downloadImageTest(url)));
}

function downloadImageTest(url) {
    return new Promise((resolve) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/*,*/*;q=0.8'
            }
        }, (res) => {
            if (res.statusCode !== 200) {
                resolve({
                    success: false,
                    error: `HTTP ${res.statusCode}: ${res.statusMessage}`
                });
                return;
            }

            let size = 0;
            res.on('data', chunk => size += chunk.length);
            res.on('end', () => {
                resolve({
                    success: true,
                    size
                });
            });
            res.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message
                });
            });
        });

        req.on('error', (error) => {
            resolve({
                success: false,
                error: error.message
            });
        });

        req.setTimeout(10000, () => {
            req.destroy();
            resolve({
                success: false,
                error: 'Timeout'
            });
        });

        req.end();
    });
}

function getLabel(label) {
    if (typeof label === 'string') return label;
    if (label && typeof label === 'object') {
        return label.en || label.it || label['@value'] || JSON.stringify(label);
    }
    return 'Unknown';
}

function generateRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.imageUrls.length === 0) {
        recommendations.push('No image URLs found - check manifest structure parsing');
    } else if (analysis.imageUrls.length === 2) {
        recommendations.push('Only 2 pages found - verify this is the correct manifest URL for the complete manuscript');
        recommendations.push('Check if there are multiple volumes or if this is a partial manifest');
    } else if (analysis.imageUrls.length < 10) {
        recommendations.push('Low page count - verify this represents the complete manuscript');
    } else {
        recommendations.push('Normal page count detected - implementation should work correctly');
    }
    
    return recommendations;
}

// Run the analysis
main().catch(console.error);