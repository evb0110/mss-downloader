
const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService.js');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

async function downloadImage(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            rejectUnauthorized: false
        };
        
        https.get(options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

async function test() {
    const service = new EnhancedManuscriptDownloaderService();
    const startTime = Date.now();
    
    console.log('Loading BNE manifest...');
    const manifest = await service.loadBneManifest('https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1');
    
    const loadTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Manifest loaded in ${loadTime} seconds`);
    console.log(`📄 Total pages: ${manifest.totalPages}`);
    console.log(`📚 Title: ${manifest.displayName}`);
    
    // Download first 10 pages for validation
    const pagesToTest = Math.min(10, manifest.pageLinks.length);
    console.log(`\n📥 Downloading ${pagesToTest} pages for validation...`);
    
    for (let i = 0; i < pagesToTest; i++) {
        const pageUrl = manifest.pageLinks[i];
        console.log(`  Downloading page ${i + 1}...`);
        
        try {
            const pdfData = await downloadImage(pageUrl);
            const pdfPath = path.join('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/bne-validation-1752693564180', `bne_page_${i + 1}.pdf`);
            await fs.writeFile(pdfPath, pdfData);
            console.log(`  ✅ Page ${i + 1} downloaded: ${(pdfData.length / 1024 / 1024).toFixed(2)} MB`);
        } catch (error) {
            console.log(`  ❌ Page ${i + 1} failed: ${error.message}`);
        }
    }
    
    return manifest;
}

test().then(manifest => {
    console.log('\n✅ BNE validation completed successfully');
    console.log(JSON.stringify({ success: true, totalPages: manifest.totalPages }));
}).catch(error => {
    console.error('\n❌ BNE validation failed:', error.message);
    console.log(JSON.stringify({ success: false, error: error.message }));
});
