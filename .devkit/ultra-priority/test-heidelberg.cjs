#!/usr/bin/env node

/**
 * ULTRA-PRIORITY TEST: Heidelberg Library Implementation
 * Issue #19 - Deep validation of Heidelberg support
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const fs = require('fs');
const path = require('path');
const https = require('https');

console.log('🔥 ULTRA-PRIORITY HEIDELBERG TEST INITIATED 🔥');
console.log('='.repeat(60));

const loaders = new SharedManifestLoaders();

// Test URLs from the issue
const testUrls = [
    'https://digi.ub.uni-heidelberg.de/diglit/salVIII2',  // Original viewer URL from issue
    'https://digi.ub.uni-heidelberg.de/diglit/salVIII2/0001/image,info,thumbs',  // Page URL
    'https://doi.org/10.11588/diglit.7292#0001',  // DOI URL
    'https://digi.ub.uni-heidelberg.de/diglit/iiif3/salVIII2/manifest',  // IIIF v3 manifest
    'https://digi.ub.uni-heidelberg.de/diglit/iiif/salVIII2/manifest'  // IIIF v2 manifest
];

async function downloadImage(url, filename) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filename);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                https.get(response.headers.location, (redirectResponse) => {
                    redirectResponse.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve(fs.statSync(filename).size);
                    });
                }).on('error', reject);
            } else {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(fs.statSync(filename).size);
                });
            }
        }).on('error', reject);
    });
}

async function testUrl(url, index) {
    console.log(`\n📊 Test ${index + 1}: ${url}`);
    console.log('-'.repeat(60));
    
    try {
        // Test manifest loading
        console.log('🔄 Loading manifest...');
        const startTime = Date.now();
        const manifest = await loaders.getHeidelbergManifest(url);
        const loadTime = Date.now() - startTime;
        
        console.log(`✅ Manifest loaded in ${loadTime}ms`);
        console.log(`📚 Title: ${manifest.displayName}`);
        console.log(`📄 Pages: ${manifest.images.length}`);
        console.log(`🏛️ Library: ${manifest.metadata.library}`);
        console.log(`📋 IIIF Version: ${manifest.metadata.iiifVersion}`);
        
        // Test image quality
        if (manifest.images.length > 0) {
            console.log('\n🔬 Testing image quality:');
            
            // Test first, middle, and last pages
            const testPages = [
                { index: 0, name: 'First' },
                { index: Math.floor(manifest.images.length / 2), name: 'Middle' },
                { index: manifest.images.length - 1, name: 'Last' }
            ];
            
            for (const { index, name } of testPages) {
                const image = manifest.images[index];
                console.log(`  - ${name} page (${index + 1}): ${image.url}`);
                
                // Check resolution from URL
                const resMatch = image.url.match(/\/full\/(\d+,\d+|full|max)\//);
                if (resMatch) {
                    console.log(`    Resolution: ${resMatch[1]}`);
                }
                
                // Try to get actual dimensions
                if (image.url.includes('/info.json')) {
                    try {
                        const infoUrl = image.url.replace(/\/full\/.*$/, '/info.json');
                        const infoResponse = await fetch(infoUrl);
                        const info = await infoResponse.json();
                        console.log(`    Actual dimensions: ${info.width} x ${info.height} pixels`);
                    } catch (e) {
                        // Ignore info.json errors
                    }
                }
            }
            
            // Download sample pages for validation
            console.log('\n📥 Downloading sample pages for validation:');
            const outputDir = path.join(__dirname, 'validation');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            
            for (let i = 0; i < Math.min(5, manifest.images.length); i++) {
                const outputFile = path.join(outputDir, `heidelberg_page_${i + 1}.jpg`);
                try {
                    const size = await downloadImage(manifest.images[i].url, outputFile);
                    console.log(`  ✅ Page ${i + 1}: ${(size / 1024 / 1024).toFixed(2)} MB`);
                } catch (error) {
                    console.log(`  ❌ Page ${i + 1}: Download failed - ${error.message}`);
                }
            }
        }
        
        return { success: true, manifest };
        
    } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function runAllTests() {
    console.log('\n🚀 Starting comprehensive Heidelberg tests');
    console.log('Testing all URL patterns from Issue #19');
    
    const results = [];
    for (let i = 0; i < testUrls.length; i++) {
        const result = await testUrl(testUrls[i], i);
        results.push({ url: testUrls[i], ...result });
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 ULTRA-PRIORITY TEST SUMMARY');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    
    if (failed.length > 0) {
        console.log('\n⚠️ Failed URLs:');
        failed.forEach(r => {
            console.log(`  - ${r.url}`);
            console.log(`    Error: ${r.error}`);
        });
    }
    
    // Check if all successful manifests have the same content
    if (successful.length > 1) {
        const pageCount = successful[0].manifest.images.length;
        const allSame = successful.every(r => r.manifest.images.length === pageCount);
        
        if (allSame) {
            console.log(`\n✅ CONSISTENCY CHECK: All successful URLs returned ${pageCount} pages`);
        } else {
            console.log('\n⚠️ CONSISTENCY WARNING: Different page counts detected');
            successful.forEach(r => {
                console.log(`  - ${r.url}: ${r.manifest.images.length} pages`);
            });
        }
    }
    
    // Final verdict
    console.log('\n' + '='.repeat(60));
    if (successful.length > 0 && successful.some(r => r.url === testUrls[0])) {
        console.log('🎯 VERDICT: Heidelberg library IS WORKING!');
        console.log('The exact user URL is being handled correctly.');
    } else {
        console.log('🚨 VERDICT: Heidelberg library NEEDS FIXING!');
        console.log('The user\'s original URL is not working properly.');
    }
    console.log('='.repeat(60));
}

// Run the tests
runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});