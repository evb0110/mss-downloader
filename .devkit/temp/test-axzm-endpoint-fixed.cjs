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
            { name: 'full', query: `zoomDir=display/${directoryPath}&example=full&idn_dir=${directoryPath}` },
            // Info query to get image list
            { name: 'info', query: `zoomDir=display/${directoryPath}&example=info` },
            // Map query
            { name: 'map', query: `zoomDir=display/${directoryPath}&example=map&idn_dir=${directoryPath}` },
            // Direct image listing
            { name: 'thumbs', query: `zoomDir=display/${directoryPath}&example=thumbs` },
            // Directory listing
            { name: 'dir', query: `zoomDir=display/${directoryPath}&example=dir` },
        ];
        
        for (const endpoint of endpoints) {
            const testUrl = `${axzmBaseUrl}?${endpoint.query}`;
            console.log(`\nTesting ${endpoint.name}: ${testUrl}`);
            
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
            
            if (response.ok) {
                const responseText = await response.text();
                console.log(`Response length: ${responseText.length}`);
                
                // Save response for analysis
                const filename = `.devkit/temp/axzm-${endpoint.name}-response.txt`;
                fs.writeFileSync(filename, responseText);
                console.log(`Saved response to ${filename}`);
                
                // Look for image references
                const imagePattern = /BE-KBR00_[^"'>\s]+\.jpg/g;
                const imageMatches = responseText.match(imagePattern) || [];
                console.log(`Found ${imageMatches.length} image references`);
                
                if (imageMatches.length > 0) {
                    console.log('First few images:', imageMatches.slice(0, 5));
                    
                    // Try to access the first image
                    const firstImage = imageMatches[0];
                    const imageUrl = `https://viewerd.kbr.be/display/${directoryPath}${firstImage}`;
                    
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
                            workingEndpoint: endpoint.name,
                            workingQuery: endpoint.query,
                            workingImageUrl: imageUrl,
                            imageCount: imageMatches.length,
                            imageSize: imageData.byteLength,
                            allImages: imageMatches
                        };
                    }
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