const https = require('https');
const fs = require('fs');
const path = require('path');

async function testImageUrl(baseUrl, imageId, params = {}) {
    const queryString = Object.keys(params).map(key => `${key}=${params[key]}`).join('&');
    const url = `${baseUrl}?id=${imageId}${queryString ? '&' + queryString : ''}`;
    
    console.log(`Testing: ${url}`);
    
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000651'
            }
        }, (res) => {
            let data = Buffer.alloc(0);
            
            res.on('data', chunk => {
                data = Buffer.concat([data, chunk]);
            });
            
            res.on('end', () => {
                const result = {
                    url,
                    statusCode: res.statusCode,
                    contentType: res.headers['content-type'],
                    contentLength: data.length,
                    headers: res.headers,
                    isImage: res.headers['content-type'] && res.headers['content-type'].startsWith('image/'),
                    data: data
                };
                
                console.log(`  Status: ${res.statusCode}`);
                console.log(`  Content-Type: ${res.headers['content-type']}`);
                console.log(`  Content-Length: ${data.length}`);
                console.log(`  Is Image: ${result.isImage}`);
                
                resolve(result);
            });
        });
        
        req.on('error', (err) => {
            console.error(`Error testing ${url}:`, err.message);
            reject(err);
        });
        
        req.setTimeout(15000, () => {
            console.error(`Timeout testing ${url}`);
            req.destroy();
            reject(new Error('Timeout'));
        });
        
        req.end();
    });
}

async function testBVPBImageAccess() {
    console.log('Testing BVPB image access patterns...');
    
    // Test different image endpoints we found
    const baseUrls = [
        'https://bvpb.mcu.es/es/media/object-miniature.do',
        'https://bvpb.mcu.es/media/object-miniature.do',
        'https://bvpb.mcu.es/es/media/object.do',
        'https://bvpb.mcu.es/media/object.do'
    ];
    
    const testImageIds = [
        '101185401', // First image from the sample
        '101185402', // Second image
        '101185403'  // Third image
    ];
    
    const results = [];
    
    for (const baseUrl of baseUrls) {
        for (const imageId of testImageIds) {
            try {
                // Test base URL first
                const result = await testImageUrl(baseUrl, imageId);
                results.push(result);
                
                // If we get an image, test different size parameters
                if (result.isImage && result.statusCode === 200) {
                    console.log(`  ✓ Found working image endpoint: ${baseUrl}`);
                    
                    // Test different size parameters
                    const sizeParams = [
                        { size: 'large' },
                        { size: 'medium' },
                        { size: 'small' },
                        { width: '1000' },
                        { height: '1000' },
                        { width: '2000' },
                        { height: '2000' },
                        { width: '4000' },
                        { height: '4000' },
                        { scale: '1.0' },
                        { scale: '2.0' },
                        { quality: 'max' },
                        { quality: 'high' },
                        { format: 'jpg' },
                        { format: 'png' },
                        { format: 'tiff' }
                    ];
                    
                    for (const params of sizeParams) {
                        try {
                            const sizeResult = await testImageUrl(baseUrl, imageId, params);
                            if (sizeResult.isImage && sizeResult.statusCode === 200) {
                                console.log(`    ✓ Size param works: ${Object.keys(params)[0]}=${Object.values(params)[0]} (${sizeResult.contentLength} bytes)`);
                                results.push(sizeResult);
                            }
                        } catch (error) {
                            // Silent fail for size tests
                        }
                    }
                    
                    // Save a sample image
                    if (result.data && result.data.length > 0) {
                        const filename = `.devkit/temp/bvpb-sample-${imageId}.jpg`;
                        fs.writeFileSync(filename, result.data);
                        console.log(`    Sample image saved: ${filename}`);
                    }
                }
                
                // Wait between requests
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`Failed to test ${baseUrl} with ID ${imageId}:`, error.message);
            }
        }
    }
    
    // Save results
    const analysisResults = results.map(r => ({
        url: r.url,
        statusCode: r.statusCode,
        contentType: r.contentType,
        contentLength: r.contentLength,
        isImage: r.isImage,
        headers: r.headers
    }));
    
    fs.writeFileSync('.devkit/reports/bvpb-image-test-results.json', JSON.stringify(analysisResults, null, 2));
    
    console.log('\n=== BVPB IMAGE TEST COMPLETE ===');
    console.log(`Tested ${results.length} different combinations`);
    console.log('Results saved to .devkit/reports/bvpb-image-test-results.json');
    
    const workingImages = results.filter(r => r.isImage && r.statusCode === 200);
    console.log(`Found ${workingImages.length} working image URLs`);
    
    if (workingImages.length > 0) {
        console.log('\nWorking image endpoints:');
        workingImages.forEach(img => {
            console.log(`  ${img.url} (${img.contentLength} bytes)`);
        });
    }
    
    return analysisResults;
}

testBVPBImageAccess().catch(console.error);