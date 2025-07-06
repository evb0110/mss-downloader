const https = require('https');
const fs = require('fs');

async function analyzeBrowserBehavior() {
    try {
        console.log('=== ANALYZING BROWSER BEHAVIOR ===');
        
        // Step 1: Let's try to emulate the exact browser behavior
        // First, get the document page with cookies
        const documentUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
        console.log('1. Getting document page...');
        
        const docResponse = await fetch(documentUrl, {
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
        
        const cookies = docResponse.headers.get('set-cookie');
        console.log('Got cookies:', cookies ? 'Yes' : 'No');
        
        const docHtml = await docResponse.text();
        const uurlMatch = docHtml.match(/https:\/\/uurl\.kbr\.be\/(\d+)/);
        if (!uurlMatch) {
            throw new Error('Could not find UURL');
        }
        
        console.log('2. Getting UURL page...');
        
        // Step 2: Get the UURL page
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
        
        console.log('3. Getting gallery page...');
        
        // Step 3: Get the gallery page (this is the iframe)
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
                'Cookie': cookies
            }
        });
        
        const galleryHtml = await galleryResponse.text();
        console.log('Gallery HTML loaded, length:', galleryHtml.length);
        
        // Step 4: Now let's try to understand what happens when the gallery JavaScript runs
        console.log('4. Analyzing gallery JavaScript execution...');
        
        // Extract the key parameters from the JavaScript
        const fullPathMatch = galleryHtml.match(/fullPath = "([^"]+)"/);
        const queryStringMatch = galleryHtml.match(/ajaxZoom\.queryString = '([^']+)'/);
        
        if (fullPathMatch) {
            console.log('Found fullPath:', fullPathMatch[1]);
        }
        
        if (queryStringMatch) {
            console.log('Found queryString:', queryStringMatch[1]);
        }
        
        console.log('5. Trying to mimic AJAX-Zoom requests...');
        
        // Step 5: Try to simulate the AJAX-Zoom requests
        // Based on the JavaScript, it makes requests to the axZm directory
        const axzmPath = 'https://viewerd.kbr.be/AJAX/axZm/';
        
        // Try different approaches based on what we see in the JavaScript
        const simulatedRequests = [
            // Try to get the configuration or initial data
            `${axzmPath}zoomConfig.inc.php`,
            `${axzmPath}zoomConfigCustom.inc.php`,
            // Try to get images list
            `${axzmPath}?${queryStringMatch ? queryStringMatch[1] : ''}`,
            // Try to simulate the jQuery.fn.axZm.openFullScreen request
            `${axzmPath}zoomLoad.php?${queryStringMatch ? queryStringMatch[1] : ''}`,
        ];
        
        for (const requestUrl of simulatedRequests) {
            console.log(`Trying: ${requestUrl}`);
            
            const testResponse = await fetch(requestUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'Referer': galleryUrl,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Cookie': cookies
                }
            });
            
            console.log(`Response: ${testResponse.status}`);
            
            if (testResponse.ok) {
                const responseText = await testResponse.text();
                console.log(`Response length: ${responseText.length}`);
                
                if (responseText.length < 500) {
                    console.log('Response content:', responseText);
                }
                
                // Look for image references
                const imagePattern = /BE-KBR00_[^"'>\s]+\.jpg/g;
                const imageMatches = responseText.match(imagePattern) || [];
                
                if (imageMatches.length > 0) {
                    console.log('SUCCESS: Found images:', imageMatches.slice(0, 5));
                    
                    // Try to access the first image
                    const firstImage = imageMatches[0];
                    const imageUrl = `https://viewerd.kbr.be/display/${mapPath}${firstImage}`;
                    
                    console.log('Trying to access image:', imageUrl);
                    
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
                        }
                    });
                    
                    console.log(`Image response: ${imageResponse.status}`);
                    
                    if (imageResponse.ok) {
                        const imageData = await imageResponse.arrayBuffer();
                        console.log(`SUCCESS: Downloaded image, size: ${imageData.byteLength} bytes`);
                        
                        fs.writeFileSync('.devkit/temp/belgica-success-test.jpg', Buffer.from(imageData));
                        console.log('Saved test image');
                        
                        return {
                            success: true,
                            method: 'browser_simulation',
                            mapPath,
                            imageUrl,
                            imageCount: imageMatches.length,
                            allImages: imageMatches,
                            workingRequestUrl: requestUrl
                        };
                    }
                }
            }
        }
        
        console.log('6. Final attempt: Direct image enumeration...');
        
        // Step 6: If all else fails, try direct image enumeration
        // Based on common KBR naming patterns
        const commonImageNames = [
            'BE-KBR00_0001.jpg',
            'BE-KBR00_0002.jpg',
            'BE-KBR00_0003.jpg',
            'BE-KBR00_001.jpg',
            'BE-KBR00_002.jpg',
            'BE-KBR00_003.jpg',
            'BE-KBR00_01.jpg',
            'BE-KBR00_02.jpg',
            'BE-KBR00_03.jpg',
            'BE-KBR00_1.jpg',
            'BE-KBR00_2.jpg',
            'BE-KBR00_3.jpg'
        ];
        
        const workingImages = [];
        
        for (const imageName of commonImageNames) {
            const imageUrl = `https://viewerd.kbr.be/display/${mapPath}${imageName}`;
            
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
                }
            });
            
            if (imageResponse.ok) {
                const imageData = await imageResponse.arrayBuffer();
                if (imageData.byteLength > 1000) { // Valid image
                    workingImages.push(imageName);
                    console.log(`Found working image: ${imageName} (${imageData.byteLength} bytes)`);
                }
            }
            
            // Throttle requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (workingImages.length > 0) {
            console.log(`SUCCESS: Found ${workingImages.length} working images`);
            
            // Try to find the pattern and discover more images
            const basePattern = workingImages[0].replace(/\d+\.jpg$/, '');
            console.log('Base pattern:', basePattern);
            
            const additionalImages = [];
            
            // Try to find more images with the same pattern
            for (let i = 1; i <= 100; i++) {
                const paddedNumber = i.toString().padStart(4, '0');
                const testImageName = `${basePattern}${paddedNumber}.jpg`;
                
                if (workingImages.includes(testImageName)) continue;
                
                const imageUrl = `https://viewerd.kbr.be/display/${mapPath}${testImageName}`;
                
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
                    }
                });
                
                if (imageResponse.ok) {
                    const imageData = await imageResponse.arrayBuffer();
                    if (imageData.byteLength > 1000) { // Valid image
                        additionalImages.push(testImageName);
                        console.log(`Found additional image: ${testImageName}`);
                    }
                } else if (imageResponse.status === 404) {
                    // If we get 404, we might have reached the end
                    console.log('Reached end of sequence at:', testImageName);
                    break;
                }
                
                // Throttle requests to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const allImages = [...workingImages, ...additionalImages];
            
            return {
                success: true,
                method: 'direct_enumeration',
                mapPath,
                basePattern,
                workingImages: allImages,
                totalImages: allImages.length,
                cookies,
                galleryUrl
            };
        }
        
        return {
            success: false,
            error: 'Could not find any working images'
        };
        
    } catch (error) {
        console.error('Error analyzing browser behavior:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

analyzeBrowserBehavior().then(result => {
    console.log('\n=== BROWSER BEHAVIOR ANALYSIS COMPLETE ===');
    console.log(JSON.stringify(result, null, 2));
});