const https = require('https');
const fs = require('fs');
const path = require('path');

async function testBVPBImplementation() {
    console.log('🧪 Testing BVPB Implementation...');
    
    const testUrls = [
        'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000651',
        'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=22211',
        'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=10000059'
    ];
    
    for (const url of testUrls) {
        await testSingleManuscript(url);
    }
}

async function testSingleManuscript(url) {
    console.log(`\n=== Testing: ${url} ===`);
    
    try {
        // Extract path ID
        const pathMatch = url.match(/path=([^&]+)/);
        if (!pathMatch) {
            throw new Error('Could not extract path from BVPB URL');
        }
        
        const pathId = pathMatch[1];
        console.log(`✓ Extracted path ID: ${pathId}`);
        
        // Test catalog page access
        console.log('🔍 Testing catalog page access...');
        const catalogUrl = `https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=${pathId}`;
        
        const response = await fetch(catalogUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load catalog page: ${response.status}`);
        }
        
        const html = await response.text();
        console.log(`✓ Catalog page loaded: ${(html.length / 1024).toFixed(2)} KB`);
        
        // Extract image IDs
        console.log('🔍 Extracting image IDs...');
        const imageIds = [];
        const imageIdPattern = /object-miniature\.do\?id=(\d+)/g;
        let match;
        
        while ((match = imageIdPattern.exec(html)) !== null) {
            const imageId = match[1];
            if (!imageIds.includes(imageId)) {
                imageIds.push(imageId);
            }
        }
        
        console.log(`✓ Found ${imageIds.length} unique image IDs`);
        
        if (imageIds.length === 0) {
            throw new Error('No images found for this BVPB manuscript');
        }
        
        // Test first few image downloads (maximum resolution)
        console.log('🔍 Testing high-resolution image downloads...');
        const testImageIds = imageIds.slice(0, Math.min(3, imageIds.length));
        
        for (let i = 0; i < testImageIds.length; i++) {
            const imageId = testImageIds[i];
            console.log(`  Testing image ${i + 1}/${testImageIds.length}: ID ${imageId}`);
            
            // Test full resolution endpoint
            const fullResUrl = `https://bvpb.mcu.es/es/media/object.do?id=${imageId}`;
            
            const imageResponse = await fetch(fullResUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': catalogUrl
                }
            });
            
            if (!imageResponse.ok) {
                console.warn(`    ⚠ Image ${imageId} failed: ${imageResponse.status}`);
                continue;
            }
            
            const imageData = await imageResponse.arrayBuffer();
            const imageSizeKB = (imageData.byteLength / 1024).toFixed(2);
            
            console.log(`    ✓ Image ${imageId}: ${imageSizeKB} KB`);
            
            // Save sample for inspection
            if (i === 0) {
                const samplePath = `.devkit/temp/bvpb-sample-${pathId}-${imageId}.jpg`;
                fs.writeFileSync(samplePath, Buffer.from(imageData));
                console.log(`    ✓ Sample saved: ${samplePath}`);
            }
            
            // Verify it's actually an image
            const contentType = imageResponse.headers.get('content-type');
            if (!contentType?.startsWith('image/')) {
                console.warn(`    ⚠ Unexpected content type: ${contentType}`);
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Extract title
        console.log('🔍 Extracting manuscript title...');
        let pageTitle = 'BVPB Manuscript';
        
        try {
            const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
            if (titleMatch) {
                pageTitle = titleMatch[1]
                    .replace(/Biblioteca Virtual del Patrimonio Bibliográfico[^>]*>\s*/gi, '')
                    .replace(/^\s*Búsqueda[^>]*>\s*/gi, '')
                    .replace(/\s*\(Objetos digitales\)\s*/gi, '')
                    .replace(/&gt;/g, '>')
                    .replace(/&rsaquo;/g, '›')
                    .replace(/&[^;]+;/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim() || pageTitle;
            }
        } catch (titleError) {
            console.warn('Could not extract title:', titleError.message);
        }
        
        console.log(`✓ Manuscript title: "${pageTitle}"`);
        
        // Summary
        console.log(`\n📊 Summary for ${pathId}:`);
        console.log(`  • Title: ${pageTitle}`);
        console.log(`  • Total pages: ${imageIds.length}`);
        console.log(`  • Sample images tested: ${testImageIds.length}`);
        console.log(`  • Status: ✅ READY`);
        
        return {
            pathId,
            title: pageTitle,
            totalPages: imageIds.length,
            tested: testImageIds.length,
            status: 'success'
        };
        
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        return {
            pathId: pathMatch?.[1] || 'unknown',
            error: error.message,
            status: 'failed'
        };
    }
}

// Run the test
testBVPBImplementation()
    .then(() => {
        console.log('\n🎉 BVPB Implementation Test Completed!');
        console.log('\nNext steps:');
        console.log('1. Review sample images in .devkit/temp/');
        console.log('2. Run full validation protocol');
        console.log('3. Test complete PDF download');
    })
    .catch(error => {
        console.error('\n❌ Test suite failed:', error.message);
        process.exit(1);
    });