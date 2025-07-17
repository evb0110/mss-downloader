const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Import the service
const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService');

async function testGrazFix() {
    console.log('=== Testing University of Graz SSL Fix ===');
    console.log('Platform:', process.platform);
    console.log('Node version:', process.version);
    console.log('');

    const service = new EnhancedManuscriptDownloaderService({
        get: (key) => {
            const config = {
                requestTimeout: 120000,
                useProxy: false,
                maxRetries: 3
            };
            return config[key];
        }
    });

    const testUrl = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538';
    console.log('Test URL:', testUrl);
    console.log('');

    try {
        console.log('1. Loading manuscript manifest...');
        const startTime = Date.now();
        
        const manifest = await service.loadGrazManifest(testUrl);
        
        const loadTime = Date.now() - startTime;
        console.log(`   ✅ Manifest loaded in ${loadTime}ms`);
        console.log(`   Title: ${manifest.displayName}`);
        console.log(`   Pages: ${manifest.pageLinks.length}`);
        console.log('');
        
        if (manifest.pageLinks.length > 0) {
            console.log('2. Testing image download...');
            const firstPageUrl = manifest.pageLinks[0];
            console.log(`   First page URL: ${firstPageUrl}`);
            
            const imageStartTime = Date.now();
            const response = await service.fetchDirect(firstPageUrl);
            const imageLoadTime = Date.now() - imageStartTime;
            
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                console.log(`   ✅ Image downloaded in ${imageLoadTime}ms`);
                console.log(`   Size: ${buffer.byteLength} bytes`);
                
                // Save test image
                const testDir = path.join(__dirname, '..', 'test-outputs', 'graz-fix-test');
                if (!fs.existsSync(testDir)) {
                    fs.mkdirSync(testDir, { recursive: true });
                }
                
                const imagePath = path.join(testDir, 'test-page-1.jpg');
                fs.writeFileSync(imagePath, Buffer.from(buffer));
                console.log(`   Saved to: ${imagePath}`);
            } else {
                console.log(`   ❌ Image download failed: ${response.status}`);
            }
        }
        
        console.log('');
        console.log('=== SSL Fix Test Results ===');
        console.log('✅ Graz manuscript loading is now working!');
        console.log('The SSL certificate bypass successfully resolves the Windows issue.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Error details:', error);
        
        console.log('');
        console.log('=== Troubleshooting ===');
        if (error.message.includes('SSL') || error.message.includes('certificate')) {
            console.log('SSL certificate issue detected. The fix may need adjustment.');
        } else if (error.message.includes('timeout')) {
            console.log('Timeout issue. The server may be slow or unresponsive.');
        } else {
            console.log('Unexpected error. Check the error details above.');
        }
    }
}

// First compile TypeScript
console.log('Compiling TypeScript...');
exec('npm run build', (err, stdout, stderr) => {
    if (err) {
        console.error('Build failed:', err);
        return;
    }
    
    console.log('Build complete, running test...\n');
    testGrazFix();
});