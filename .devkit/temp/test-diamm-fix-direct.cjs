const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Direct test of the DIAMM fix
console.log('🔧 Testing DIAMM fix directly...');

const testCode = `
const { EnhancedManuscriptDownloaderService } = require('./dist/main/services/EnhancedManuscriptDownloaderService.js');

async function testDiammResolution() {
    console.log('=== DIAMM Resolution Test ===');
    
    try {
        const service = new EnhancedManuscriptDownloaderService();
        const testUrl = 'https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Rc-Ms-1907%2Fmanifest.json';
        
        console.log('Loading manifest from:', testUrl);
        
        const manifest = await service.loadManifest(testUrl);
        
        console.log('✅ Manifest loaded successfully');
        console.log('Library:', manifest.library);
        console.log('Display Name:', manifest.displayName);
        console.log('Total Pages:', manifest.totalPages);
        
        if (manifest.pageLinks && manifest.pageLinks.length > 0) {
            console.log('\\nFirst 3 page URLs:');
            for (let i = 0; i < Math.min(3, manifest.pageLinks.length); i++) {
                console.log(\`  \${i + 1}. \${manifest.pageLinks[i]}\`);
                
                // Check resolution format
                const url = manifest.pageLinks[i];
                if (url.includes('/full/full/')) {
                    console.log('     ✅ Using full/full resolution (CORRECT)');
                } else if (url.includes('/full/max/')) {
                    console.log('     ⚠️  Using full/max resolution (NEEDS FIX)');
                } else {
                    console.log('     ❓ Using unknown resolution format');
                }
            }
            
            // Test downloading one image to verify file size
            console.log('\\n=== Testing Image Download ===');
            const firstImageUrl = manifest.pageLinks[0];
            console.log('Testing URL:', firstImageUrl);
            
            try {
                const imageBuffer = await service.downloadImageWithRetries(firstImageUrl);
                const sizeKB = Math.round(imageBuffer.byteLength / 1024);
                console.log(\`✅ Image downloaded successfully: \${sizeKB}KB\`);
                
                // Check if the size is reasonable for a high-resolution manuscript page
                if (sizeKB > 1000) {
                    console.log('✅ File size looks good for high-resolution image');
                } else {
                    console.log('⚠️  File size might be too small for high-resolution');
                }
            } catch (downloadError) {
                console.error('❌ Error downloading image:', downloadError.message);
            }
        } else {
            console.log('❌ No page links found in manifest');
        }
        
    } catch (error) {
        console.error('❌ Error loading manifest:', error.message);
        console.error('Stack:', error.stack);
    }
}

testDiammResolution().catch(console.error);
`;

fs.writeFileSync('/tmp/test-diamm-direct.js', testCode);

console.log('Running direct test...');
const testProcess = spawn('node', ['/tmp/test-diamm-direct.js'], {
    cwd: '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader',
    stdio: 'inherit'
});

testProcess.on('close', (code) => {
    console.log(`\nTest completed with code: ${code}`);
    
    // Clean up
    fs.unlinkSync('/tmp/test-diamm-direct.js');
    
    if (code === 0) {
        console.log('✅ DIAMM fix test completed successfully');
    } else {
        console.log('❌ DIAMM fix test failed');
    }
});