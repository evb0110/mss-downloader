/**
 * Enhanced test script to validate Verona NBM IIIF resolution capabilities
 * Downloads actual files to measure quality differences
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Test manifest URL
const manifestUrl = 'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json';

// Test different resolution formats
const resolutionTests = [
    { path: 'full/full/0/native.jpg', name: 'native_full' },
    { path: 'full/max/0/default.jpg', name: 'max_default' },
    { path: 'full/20000,/0/default.jpg', name: 'w20000' },
    { path: 'full/10000,/0/default.jpg', name: 'w10000' },
    { path: 'full/5000,/0/default.jpg', name: 'w5000' },
    { path: 'full/2000,/0/default.jpg', name: 'w2000_current' },
    { path: 'full/1000,/0/default.jpg', name: 'w1000' },
];

async function fetchWithSSLBypass(url) {
    const agent = new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true,
        timeout: 30000
    });

    return new Promise((resolve, reject) => {
        const req = https.get(url, { agent }, (res) => {
            let data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const buffer = Buffer.concat(data);
                    resolve({ buffer, status: res.statusCode, headers: res.headers, size: buffer.length });
                } else {
                    resolve({ error: `HTTP ${res.statusCode}`, status: res.statusCode });
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

async function downloadAndAnalyzeImage(baseUrl, resolutionTest) {
    const fullUrl = `${baseUrl}/${resolutionTest.path}`;
    console.log(`Testing: ${resolutionTest.name} (${resolutionTest.path})`);
    
    try {
        const result = await fetchWithSSLBypass(fullUrl);
        if (result.error) {
            console.log(`  ❌ ${result.error}`);
            return { ...resolutionTest, status: 'failed', error: result.error };
        }
        
        const sizeKB = (result.size / 1024).toFixed(1);
        const sizeMB = (result.size / 1024 / 1024).toFixed(2);
        
        // Save the image to analyze dimensions later
        const outputDir = '.devkit/verona-resolution-test';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const filename = `${resolutionTest.name}.jpg`;
        const filepath = path.join(outputDir, filename);
        fs.writeFileSync(filepath, result.buffer);
        
        console.log(`  ✅ Success - Size: ${sizeMB}MB (${sizeKB}KB) - Saved as ${filename}`);
        
        return {
            ...resolutionTest,
            status: 'success',
            size: result.size,
            sizeMB: parseFloat(sizeMB),
            sizeKB: parseFloat(sizeKB),
            url: fullUrl,
            filename: filepath
        };
    } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        return { ...resolutionTest, status: 'error', error: error.message };
    }
}

async function getImageDimensions(filepath) {
    try {
        // Try to extract image dimensions using file command
        const { exec } = require('child_process');
        return new Promise((resolve) => {
            exec(`file "${filepath}"`, (error, stdout) => {
                if (error) {
                    resolve({ width: 'unknown', height: 'unknown' });
                    return;
                }
                
                // Parse dimensions from file output (e.g., "JPEG image data, JFIF standard 1.01, resolution (JFIF), density 300x300, segment length 16, baseline, precision 8, 1200x1600, components 3")
                const match = stdout.match(/(\d+)x(\d+)/);
                if (match) {
                    resolve({ width: parseInt(match[1]), height: parseInt(match[2]) });
                } else {
                    resolve({ width: 'unknown', height: 'unknown' });
                }
            });
        });
    } catch (error) {
        return { width: 'unknown', height: 'unknown' };
    }
}

async function main() {
    console.log('🔍 Enhanced Verona NBM IIIF Resolution Testing');
    console.log('===============================================');
    
    // First, fetch the manifest
    console.log('\n📥 Fetching manifest...');
    try {
        const manifestResult = await fetchWithSSLBypass(manifestUrl);
        if (manifestResult.error) {
            console.error('❌ Failed to fetch manifest:', manifestResult.error);
            return;
        }
        
        const manifest = JSON.parse(manifestResult.buffer.toString());
        console.log('✅ Manifest loaded successfully');
        console.log(`   Manuscript: ${manifest.label || 'Unknown'}`);
        console.log(`   Pages: ${manifest.sequences[0].canvases.length}`);
        
        // Get the first image service URL for testing
        const firstCanvas = manifest.sequences[0].canvases[0];
        const imageService = firstCanvas.images[0].resource.service;
        
        if (!imageService || !imageService['@id']) {
            console.error('❌ No IIIF image service found in manifest');
            return;
        }
        
        const baseImageUrl = imageService['@id'].replace(/\/$/, '');
        console.log(`🎯 Testing image service: ${baseImageUrl.substring(0, 80)}...`);
        
        // Test different resolutions
        console.log('\n🔬 Downloading and testing different resolutions...');
        const results = [];
        
        for (const resTest of resolutionTests) {
            const result = await downloadAndAnalyzeImage(baseImageUrl, resTest);
            results.push(result);
            
            // Get image dimensions if successful
            if (result.status === 'success') {
                const dimensions = await getImageDimensions(result.filename);
                result.width = dimensions.width;
                result.height = dimensions.height;
                result.pixels = dimensions.width !== 'unknown' && dimensions.height !== 'unknown' ? 
                    dimensions.width * dimensions.height : 'unknown';
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay between requests
        }
        
        // Analyze results
        console.log('\n📊 Resolution Test Results:');
        console.log('=============================================');
        
        const successful = results.filter(r => r.status === 'success');
        
        if (successful.length === 0) {
            console.log('❌ No successful resolution tests');
            return;
        }
        
        // Sort by file size (largest first)
        successful.sort((a, b) => (b.size || 0) - (a.size || 0));
        
        console.log('✅ Successful resolutions (sorted by size):');
        console.log('Rank | Resolution Type        | File Size | Dimensions    | Pixels');
        console.log('-----|------------------------|-----------|---------------|------------');
        
        successful.forEach((result, index) => {
            const rank = index === 0 ? '🏆 1st' : index === 1 ? '🥈 2nd' : index === 2 ? '🥉 3rd' : `   ${index + 1}`;
            const sizeStr = `${result.sizeMB}MB`;
            const dimStr = result.width !== 'unknown' ? `${result.width}x${result.height}` : 'unknown';
            const pixelStr = result.pixels !== 'unknown' ? result.pixels.toLocaleString() : 'unknown';
            
            console.log(`${rank} | ${result.name.padEnd(22)} | ${sizeStr.padStart(9)} | ${dimStr.padEnd(13)} | ${pixelStr.padStart(11)}`);
        });
        
        // Current vs recommended analysis
        const current = successful.find(r => r.name.includes('w2000_current'));
        const recommended = successful[0]; // Largest file
        
        console.log('\n🚀 QUALITY ANALYSIS:');
        console.log('====================');
        
        if (current) {
            console.log(`Current Implementation (w2000):`);
            console.log(`   Size: ${current.sizeMB}MB`);
            console.log(`   Dimensions: ${current.width}x${current.height}`);
            console.log(`   Pixels: ${current.pixels !== 'unknown' ? current.pixels.toLocaleString() : 'unknown'}`);
        }
        
        if (recommended && current && recommended !== current) {
            const sizeImprovement = ((recommended.size - current.size) / current.size * 100).toFixed(1);
            const pixelImprovement = current.pixels !== 'unknown' && recommended.pixels !== 'unknown' ? 
                ((recommended.pixels - current.pixels) / current.pixels * 100).toFixed(1) : 'unknown';
            
            console.log(`\nBest Available (${recommended.name}):`);
            console.log(`   Size: ${recommended.sizeMB}MB (+${sizeImprovement}%)`);
            console.log(`   Dimensions: ${recommended.width}x${recommended.height}`);
            console.log(`   Pixels: ${recommended.pixels !== 'unknown' ? recommended.pixels.toLocaleString() : 'unknown'}`);
            if (pixelImprovement !== 'unknown') {
                console.log(`   Quality Improvement: +${pixelImprovement}% more pixels`);
            }
        } else if (recommended === current) {
            console.log(`\n✅ Current implementation is already using the highest quality available!`);
        }
        
        // Save detailed results
        const reportData = {
            timestamp: new Date().toISOString(),
            manifest: manifestUrl,
            manuscript: manifest.label,
            totalPages: manifest.sequences[0].canvases.length,
            baseImageUrl,
            resolutionTests: results,
            analysis: {
                totalSuccessful: successful.length,
                currentImplementation: current ? {
                    name: current.name,
                    sizeMB: current.sizeMB,
                    dimensions: current.width !== 'unknown' ? `${current.width}x${current.height}` : 'unknown',
                    pixels: current.pixels
                } : null,
                recommended: recommended ? {
                    name: recommended.name,
                    sizeMB: recommended.sizeMB,
                    dimensions: recommended.width !== 'unknown' ? `${recommended.width}x${recommended.height}` : 'unknown',
                    pixels: recommended.pixels
                } : null,
                qualityUpgradeOpportunity: current && recommended && recommended !== current
            }
        };
        
        fs.writeFileSync('.devkit/reports/verona-resolution-detailed-analysis.json', JSON.stringify(reportData, null, 2));
        console.log(`\n💾 Detailed results saved to .devkit/reports/verona-resolution-detailed-analysis.json`);
        console.log(`📁 Test images saved to .devkit/verona-resolution-test/`);
        
    } catch (error) {
        console.error('❌ Error during testing:', error.message);
    }
}

main().catch(console.error);