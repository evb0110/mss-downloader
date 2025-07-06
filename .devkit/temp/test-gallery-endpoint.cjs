const https = require('https');
const fs = require('fs');

async function testGalleryEndpoint() {
    try {
        console.log('=== TESTING GALLERY ENDPOINT ===');
        
        // Test the gallery.php endpoint
        const galleryUrl = 'https://viewerd.kbr.be/gallery.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/';
        console.log('Testing gallery URL:', galleryUrl);
        
        const response = await fetch(galleryUrl, {
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
                'Referer': 'https://uurl.kbr.be/1558106'
            }
        });
        
        console.log('Gallery response status:', response.status);
        console.log('Gallery response headers:', Object.fromEntries(response.headers));
        
        if (!response.ok) {
            console.error('Gallery request failed:', response.status, response.statusText);
            return;
        }
        
        const html = await response.text();
        console.log('Gallery HTML length:', html.length);
        
        // Save HTML for analysis
        fs.writeFileSync('.devkit/temp/gallery-page.html', html);
        console.log('Saved gallery HTML to .devkit/temp/gallery-page.html');
        
        // Look for image URLs in the gallery
        const imagePatterns = [
            /BE-KBR00_[^"'>\s]+\.jpg/g,
            /\.jpg/g,
            /src=["'][^"']*["']/g,
            /href=["'][^"']*\.jpg["']/g,
            /url\([^)]*\.jpg\)/g
        ];
        
        console.log('\n=== SEARCHING FOR IMAGE PATTERNS ===');
        for (const pattern of imagePatterns) {
            const matches = html.match(pattern) || [];
            if (matches.length > 0) {
                console.log(`Pattern ${pattern.source}:`, matches.slice(0, 10));
            }
        }
        
        // Look for any JavaScript that might load images dynamically
        const scriptTags = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
        console.log('\nFound script tags:', scriptTags.length);
        
        // Check if the gallery shows a list of images or uses a different loading mechanism
        const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>/g;
        const links = [];
        let linkMatch;
        while ((linkMatch = linkPattern.exec(html)) !== null) {
            links.push(linkMatch[1]);
        }
        
        console.log('\n=== FOUND LINKS ===');
        console.log('Total links found:', links.length);
        const imageLinks = links.filter(link => link.includes('.jpg') || link.includes('.jpeg') || link.includes('.png'));
        console.log('Image links:', imageLinks.slice(0, 10));
        
        // Test if we can access images directly through the gallery
        if (imageLinks.length > 0) {
            console.log('\n=== TESTING IMAGE ACCESS ===');
            for (const imageLink of imageLinks.slice(0, 3)) {
                let fullImageUrl;
                if (imageLink.startsWith('http')) {
                    fullImageUrl = imageLink;
                } else if (imageLink.startsWith('/')) {
                    fullImageUrl = `https://viewerd.kbr.be${imageLink}`;
                } else {
                    fullImageUrl = `https://viewerd.kbr.be/gallery.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/${imageLink}`;
                }
                
                console.log(`Testing image: ${fullImageUrl}`);
                
                const imageResponse = await fetch(fullImageUrl, {
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
                        'Referer': galleryUrl
                    }
                });
                
                console.log(`Image response: ${imageResponse.status}`);
                
                if (imageResponse.ok) {
                    const imageData = await imageResponse.arrayBuffer();
                    console.log(`SUCCESS: Image downloaded, size: ${imageData.byteLength} bytes`);
                    
                    // Save first successful image for validation
                    if (imageData.byteLength > 1000) {
                        fs.writeFileSync('.devkit/temp/belgica-test-image.jpg', Buffer.from(imageData));
                        console.log('Saved test image to .devkit/temp/belgica-test-image.jpg');
                    }
                    
                    return {
                        success: true,
                        method: 'gallery_php',
                        galleryUrl,
                        imageLinks: imageLinks.slice(0, 10),
                        workingImageUrl: fullImageUrl,
                        imageSize: imageData.byteLength
                    };
                } else {
                    console.log(`Image failed: ${imageResponse.status} ${imageResponse.statusText}`);
                }
            }
        }
        
        // If no direct image links, look for other approaches
        console.log('\n=== CHECKING FOR ALTERNATIVE APPROACHES ===');
        
        // Check if the gallery uses AJAX or other dynamic loading
        const ajaxPattern = /ajax|xhr|fetch|load.*image/gi;
        const ajaxMatches = html.match(ajaxPattern) || [];
        console.log('AJAX/dynamic loading patterns:', ajaxMatches.length);
        
        // Look for any API endpoints or data attributes
        const apiPattern = /api|endpoint|data-|json/gi;
        const apiMatches = html.match(apiPattern) || [];
        console.log('API/data patterns:', apiMatches.length);
        
        return {
            success: true,
            method: 'gallery_php_analysis',
            galleryUrl,
            htmlLength: html.length,
            scriptTags: scriptTags.length,
            totalLinks: links.length,
            imageLinks: imageLinks.length,
            ajaxMatches: ajaxMatches.length,
            apiMatches: apiMatches.length,
            sampleLinks: links.slice(0, 10)
        };
        
    } catch (error) {
        console.error('Error testing gallery endpoint:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

testGalleryEndpoint().then(result => {
    console.log('\n=== GALLERY TEST COMPLETE ===');
    console.log(JSON.stringify(result, null, 2));
});