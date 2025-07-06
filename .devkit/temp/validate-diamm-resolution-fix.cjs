const https = require('https');
const fs = require('fs');
const { exec } = require('child_process');

console.log('🔧 Validating DIAMM resolution fix...');

// Test the manifest loading to verify our fix
const manifestUrl = 'https://iiif.diamm.net/manifests/I-Rc-Ms-1907/manifest.json';

console.log('1. Loading DIAMM manifest...');
console.log('   URL:', manifestUrl);

https.get(manifestUrl, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const manifest = JSON.parse(data);
            console.log('✅ Manifest loaded successfully');
            console.log('   Type:', manifest['@type']);
            console.log('   Label:', manifest.label);
            console.log('   Total canvases:', manifest.sequences[0].canvases.length);
            
            // Extract the first few image URLs and check their resolution
            const canvases = manifest.sequences[0].canvases.slice(0, 3);
            
            console.log('\\n2. Checking image URLs...');
            
            canvases.forEach((canvas, index) => {
                console.log(`\\nCanvas ${index + 1}:`);
                console.log('   Label:', canvas.label);
                console.log('   Canvas size:', `${canvas.width}x${canvas.height}`);
                
                if (canvas.images && canvas.images[0]) {
                    const image = canvas.images[0];
                    const resource = image.resource;
                    
                    console.log('   Resource ID:', resource['@id']);
                    console.log('   Resource size:', `${resource.width}x${resource.height}`);
                    
                    if (resource.service && resource.service['@id']) {
                        const serviceId = resource.service['@id'];
                        
                        // Test different resolution URLs
                        const testUrls = [
                            { name: 'full/full', url: `${serviceId}/full/full/0/default.jpg` },
                            { name: 'full/max', url: `${serviceId}/full/max/0/default.jpg` },
                            { name: 'current', url: resource['@id'] }
                        ];
                        
                        console.log('   Available resolutions:');
                        testUrls.forEach(test => {
                            console.log(`     ${test.name}: ${test.url}`);
                        });
                        
                        // The fix should use full/full for maximum resolution
                        const fixedUrl = `${serviceId}/full/full/0/default.jpg`;
                        console.log('   ✅ FIXED URL (full/full):', fixedUrl);
                    }
                }
            });
            
            console.log('\\n3. Testing image download sizes...');
            
            // Test the first image with different resolutions
            const firstCanvas = canvases[0];
            if (firstCanvas.images && firstCanvas.images[0] && firstCanvas.images[0].resource.service) {
                const serviceId = firstCanvas.images[0].resource.service['@id'];
                
                const testUrls = [
                    { name: 'full/full (FIXED)', url: `${serviceId}/full/full/0/default.jpg` },
                    { name: 'full/max (OLD)', url: `${serviceId}/full/max/0/default.jpg` }
                ];
                
                testImageSizes(testUrls);
            }
            
        } catch (error) {
            console.error('❌ Error parsing manifest:', error.message);
        }
    });
}).on('error', (error) => {
    console.error('❌ Error fetching manifest:', error.message);
});

async function testImageSizes(testUrls) {
    console.log('\\n   Testing image sizes with HEAD requests...');
    
    for (const test of testUrls) {
        try {
            await testImageSize(test);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between requests
        } catch (error) {
            console.log(`     ❌ ${test.name}: Error - ${error.message}`);
        }
    }
    
    console.log('\\n🎯 SUMMARY:');
    console.log('   The fix changes DIAMM URLs from /full/max/ to /full/full/');
    console.log('   This should provide maximum resolution images (3640x5000 pixels)');
    console.log('   File sizes should be several MB per page instead of ~200KB');
}

function testImageSize(test) {
    return new Promise((resolve, reject) => {
        const cmd = `curl -I -s -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${test.url}" --max-time 15`;
        
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            
            // Parse headers
            const lines = stdout.split('\\n');
            let httpStatus = '';
            let contentLength = '';
            let contentDisposition = '';
            
            for (const line of lines) {
                if (line.startsWith('HTTP/')) {
                    httpStatus = line.trim();
                } else if (line.toLowerCase().startsWith('content-length:')) {
                    contentLength = line.split(':')[1].trim();
                } else if (line.toLowerCase().startsWith('content-disposition:')) {
                    contentDisposition = line.split(':')[1].trim();
                }
            }
            
            if (httpStatus.includes('200')) {
                const sizeKB = contentLength ? Math.round(parseInt(contentLength) / 1024) : 'unknown';
                console.log(`     ✅ ${test.name}: ${sizeKB}KB`);
                
                if (contentDisposition) {
                    const dimensionsMatch = contentDisposition.match(/(\\d+)x(\\d+)/);
                    if (dimensionsMatch) {
                        console.log(`        Dimensions: ${dimensionsMatch[1]}x${dimensionsMatch[2]} pixels`);
                    }
                }
            } else {
                console.log(`     ⚠️  ${test.name}: ${httpStatus}`);
            }
            
            resolve();
        });
    });
}

console.log('\\n📋 NEXT STEPS:');
console.log('1. Review the output above to confirm the fix is working');
console.log('2. Test the app manually with the problematic URL');
console.log('3. Create a validation PDF to confirm file sizes are correct');
console.log('4. Run the validation protocol if results look good');