/**
 * Test script to validate Verona NBM IIIF resolution capabilities
 * Tests different resolution parameters to find maximum quality available
 */

const https = require('https');
const fs = require('fs');

// Test manifest URL
const manifestUrl = 'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json';

// Test different resolution formats
const resolutionTests = [
    'full/full/0/native.jpg',    // Current implementation
    'full/20000,/0/default.jpg', // Large resolution
    'full/10000,/0/default.jpg', // Medium-large resolution
    'full/5000,/0/default.jpg',  // Medium resolution
    'full/2000,/0/default.jpg',  // Current used resolution
    'full/1000,/0/default.jpg',  // Small resolution
    'full/max/0/default.jpg',    // Maximum available
];

async function fetchWithSSLBypass(url) {
    const agent = new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true,
        timeout: 30000
    });

    return new Promise((resolve, reject) => {
        const req = https.get(url, { agent }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ data, status: res.statusCode, headers: res.headers });
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

async function testImageResolution(baseUrl, resolutionPath) {
    const fullUrl = `${baseUrl}/${resolutionPath}`;
    console.log(`Testing: ${resolutionPath}`);
    
    try {
        const result = await fetchWithSSLBypass(fullUrl);
        if (result.error) {
            console.log(`  ❌ ${result.error}`);
            return { path: resolutionPath, status: 'failed', error: result.error };
        }
        
        const contentLength = result.headers['content-length'];
        const contentType = result.headers['content-type'];
        
        console.log(`  ✅ Success - Size: ${contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) + 'MB' : 'unknown'}, Type: ${contentType}`);
        
        return {
            path: resolutionPath,
            status: 'success',
            size: contentLength ? parseInt(contentLength) : 0,
            contentType,
            url: fullUrl
        };
    } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        return { path: resolutionPath, status: 'error', error: error.message };
    }
}

async function main() {
    console.log('🔍 Testing Verona NBM IIIF Resolution Capabilities');
    console.log('=' * 60);
    
    // First, fetch the manifest
    console.log('\n📥 Fetching manifest...');
    try {
        const manifestResult = await fetchWithSSLBypass(manifestUrl);
        if (manifestResult.error) {
            console.error('❌ Failed to fetch manifest:', manifestResult.error);
            return;
        }
        
        const manifest = JSON.parse(manifestResult.data);
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
        console.log(`🎯 Testing image service: ${baseImageUrl}`);
        
        // Test different resolutions
        console.log('\n🔬 Testing different resolutions...');
        const results = [];
        
        for (const resPath of resolutionTests) {
            const result = await testImageResolution(baseImageUrl, resPath);
            results.push(result);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay between requests
        }
        
        // Analyze results
        console.log('\n📊 Resolution Test Results:');
        console.log('=' * 60);
        
        const successful = results.filter(r => r.status === 'success');
        
        if (successful.length === 0) {
            console.log('❌ No successful resolution tests');
            return;
        }
        
        // Sort by file size (largest first)
        successful.sort((a, b) => (b.size || 0) - (a.size || 0));
        
        console.log('✅ Successful resolutions (sorted by size):');
        successful.forEach((result, index) => {
            const sizeStr = result.size ? `${(result.size / 1024 / 1024).toFixed(2)}MB` : 'unknown';
            const indicator = index === 0 ? '🏆 BEST' : index === 1 ? '🥈 2nd' : index === 2 ? '🥉 3rd' : '   ';
            console.log(`${indicator} ${result.path.padEnd(25)} - ${sizeStr}`);
        });
        
        // Current vs recommended
        const current = successful.find(r => r.path.includes('full/full'));
        const recommended = successful[0]; // Largest file
        
        if (current && recommended && current !== recommended) {
            const improvement = ((recommended.size - current.size) / current.size * 100).toFixed(1);
            console.log(`\n🚀 QUALITY UPGRADE OPPORTUNITY:`);
            console.log(`   Current: ${current.path} (${(current.size / 1024 / 1024).toFixed(2)}MB)`);
            console.log(`   Best Available: ${recommended.path} (${(recommended.size / 1024 / 1024).toFixed(2)}MB)`);
            console.log(`   Improvement: +${improvement}% file size increase = higher quality`);
        }
        
        // Save results
        const reportData = {
            timestamp: new Date().toISOString(),
            manifest: manifestUrl,
            manuscript: manifest.label,
            totalPages: manifest.sequences[0].canvases.length,
            baseImageUrl,
            resolutionTests: results,
            recommendations: {
                current: current?.path,
                recommended: recommended?.path,
                qualityImprovement: current && recommended && current !== recommended ? 
                    `+${((recommended.size - current.size) / current.size * 100).toFixed(1)}%` : 'none'
            }
        };
        
        fs.writeFileSync('.devkit/reports/verona-resolution-analysis.json', JSON.stringify(reportData, null, 2));
        console.log('\n💾 Results saved to .devkit/reports/verona-resolution-analysis.json');
        
    } catch (error) {
        console.error('❌ Error during testing:', error.message);
    }
}

main().catch(console.error);