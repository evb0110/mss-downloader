const https = require('https');

async function testBelgicaKbr() {
    const url = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
    
    try {
        console.log('Testing Belgica KBR URL:', url);
        
        // Test with user-agent and basic headers
        const options = {
            method: 'GET',
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
        };
        
        const response = await fetch(url, options);
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers));
        
        if (!response.ok) {
            console.error('Request failed:', response.status, response.statusText);
            return;
        }
        
        const html = await response.text();
        console.log('HTML length:', html.length);
        
        // Look for UURL pattern
        const uurlMatch = html.match(/https:\/\/uurl\.kbr\.be\/(\d+)/);
        if (uurlMatch) {
            console.log('Found UURL:', uurlMatch[0]);
            
            // Test UURL access
            const uurlResponse = await fetch(uurlMatch[0], options);
            console.log('UURL response status:', uurlResponse.status);
            
            if (uurlResponse.ok) {
                const uurlHtml = await uurlResponse.text();
                console.log('UURL HTML length:', uurlHtml.length);
                
                // Look for map parameter
                const mapMatch = uurlHtml.match(/map=([^"'&]+)/);
                if (mapMatch) {
                    console.log('Found map parameter:', mapMatch[1]);
                    
                    // Test directory listing
                    const directoryUrl = `https://viewerd.kbr.be/display/${mapMatch[1]}`;
                    console.log('Testing directory URL:', directoryUrl);
                    
                    const dirResponse = await fetch(directoryUrl, options);
                    console.log('Directory response status:', dirResponse.status);
                    
                    if (dirResponse.ok) {
                        const dirHtml = await dirResponse.text();
                        console.log('Directory HTML length:', dirHtml.length);
                        
                        // Extract image filenames
                        const imageRegex = /BE-KBR00_[^"]*\.jpg/g;
                        const imageMatches = dirHtml.match(imageRegex) || [];
                        console.log('Found images:', imageMatches.length);
                        
                        if (imageMatches.length > 0) {
                            console.log('First few images:', imageMatches.slice(0, 5));
                            
                            // Test direct image access
                            const firstImage = imageMatches[0];
                            const imageUrl = `https://viewerd.kbr.be/display/${mapMatch[1]}${firstImage}`;
                            console.log('Testing image URL:', imageUrl);
                            
                            const imageResponse = await fetch(imageUrl, options);
                            console.log('Image response status:', imageResponse.status);
                            console.log('Image response headers:', Object.fromEntries(imageResponse.headers));
                            
                            if (imageResponse.ok) {
                                const imageData = await imageResponse.arrayBuffer();
                                console.log('Image size:', imageData.byteLength, 'bytes');
                                console.log('SUCCESS: Image downloaded successfully');
                            } else {
                                console.error('Image download failed:', imageResponse.status);
                            }
                        }
                    } else {
                        console.error('Directory listing failed:', dirResponse.status);
                    }
                } else {
                    console.error('Could not find map parameter in UURL page');
                }
            } else {
                console.error('UURL access failed:', uurlResponse.status);
            }
        } else {
            console.error('Could not find UURL in document page');
        }
        
    } catch (error) {
        console.error('Error testing Belgica KBR:', error.message);
    }
}

testBelgicaKbr();