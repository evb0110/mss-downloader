const https = require('https');
const fs = require('fs');

async function testAxzmEndpoint() {
    try {
        console.log('=== TESTING AJAX-ZOOM ENDPOINT ===');
        
        // Test the AJAX-Zoom endpoint
        const axzmBaseUrl = 'https://viewerd.kbr.be/AJAX/axZm/';
        const directoryPath = 'A/1/5/8/9/4/8/5/0000-00-00_00/';
        
        // Try different AJAX-Zoom endpoints
        const endpoints = [
            // Original query string from the JavaScript
            `zoomDir=display/${directoryPath}&example=full&idn_dir=${directoryPath}`,
            // Info query to get image list
            `zoomDir=display/${directoryPath}&example=info`,
            // Map query
            `zoomDir=display/${directoryPath}&example=map&idn_dir=${directoryPath}`,
            // Direct image listing
            `zoomDir=display/${directoryPath}&example=thumbs`,
            // Directory listing
            `zoomDir=display/${directoryPath}&example=dir`,
        ];
        
        for (const queryString of endpoints) {
            const testUrl = `${axzmBaseUrl}?${queryString}`;
            console.log(`\nTesting: ${testUrl}`);
            
            const response = await fetch(testUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'same-origin',
                    'Referer': 'https://viewerd.kbr.be/gallery.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/',
                    'X-Requested-With': 'XMLHttpRequest' // Important for AJAX requests
                }
            });
            
            console.log(`Response status: ${response.status}`);
            console.log(`Response headers:`, Object.fromEntries(response.headers));
            
            if (response.ok) {
                const responseText = await response.text();
                console.log(`Response length: ${responseText.length}`);
                
                // Save response for analysis
                const filename = `.devkit/temp/axzm-${queryString.split('&')[0].split('=')[1]}-response.txt`;
                fs.writeFileSync(filename, responseText);
                console.log(`Saved response to ${filename}`);
                
                // Look for image references
                const imagePattern = /BE-KBR00_[^"'>\s]+\.jpg/g;
                const imageMatches = responseText.match(imagePattern) || [];
                console.log(`Found ${imageMatches.length} image references`);
                
                if (imageMatches.length > 0) {
                    console.log('First few images:', imageMatches.slice(0, 5));
                }
                
                // Look for JSON data
                if (responseText.includes('{') && responseText.includes('}')) {
                    try {
                        const jsonData = JSON.parse(responseText);
                        console.log('Response is JSON, keys:', Object.keys(jsonData));
                        
                        if (jsonData.images) {
                            console.log('Found images array:', jsonData.images.length);
                        }
                    } catch (e) {
                        console.log('Response contains JSON-like data but not valid JSON');
                    }
                }
                
                // If we found images, try to access them
                if (imageMatches.length > 0) {
                    console.log('\n=== TESTING IMAGE ACCESS ===');
                    const firstImage = imageMatches[0];
                    
                    // Try different image URL patterns
                    const imageUrls = [
                        `https://viewerd.kbr.be/display/${directoryPath}${firstImage}`,
                        `https://viewerd.kbr.be/AJAX/axZm/display/${directoryPath}${firstImage}`,
                        `https://viewerd.kbr.be/images/${directoryPath}${firstImage}`,
                        `https://viewerd.kbr.be/data/${directoryPath}${firstImage}`
                    ];
                    
                    for (const imageUrl of imageUrls) {
                        console.log(`Testing image URL: ${imageUrl}`);
                        
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
                                'Referer': 'https://viewerd.kbr.be/gallery.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/'
                            }
                        });
                        
                        console.log(`Image response: ${imageResponse.status}`);
                        
                        if (imageResponse.ok) {
                            const imageData = await imageResponse.arrayBuffer();
                            console.log(`SUCCESS: Image downloaded, size: ${imageData.byteLength} bytes`);
                            
                            // Save first successful image
                            fs.writeFileSync('.devkit/temp/belgica-axzm-test-image.jpg', Buffer.from(imageData));
                            console.log('Saved test image to .devkit/temp/belgica-axzm-test-image.jpg');
                            
                            return {
                                success: true,
                                method: 'axzm_endpoint',
                                workingQuery: queryString,
                                workingImageUrl: imageUrl,
                                imageCount: imageMatches.length,
                                imageSize: imageData.byteLength,
                                allImages: imageMatches
                            };
                        }
                    }
                }
            } else {
                console.log(`Request failed: ${response.status} ${response.statusText}`);
            }
        }
        
        return {
            success: false,
            error: 'All endpoint tests failed'
        };
        
    } catch (error) {
        console.error('Error testing AXZM endpoint:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

testAxzmEndpoint().then(result => {
    console.log('\n=== AXZM TEST COMPLETE ===');
    console.log(JSON.stringify(result, null, 2));
});