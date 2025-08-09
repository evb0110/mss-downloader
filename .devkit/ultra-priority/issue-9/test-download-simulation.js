const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');
const fs = require('fs');
const path = require('path');
const https = require('https');

async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0' },
            rejectUnauthorized: false 
        }, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                const stats = fs.statSync(filepath);
                resolve(stats.size);
            });
        }).on('error', reject);
    });
}

async function testFullDownload() {
    console.log('🔬 ULTRA-DEEP BDL Download Test...\n');
    const loaders = new SharedManifestLoaders();
    const url = 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903';
    
    try {
        console.log('📊 Fetching manifest...');
        const manifest = await loaders.getManifestForLibrary('bdl', url);
        console.log(`✅ Found ${manifest.images.length} images in manifest\n`);
        
        // Test download of 20 random pages
        const testPages = [];
        const pageCount = Math.min(20, manifest.images.length);
        
        // Get random sample of pages
        for (let i = 0; i < pageCount; i++) {
            const pageIndex = Math.floor(Math.random() * manifest.images.length);
            if (!testPages.includes(pageIndex)) {
                testPages.push(pageIndex);
            }
        }
        
        console.log(`📥 Testing download of ${testPages.length} pages...\n`);
        
        let emptyCount = 0;
        let successCount = 0;
        let failCount = 0;
        
        for (const pageIndex of testPages.sort((a, b) => a - b)) {
            const imageUrl = manifest.images[pageIndex].url;
            const filename = `test-page-${pageIndex + 1}.jpg`;
            const filepath = path.join('.', filename);
            
            try {
                process.stdout.write(`Page ${pageIndex + 1}: `);
                const size = await downloadImage(imageUrl, filepath);
                
                if (size === 0) {
                    console.log(`❌ EMPTY (0 bytes)`);
                    emptyCount++;
                } else if (size < 1000) {
                    console.log(`⚠️ SUSPICIOUS (${size} bytes - too small)`);
                    emptyCount++;
                } else {
                    console.log(`✅ OK (${(size / 1024).toFixed(1)} KB)`);
                    successCount++;
                }
                
                // Clean up
                fs.unlinkSync(filepath);
            } catch (error) {
                console.log(`❌ FAILED: ${error.message}`);
                failCount++;
            }
        }
        
        console.log('\n📊 SUMMARY:');
        console.log(`  ✅ Successful: ${successCount}/${testPages.length}`);
        console.log(`  ❌ Empty/Small: ${emptyCount}/${testPages.length}`);
        console.log(`  ❌ Failed: ${failCount}/${testPages.length}`);
        
        if (emptyCount > 0) {
            console.log('\n⚠️ ISSUE CONFIRMED: Some pages download as empty!');
            console.log('This matches user report: "много пустых страниц при скачивании"');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testFullDownload();