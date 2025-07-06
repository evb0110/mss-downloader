const https = require('https');

async function debugBelgicaKbrAuth() {
    const url = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
    
    try {
        console.log('=== DEBUGGING BELGICA KBR AUTHENTICATION ===');
        
        // Step 1: Get the document page with cookies
        console.log('1. Fetching document page...');
        const firstResponse = await fetch(url, {
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
        
        // Extract cookies from response
        const setCookieHeaders = firstResponse.headers.get('set-cookie');
        console.log('Set-Cookie headers:', setCookieHeaders);
        
        const html = await firstResponse.text();
        const uurlMatch = html.match(/https:\/\/uurl\.kbr\.be\/(\d+)/);
        if (!uurlMatch) {
            throw new Error('Could not find UURL');
        }
        
        console.log('Found UURL:', uurlMatch[0]);
        
        // Step 2: Visit UURL page with cookies
        console.log('2. Fetching UURL page...');
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
                'Referer': url,
                'Cookie': setCookieHeaders
            }
        });
        
        const uurlHtml = await uurlResponse.text();
        const mapMatch = uurlHtml.match(/map=([^"'&]+)/);
        if (!mapMatch) {
            throw new Error('Could not find map parameter');
        }
        
        console.log('Found map parameter:', mapMatch[1]);
        
        // Step 3: Try different approaches to access the directory
        const directoryPath = mapMatch[1];
        const directoryUrl = `https://viewerd.kbr.be/display/${directoryPath}`;
        
        console.log('3. Testing directory access with different headers...');
        
        // Test 1: With referer from uurl.kbr.be
        console.log('Test 1: With UURL referer');
        let dirResponse = await fetch(directoryUrl, {
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
                'Referer': uurlMatch[0],
                'Cookie': setCookieHeaders
            }
        });
        console.log('Directory response status:', dirResponse.status);
        
        // Test 2: With referer from belgica.kbr.be  
        if (!dirResponse.ok) {
            console.log('Test 2: With Belgica referer');
            dirResponse = await fetch(directoryUrl, {
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
                    'Referer': url,
                    'Cookie': setCookieHeaders
                }
            });
            console.log('Directory response status:', dirResponse.status);
        }
        
        // Test 3: Try without cookies but with referer
        if (!dirResponse.ok) {
            console.log('Test 3: Without cookies, with referer');
            dirResponse = await fetch(directoryUrl, {
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
                    'Referer': uurlMatch[0]
                }
            });
            console.log('Directory response status:', dirResponse.status);
        }
        
        // Test 4: Try accessing images directly without directory listing
        if (!dirResponse.ok) {
            console.log('Test 4: Try accessing images directly');
            // Common image naming patterns for KBR
            const testImageNames = [
                'BE-KBR00_0001.jpg',
                'BE-KBR00_0002.jpg',
                'BE-KBR00_001.jpg',
                'BE-KBR00_002.jpg',
                'BE-KBR00_01.jpg',
                'BE-KBR00_02.jpg',
                'BE-KBR00_1.jpg',
                'BE-KBR00_2.jpg'
            ];
            
            for (const imageName of testImageNames) {
                const imageUrl = `https://viewerd.kbr.be/display/${directoryPath}${imageName}`;
                console.log(`Testing direct image access: ${imageName}`);
                
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
                        'Sec-Fetch-Site': 'cross-site',
                        'Referer': uurlMatch[0],
                        'Cookie': setCookieHeaders
                    }
                });
                
                console.log(`Image ${imageName} response: ${imageResponse.status}`);
                
                if (imageResponse.ok) {
                    const imageData = await imageResponse.arrayBuffer();
                    console.log(`SUCCESS: Image ${imageName} downloaded, size: ${imageData.byteLength} bytes`);
                    
                    // Try to determine image sequence pattern
                    console.log('Trying to discover image sequence...');
                    let foundImages = [imageName];
                    
                    // Test sequential patterns
                    const basePattern = imageName.replace(/\d+\.jpg$/, '');
                    for (let i = 1; i <= 50; i++) {
                        const testName = `${basePattern}${i.toString().padStart(imageName.match(/(\d+)\.jpg$/)[1].length, '0')}.jpg`;
                        if (testName === imageName) continue;
                        
                        const testUrl = `https://viewerd.kbr.be/display/${directoryPath}${testName}`;
                        const testResponse = await fetch(testUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                                'Accept-Language': 'en-US,en;q=0.5',
                                'Accept-Encoding': 'gzip, deflate, br',
                                'DNT': '1',
                                'Connection': 'keep-alive',
                                'Sec-Fetch-Dest': 'image',
                                'Sec-Fetch-Mode': 'no-cors',
                                'Sec-Fetch-Site': 'cross-site',
                                'Referer': uurlMatch[0],
                                'Cookie': setCookieHeaders
                            }
                        });
                        
                        if (testResponse.ok) {
                            foundImages.push(testName);
                            console.log(`Found additional image: ${testName}`);
                        } else if (testResponse.status === 404) {
                            // Stop if we hit a 404, likely end of sequence
                            break;
                        }
                        
                        // Throttle requests to avoid overwhelming the server
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    
                    console.log(`DISCOVERY COMPLETE: Found ${foundImages.length} images`);
                    console.log('Image sequence:', foundImages);
                    
                    return {
                        success: true,
                        method: 'direct_image_access',
                        directoryPath,
                        imagePattern: basePattern,
                        foundImages,
                        referer: uurlMatch[0],
                        cookies: setCookieHeaders
                    };
                }
            }
        }
        
        if (dirResponse.ok) {
            console.log('SUCCESS: Directory listing worked');
            const dirHtml = await dirResponse.text();
            console.log('Directory HTML length:', dirHtml.length);
            
            const imageRegex = /BE-KBR00_[^"]*\.jpg/g;
            const imageMatches = dirHtml.match(imageRegex) || [];
            console.log('Found images in directory:', imageMatches.length);
            
            return {
                success: true,
                method: 'directory_listing',
                directoryPath,
                images: imageMatches,
                referer: uurlMatch[0],
                cookies: setCookieHeaders
            };
        }
        
        throw new Error('All access methods failed');
        
    } catch (error) {
        console.error('Error debugging Belgica KBR auth:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

debugBelgicaKbrAuth().then(result => {
    console.log('\n=== FINAL RESULT ===');
    console.log(JSON.stringify(result, null, 2));
});