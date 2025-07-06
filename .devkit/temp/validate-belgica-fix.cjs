const fs = require('fs');
const path = require('path');

async function validateBelgicaFix() {
    try {
        console.log('=== VALIDATING BELGICA KBR FIX ===');
        
        const testUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
        console.log('Test URL:', testUrl);
        
        // Step 1: Verify the implementation follows the correct flow
        console.log('\n1. Verifying document page access...');
        
        const docResponse = await fetch(testUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1'
            }
        });
        
        if (!docResponse.ok) {
            throw new Error(`Document page failed: ${docResponse.status}`);
        }
        
        const cookies = docResponse.headers.get('set-cookie');
        const docHtml = await docResponse.text();
        const uurlMatch = docHtml.match(/https:\/\/uurl\.kbr\.be\/(\d+)/);
        
        if (!uurlMatch) {
            throw new Error('Could not find UURL in document page');
        }
        
        console.log('✓ Document page accessible, UURL found:', uurlMatch[0]);
        console.log('✓ Session cookies obtained:', cookies ? 'Yes' : 'No');
        
        // Step 2: Verify UURL access
        console.log('\n2. Verifying UURL page access...');
        
        const uurlResponse = await fetch(uurlMatch[0], {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'cross-site',
                'Referer': testUrl,
                'Cookie': cookies || ''
            }
        });
        
        if (!uurlResponse.ok) {
            throw new Error(`UURL page failed: ${uurlResponse.status}`);
        }
        
        const uurlHtml = await uurlResponse.text();
        const mapMatch = uurlHtml.match(/map=([^"'&]+)/);
        
        if (!mapMatch) {
            throw new Error('Could not find map parameter in UURL page');
        }
        
        const mapPath = mapMatch[1];
        console.log('✓ UURL page accessible, map path found:', mapPath);
        
        // Step 3: Verify gallery access
        console.log('\n3. Verifying gallery page access...');
        
        const galleryUrl = `https://viewerd.kbr.be/gallery.php?map=${mapPath}`;
        const galleryResponse = await fetch(galleryUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'iframe',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'cross-site',
                'Referer': uurlMatch[0],
                'Cookie': cookies || ''
            }
        });
        
        if (!galleryResponse.ok) {
            throw new Error(`Gallery page failed: ${galleryResponse.status}`);
        }
        
        console.log('✓ Gallery page accessible');
        
        // Step 4: Test image patterns
        console.log('\n4. Testing image patterns...');
        
        const imagePatterns = [
            { name: '4-digit', format: (n) => `BE-KBR00_${n.toString().padStart(4, '0')}.jpg` },
            { name: '3-digit', format: (n) => `BE-KBR00_${n.toString().padStart(3, '0')}.jpg` },
            { name: '2-digit', format: (n) => `BE-KBR00_${n.toString().padStart(2, '0')}.jpg` },
            { name: '1-digit', format: (n) => `BE-KBR00_${n.toString()}.jpg` },
        ];
        
        let workingPattern = null;
        let workingImages = [];
        
        for (const pattern of imagePatterns) {
            const firstImageName = pattern.format(1);
            const testImageUrl = `https://viewerd.kbr.be/display/${mapPath}${firstImageName}`;
            
            console.log(`Testing ${pattern.name} pattern: ${firstImageName}`);
            
            try {
                const testResponse = await fetch(testImageUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'DNT': '1',
                        'Connection': 'keep-alive',
                        'Sec-Fetch-Dest': 'image',
                        'Sec-Fetch-Mode': 'no-cors',
                        'Sec-Fetch-Site': 'same-origin',
                        'Referer': galleryUrl,
                        'Cookie': cookies || ''
                    }
                });
                
                if (testResponse.ok) {
                    const imageData = await testResponse.arrayBuffer();
                    if (imageData.byteLength > 1000) {
                        console.log(`✓ Working pattern found: ${pattern.name} (${imageData.byteLength} bytes)`);
                        workingPattern = pattern;
                        workingImages.push({ name: firstImageName, size: imageData.byteLength });
                        
                        // Save the first working image for later inspection
                        if (workingImages.length === 1) {
                            fs.writeFileSync('.devkit/temp/belgica-validation-page1.jpg', Buffer.from(imageData));
                            console.log('  ✓ Saved first image for inspection');
                        }
                        
                        break;
                    }
                } else {
                    console.log(`✗ ${pattern.name}: HTTP ${testResponse.status}`);
                }
            } catch (error) {
                console.log(`✗ ${pattern.name}: Error - ${error.message}`);
            }
            
            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        if (!workingPattern) {
            throw new Error('No working image patterns found');
        }
        
        // Step 5: Test multiple images
        console.log('\n5. Testing image sequence...');
        
        const maxTestImages = 10;
        for (let i = 2; i <= maxTestImages; i++) {
            const imageName = workingPattern.format(i);
            const imageUrl = `https://viewerd.kbr.be/display/${mapPath}${imageName}`;
            
            try {
                const imageResponse = await fetch(imageUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'DNT': '1',
                        'Connection': 'keep-alive',
                        'Sec-Fetch-Dest': 'image',
                        'Sec-Fetch-Mode': 'no-cors',
                        'Sec-Fetch-Site': 'same-origin',
                        'Referer': galleryUrl,
                        'Cookie': cookies || ''
                    }
                });
                
                if (imageResponse.ok) {
                    const imageData = await imageResponse.arrayBuffer();
                    if (imageData.byteLength > 1000) {
                        workingImages.push({ name: imageName, size: imageData.byteLength });
                        console.log(`✓ Page ${i}: ${imageName} (${imageData.byteLength} bytes)`);
                        
                        // Save a few more images for validation
                        if (i <= 3) {
                            fs.writeFileSync(`.devkit/temp/belgica-validation-page${i}.jpg`, Buffer.from(imageData));
                        }
                    } else {
                        console.log(`✗ Page ${i}: Image too small (${imageData.byteLength} bytes)`);
                        break;
                    }
                } else if (imageResponse.status === 404) {
                    console.log(`✓ Page ${i}: 404 Not Found (end of manuscript)`);
                    break;
                } else {
                    console.log(`✗ Page ${i}: HTTP ${imageResponse.status}`);
                    break;
                }
            } catch (error) {
                console.log(`✗ Page ${i}: Error - ${error.message}`);
                break;
            }
            
            // Throttle requests
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        console.log('\n=== VALIDATION RESULTS ===');
        console.log(`✓ Document access: Working`);
        console.log(`✓ UURL extraction: Working`);
        console.log(`✓ Map path extraction: Working`);
        console.log(`✓ Gallery access: Working`);
        console.log(`✓ Image pattern: ${workingPattern.name}`);
        console.log(`✓ Images found: ${workingImages.length}`);
        console.log(`✓ Sample images saved to .devkit/temp/`);
        
        // Test if we can detect high resolution
        const avgImageSize = workingImages.reduce((sum, img) => sum + img.size, 0) / workingImages.length;
        console.log(`✓ Average image size: ${Math.round(avgImageSize / 1024)} KB`);
        
        if (avgImageSize > 500000) {
            console.log(`✓ HIGH RESOLUTION: Images appear to be high resolution (>500KB average)`);
        } else if (avgImageSize > 100000) {
            console.log(`✓ MEDIUM RESOLUTION: Images appear to be medium resolution (>100KB average)`);
        } else {
            console.log(`⚠ LOW RESOLUTION: Images appear to be low resolution (<100KB average)`);
        }
        
        return {
            success: true,
            mapPath,
            workingPattern: workingPattern.name,
            imagesFound: workingImages.length,
            avgImageSize: Math.round(avgImageSize),
            galleryUrl,
            sampleImages: workingImages.slice(0, 3)
        };
        
    } catch (error) {
        console.error('\n=== VALIDATION FAILED ===');
        console.error('Error:', error.message);
        
        return {
            success: false,
            error: error.message
        };
    }
}

validateBelgicaFix().then(result => {
    console.log('\n=== FINAL VALIDATION RESULT ===');
    if (result.success) {
        console.log('✓ BELGICA KBR FIX VALIDATION PASSED');
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log('✗ BELGICA KBR FIX VALIDATION FAILED');
        console.log('Error:', result.error);
    }
}).catch(error => {
    console.error('Unexpected validation error:', error);
});