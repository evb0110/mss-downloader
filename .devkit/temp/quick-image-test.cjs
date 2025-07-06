const https = require('https');
const fs = require('fs');

async function quickImageTest() {
    try {
        console.log('=== QUICK IMAGE TEST ===');
        
        // Get the essential information first
        const documentUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
        const docResponse = await fetch(documentUrl);
        const cookies = docResponse.headers.get('set-cookie');
        const docHtml = await docResponse.text();
        const uurlMatch = docHtml.match(/https:\/\/uurl\.kbr\.be\/(\d+)/);
        
        if (!uurlMatch) {
            throw new Error('Could not find UURL');
        }
        
        const uurlResponse = await fetch(uurlMatch[0], {
            headers: {
                'Referer': documentUrl,
                'Cookie': cookies
            }
        });
        
        const uurlHtml = await uurlResponse.text();
        const mapMatch = uurlHtml.match(/map=([^"'&]+)/);
        
        if (!mapMatch) {
            throw new Error('Could not find map parameter');
        }
        
        const mapPath = mapMatch[1];
        console.log('Map path:', mapPath);
        
        const galleryUrl = `https://viewerd.kbr.be/gallery.php?map=${mapPath}`;
        
        // Test a smaller set of common image names
        const testImages = [
            'BE-KBR00_0001.jpg',
            'BE-KBR00_0002.jpg',
            'BE-KBR00_001.jpg',
            'BE-KBR00_002.jpg',
            'BE-KBR00_01.jpg',
            'BE-KBR00_02.jpg',
            'BE-KBR00_1.jpg',
            'BE-KBR00_2.jpg'
        ];
        
        console.log('Testing common image names...');
        
        for (const imageName of testImages) {
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
                        'Cookie': cookies
                    },
                    signal: AbortSignal.timeout(5000) // 5 second timeout
                });
                
                console.log(`${imageName}: ${imageResponse.status}`);
                
                if (imageResponse.ok) {
                    const imageData = await imageResponse.arrayBuffer();
                    console.log(`SUCCESS: ${imageName} - ${imageData.byteLength} bytes`);
                    
                    // Save the first successful image
                    if (imageData.byteLength > 1000) {
                        fs.writeFileSync('.devkit/temp/belgica-working-image.jpg', Buffer.from(imageData));
                        console.log('Saved working image');
                        
                        // Try to find a few more images to confirm the pattern
                        const basePattern = imageName.replace(/\d+\.jpg$/, '');
                        const numberMatch = imageName.match(/(\d+)\.jpg$/);
                        
                        if (numberMatch) {
                            const startNumber = parseInt(numberMatch[1]);
                            const workingImages = [imageName];
                            
                            console.log(`Found working image ${imageName}, testing pattern...`);
                            
                            // Test next few images
                            for (let i = startNumber + 1; i <= startNumber + 10; i++) {
                                const paddedNumber = i.toString().padStart(numberMatch[1].length, '0');
                                const testImageName = `${basePattern}${paddedNumber}.jpg`;
                                const testImageUrl = `https://viewerd.kbr.be/display/${mapPath}${testImageName}`;
                                
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
                                            'Cookie': cookies
                                        },
                                        signal: AbortSignal.timeout(3000) // 3 second timeout
                                    });
                                    
                                    if (testResponse.ok) {
                                        const testData = await testResponse.arrayBuffer();
                                        if (testData.byteLength > 1000) {
                                            workingImages.push(testImageName);
                                            console.log(`Found: ${testImageName} (${testData.byteLength} bytes)`);
                                        }
                                    } else if (testResponse.status === 404) {
                                        console.log(`End of sequence at: ${testImageName}`);
                                        break;
                                    }
                                } catch (error) {
                                    console.log(`Error testing ${testImageName}:`, error.message);
                                }
                                
                                // Small delay to avoid overwhelming the server
                                await new Promise(resolve => setTimeout(resolve, 200));
                            }
                            
                            return {
                                success: true,
                                method: 'direct_image_access',
                                mapPath,
                                basePattern,
                                workingImages,
                                totalImages: workingImages.length,
                                cookies,
                                galleryUrl,
                                firstWorkingImage: imageName,
                                imageSize: imageData.byteLength
                            };
                        }
                    }
                }
                
            } catch (error) {
                console.log(`Error testing ${imageName}:`, error.message);
            }
        }
        
        return {
            success: false,
            error: 'No working images found in quick test'
        };
        
    } catch (error) {
        console.error('Error in quick image test:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

quickImageTest().then(result => {
    console.log('\n=== QUICK IMAGE TEST COMPLETE ===');
    console.log(JSON.stringify(result, null, 2));
});