const { promises: fs } = require('fs');
const path = require('path');
const https = require('https');
const puppeteer = require('puppeteer');

// Import the downloader service
const { EnhancedManuscriptDownloaderService } = require('../dist/main/services/EnhancedManuscriptDownloaderService.js');

// Test URLs for Morgan Library
const testUrls = [
    'https://www.themorgan.org/collection/lindau-gospels/thumbs',
    'https://www.themorgan.org/collection/st-augustine/thumbs',
    'https://www.themorgan.org/collection/apocalypse/thumbs'
];

async function testMorganLibrary() {
    console.log('🧪 Testing Morgan Library fixes...\n');
    
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    const service = new EnhancedManuscriptDownloaderService();
    
    // Create test output directory
    const testDir = path.join(__dirname, 'morgan-test-results');
    await fs.mkdir(testDir, { recursive: true });
    
    const results = [];
    
    for (const url of testUrls) {
        console.log(`\n📚 Testing: ${url}`);
        console.log('='.repeat(60));
        
        try {
            // Load manifest
            const startTime = Date.now();
            const manifest = await service.loadMorganManifest(url);
            const loadTime = Date.now() - startTime;
            
            console.log(`✓ Manifest loaded in ${loadTime}ms`);
            console.log(`  Title: ${manifest.displayName}`);
            console.log(`  Total pages: ${manifest.totalPages}`);
            console.log(`  Library: ${manifest.library}`);
            
            // Analyze image URLs
            const imageStats = analyzeImageUrls(manifest.pageLinks);
            console.log('\n📊 Image quality analysis:');
            console.log(`  - ZIF files: ${imageStats.zif} (Ultra-high resolution)`);
            console.log(`  - Facsimile images: ${imageStats.facsimile}`);
            console.log(`  - Full-size images: ${imageStats.fullSize}`);
            console.log(`  - Styled images: ${imageStats.styled}`);
            console.log(`  - Other images: ${imageStats.other}`);
            
            // Test download of first few images
            console.log('\n🔍 Testing image downloads...');
            const samplesToTest = Math.min(5, manifest.pageLinks.length);
            const downloadResults = [];
            
            for (let i = 0; i < samplesToTest; i++) {
                const imageUrl = manifest.pageLinks[i];
                console.log(`  Testing image ${i + 1}/${samplesToTest}: ${imageUrl.substring(imageUrl.lastIndexOf('/') + 1)}`);
                
                try {
                    const imageData = await downloadImage(imageUrl);
                    const sizeMB = (imageData.length / 1024 / 1024).toFixed(2);
                    console.log(`    ✓ Downloaded: ${sizeMB} MB`);
                    
                    downloadResults.push({
                        url: imageUrl,
                        size: imageData.length,
                        sizeMB: parseFloat(sizeMB)
                    });
                    
                    // Save sample image
                    const filename = `${manifest.displayName.replace(/[^a-z0-9]/gi, '_')}_page_${i + 1}.jpg`;
                    await fs.writeFile(path.join(testDir, filename), imageData);
                    
                } catch (error) {
                    console.log(`    ✗ Failed: ${error.message}`);
                    downloadResults.push({
                        url: imageUrl,
                        error: error.message
                    });
                }
            }
            
            // Calculate average size
            const successfulDownloads = downloadResults.filter(r => !r.error);
            const avgSizeMB = successfulDownloads.length > 0 
                ? (successfulDownloads.reduce((sum, r) => sum + r.sizeMB, 0) / successfulDownloads.length).toFixed(2)
                : 0;
            
            results.push({
                url,
                displayName: manifest.displayName,
                totalPages: manifest.totalPages,
                loadTimeMs: loadTime,
                imageStats,
                downloadResults,
                avgImageSizeMB: parseFloat(avgSizeMB),
                success: true
            });
            
            console.log(`\n✅ Test completed for ${manifest.displayName}`);
            console.log(`  Average image size: ${avgSizeMB} MB`);
            
        } catch (error) {
            console.error(`\n❌ Test failed: ${error.message}`);
            results.push({
                url,
                error: error.message,
                success: false
            });
        }
    }
    
    await browser.close();
    
    // Generate summary report
    console.log('\n' + '='.repeat(60));
    console.log('📋 MORGAN LIBRARY TEST SUMMARY');
    console.log('='.repeat(60));
    
    for (const result of results) {
        console.log(`\n${result.success ? '✅' : '❌'} ${result.url}`);
        if (result.success) {
            console.log(`  - Title: ${result.displayName}`);
            console.log(`  - Pages: ${result.totalPages}`);
            console.log(`  - Load time: ${result.loadTimeMs}ms`);
            console.log(`  - Avg image size: ${result.avgImageSizeMB} MB`);
            console.log(`  - Image types: ZIF=${result.imageStats.zif}, Facsimile=${result.imageStats.facsimile}, Full=${result.imageStats.fullSize}`);
        } else {
            console.log(`  - Error: ${result.error}`);
        }
    }
    
    // Save detailed report
    const reportPath = path.join(testDir, 'test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Check if fixes are working correctly
    const allSuccessful = results.every(r => r.success);
    const avgPages = results.filter(r => r.success).reduce((sum, r) => sum + r.totalPages, 0) / results.filter(r => r.success).length;
    const avgSizeOverall = results.filter(r => r.success).reduce((sum, r) => sum + r.avgImageSizeMB, 0) / results.filter(r => r.success).length;
    
    console.log('\n🎯 FIX VALIDATION:');
    console.log(`  1. Size estimation (5MB target): ${avgSizeOverall.toFixed(2)} MB avg - ${avgSizeOverall <= 6 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  2. Page detection (all pages): ${avgPages.toFixed(0)} avg pages - ${avgPages > 16 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  3. High quality images: ${results.some(r => r.success && r.imageStats.zif > 0) ? '✅ ZIF files detected' : '⚠️  No ZIF files'}`);
    console.log(`  4. Overall success: ${allSuccessful ? '✅ All tests passed' : '❌ Some tests failed'}`);
}

function analyzeImageUrls(urls) {
    const stats = {
        zif: 0,
        facsimile: 0,
        fullSize: 0,
        styled: 0,
        other: 0
    };
    
    for (const url of urls) {
        if (url.endsWith('.zif')) {
            stats.zif++;
        } else if (url.includes('/facsimile/')) {
            stats.facsimile++;
        } else if (url.includes('/files/images/collection/')) {
            stats.fullSize++;
        } else if (url.includes('/styles/')) {
            stats.styled++;
        } else {
            stats.other++;
        }
    }
    
    return stats;
}

function downloadImage(url) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }
            
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        }).on('error', reject);
    });
}

// Run the tests
testMorganLibrary().catch(console.error);