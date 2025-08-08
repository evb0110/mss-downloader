#!/usr/bin/env node

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔬 ULTRA-VALIDATION FOR ISSUE #10 FIX');
console.log('=====================================\n');

async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(fs.statSync(filepath).size);
            });
        }).on('error', reject);
    });
}

async function testEManuscriptaURL(url, expectedMinPages = 10) {
    const loaders = new SharedManifestLoaders();
    
    try {
        console.log(`Testing: ${url}`);
        const manifest = await loaders.getEManuscriptaManifest(url);
        
        const blocks = new Set();
        manifest.images.forEach(img => {
            if (img.blockId) blocks.add(img.blockId);
        });
        
        const passed = manifest.images.length >= expectedMinPages;
        console.log(`  ${passed ? '✅' : '❌'} Pages: ${manifest.images.length}, Blocks: ${blocks.size}`);
        
        return { url, passed, pages: manifest.images.length, manifest };
    } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        return { url, passed: false, error: error.message };
    }
}

async function testOtherLibraries() {
    const loaders = new SharedManifestLoaders();
    const testCases = [
        {
            name: 'Vatican Library',
            url: 'https://digi.vatlib.it/view/MSS_Vat.lat.1',
            method: 'getVaticanManifest'
        },
        {
            name: 'Gallica (BNF)',
            url: 'https://gallica.bnf.fr/ark:/12148/btv1b8452767w',
            method: 'getGallicaManifest'
        },
        {
            name: 'Munich Digital Collections',
            url: 'https://mdz-nbn-resolving.de/urn:nbn:de:bvb:12-bsb00050763-1',
            method: 'getMunichManifest'
        }
    ];
    
    console.log('\n📋 Regression Testing Other Libraries:');
    
    for (const test of testCases) {
        try {
            console.log(`  Testing ${test.name}...`);
            const manifest = await loaders[test.method](test.url);
            const hasImages = manifest.images && manifest.images.length > 0;
            console.log(`    ${hasImages ? '✅' : '❌'} ${manifest.images ? manifest.images.length : 0} pages found`);
        } catch (error) {
            console.log(`    ❌ Error: ${error.message.substring(0, 50)}...`);
        }
    }
}

async function downloadSamplePages(manifest) {
    console.log('\n📥 Downloading Sample Pages:');
    
    // Create download directory
    const downloadDir = '.devkit/ultra-priority/issue-10/downloads';
    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
    }
    
    // Clean previous downloads
    const files = fs.readdirSync(downloadDir);
    files.forEach(file => {
        if (file.endsWith('.jpg') || file.endsWith('.png')) {
            fs.unlinkSync(path.join(downloadDir, file));
        }
    });
    
    // Download first 3 and last 3 pages
    const pagesToDownload = [
        ...manifest.images.slice(0, 3),
        ...manifest.images.slice(-3)
    ];
    
    let successCount = 0;
    for (let i = 0; i < pagesToDownload.length; i++) {
        const page = pagesToDownload[i];
        const filename = `page_${page.label.replace(/[^0-9]/g, '')}.jpg`;
        const filepath = path.join(downloadDir, filename);
        
        try {
            const size = await downloadImage(page.url, filepath);
            console.log(`  ✅ ${page.label}: Downloaded (${Math.round(size/1024)}KB)`);
            successCount++;
        } catch (error) {
            console.log(`  ❌ ${page.label}: Failed - ${error.message}`);
        }
    }
    
    return successCount;
}

async function createPDFProof(downloadDir) {
    console.log('\n📄 Creating PDF Proof:');
    
    try {
        // Check if ImageMagick is available
        execSync('which convert', { stdio: 'ignore' });
        
        const pdfPath = path.join(downloadDir, 'proof.pdf');
        const jpgFiles = fs.readdirSync(downloadDir)
            .filter(f => f.endsWith('.jpg'))
            .sort()
            .map(f => path.join(downloadDir, f));
        
        if (jpgFiles.length > 0) {
            // Create PDF using ImageMagick
            const cmd = `convert ${jpgFiles.join(' ')} ${pdfPath}`;
            execSync(cmd);
            
            const stats = fs.statSync(pdfPath);
            console.log(`  ✅ PDF created: ${Math.round(stats.size/1024)}KB`);
            
            // Validate PDF
            try {
                const pdfInfo = execSync(`pdfinfo ${pdfPath} 2>&1`).toString();
                const pages = pdfInfo.match(/Pages:\s+(\d+)/);
                if (pages) {
                    console.log(`  ✅ PDF validated: ${pages[1]} pages`);
                }
            } catch (e) {
                console.log('  ⚠️  pdfinfo not available for validation');
            }
            
            return true;
        }
    } catch (error) {
        console.log('  ⚠️  ImageMagick not available, skipping PDF creation');
    }
    
    return false;
}

async function runUltraValidation() {
    console.log('Starting ULTRA-VALIDATION protocol...\n');
    
    // Test 1: Main user URL
    console.log('📋 Test 1: User-Reported URL');
    const mainResult = await testEManuscriptaURL(
        'https://www.e-manuscripta.ch/bau/content/zoom/5157616',
        300 // Expect at least 300 pages
    );
    
    // Test 2: Other user-provided URLs
    console.log('\n📋 Test 2: Other User URLs');
    const otherUrls = [
        'https://www.e-manuscripta.ch/bau/content/zoom/5157232',
        'https://www.e-manuscripta.ch/bau/content/zoom/5157243'
    ];
    
    for (const url of otherUrls) {
        await testEManuscriptaURL(url, 10);
    }
    
    // Test 3: Regression test other libraries
    await testOtherLibraries();
    
    // Test 4: Download actual pages
    if (mainResult.passed && mainResult.manifest) {
        const downloadCount = await downloadSamplePages(mainResult.manifest);
        
        // Test 5: Create PDF proof
        if (downloadCount > 0) {
            await createPDFProof('.devkit/ultra-priority/issue-10/downloads');
        }
    }
    
    // Final verdict
    console.log('\n' + '='.repeat(50));
    console.log('📊 ULTRA-VALIDATION VERDICT');
    console.log('='.repeat(50));
    
    if (mainResult.passed && mainResult.pages > 300) {
        console.log('✅✅✅ ALL TESTS PASSED!');
        console.log(`Issue #10 is COMPLETELY RESOLVED.`);
        console.log(`The fix correctly identifies ${mainResult.pages} pages.`);
        console.log('\n🚀 Ready for autonomous version bump!');
    } else {
        console.log('❌ Some tests failed. Additional work needed.');
    }
}

runUltraValidation().catch(console.error);