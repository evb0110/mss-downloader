const fs = require('fs');

async function inspectAjaxZoomDeeper() {
    try {
        console.log('=== DEEP INSPECTION OF AJAX-ZOOM SYSTEM ===');
        
        // Get to the gallery page
        const testUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
        
        const docResponse = await fetch(testUrl);
        const cookies = docResponse.headers.get('set-cookie');
        const docHtml = await docResponse.text();
        const uurlMatch = docHtml.match(/https:\/\/uurl\.kbr\.be\/(\d+)/);
        
        const uurlResponse = await fetch(uurlMatch[0], {
            headers: { 'Referer': testUrl, 'Cookie': cookies || '' }
        });
        
        const uurlHtml = await uurlResponse.text();
        const mapMatch = uurlHtml.match(/map=([^"'&]+)/);
        const mapPath = mapMatch[1];
        
        const galleryUrl = `https://viewerd.kbr.be/gallery.php?map=${mapPath}`;
        console.log('Gallery URL:', galleryUrl);
        
        // Get the gallery page and save it
        const galleryResponse = await fetch(galleryUrl, {
            headers: { 'Referer': uurlMatch[0], 'Cookie': cookies || '' }
        });
        
        const galleryHtml = await galleryResponse.text();
        fs.writeFileSync('.devkit/temp/gallery-detailed.html', galleryHtml);
        
        console.log('Gallery HTML saved, analyzing JavaScript...');
        
        // Extract all JavaScript variables and function calls from the gallery
        const jsPatterns = [
            /ajaxZoom\.(\w+)\s*=\s*['"`]([^'"`]+)['"`]/g,
            /var\s+(\w+)\s*=\s*['"`]([^'"`]+)['"`]/g,
            /fullPath\s*=\s*['"`]([^'"`]+)['"`]/g,
            /queryString\s*=\s*['"`]([^'"`]+)['"`]/g,
            /zoomDir\s*=\s*([^&"'`]+)/g,
            /example\s*=\s*([^&"'`]+)/g,
        ];
        
        console.log('\nExtracting JavaScript configuration...');
        
        for (const pattern of jsPatterns) {
            let match;
            while ((match = pattern.exec(galleryHtml)) !== null) {
                console.log(`Found: ${match[0]}`);
            }
        }
        
        // Look for any AJAX endpoints or data URLs
        const urlPatterns = [
            /https?:\/\/[a-zA-Z0-9.-]+[a-zA-Z0-9.\-\/\?=&_]+/g,
            /url\s*:\s*['"`]([^'"`]+)['"`]/g,
            /src\s*:\s*['"`]([^'"`]+)['"`]/g,
        ];
        
        console.log('\nExtracting URL patterns...');
        
        const foundUrls = new Set();
        for (const pattern of urlPatterns) {
            let match;
            while ((match = pattern.exec(galleryHtml)) !== null) {
                const url = match[1] || match[0];
                if (url.includes('viewerd.kbr.be') || url.includes('axZm') || url.includes('.php')) {
                    foundUrls.add(url);
                }
            }
        }
        
        console.log('Unique URLs found:');
        Array.from(foundUrls).forEach(url => console.log(`  ${url}`));
        
        // Try to understand the AJAX-Zoom configuration
        console.log('\n=== TESTING AJAX-ZOOM ENDPOINTS ===');
        
        // Look for the actual AJAX-Zoom configuration file
        const axzmConfigUrl = 'https://viewerd.kbr.be/AJAX/axZm/zoomConfigCustom.inc.php';
        console.log('Testing AXZM config:', axzmConfigUrl);
        
        try {
            const configResponse = await fetch(axzmConfigUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Referer': galleryUrl,
                    'Cookie': cookies || ''
                }
            });
            
            console.log('Config response:', configResponse.status);
            
            if (configResponse.ok) {
                const configText = await configResponse.text();
                console.log('Config content length:', configText.length);
                
                if (configText.length > 0) {
                    fs.writeFileSync('.devkit/temp/axzm-config.txt', configText);
                    console.log('Config saved to .devkit/temp/axzm-config.txt');
                    
                    // Look for image directory configurations
                    const imageDirPatterns = [
                        /\$zoom\['config'\]\['imagedir'\]/g,
                        /imagedir/gi,
                        /display/gi,
                        /mapPath/gi,
                    ];
                    
                    for (const pattern of imageDirPatterns) {
                        const matches = configText.match(pattern) || [];
                        if (matches.length > 0) {
                            console.log(`Found ${pattern.source}:`, matches.length, 'matches');
                        }
                    }
                }
            }
        } catch (error) {
            console.log('Config fetch error:', error.message);
        }
        
        // Try to make a proper AJAX-Zoom request like the browser would
        console.log('\n=== SIMULATING BROWSER AJAX-ZOOM REQUEST ===');
        
        const axzmUrl = 'https://viewerd.kbr.be/AJAX/axZm/';
        const queryParams = [
            `zoomDir=display/${mapPath}`,
            'example=full',
            `idn_dir=${mapPath}`,
            'rand=' + Math.random()
        ].join('&');
        
        const fullAxzmUrl = `${axzmUrl}?${queryParams}`;
        console.log('Testing AXZM URL:', fullAxzmUrl);
        
        try {
            const axzmResponse = await fetch(fullAxzmUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': galleryUrl,
                    'Cookie': cookies || ''
                }
            });
            
            console.log('AXZM Response:', axzmResponse.status);
            console.log('AXZM Headers:', Object.fromEntries(axzmResponse.headers));
            
            if (axzmResponse.ok) {
                const axzmContent = await axzmResponse.text();
                console.log('AXZM Content length:', axzmContent.length);
                
                fs.writeFileSync('.devkit/temp/axzm-response.html', axzmContent);
                console.log('AXZM response saved');
                
                // Look for image references in the response
                const imageRefs = axzmContent.match(/[a-zA-Z0-9_.-]+\.(jpg|jpeg|png|tif|tiff)/gi) || [];
                if (imageRefs.length > 0) {
                    console.log('Image references found:', imageRefs);
                }
                
                // Look for any JavaScript that might reveal the actual image loading mechanism
                const jsVars = axzmContent.match(/var\s+\w+\s*=\s*[^;]+;/g) || [];
                if (jsVars.length > 0) {
                    console.log('JavaScript variables found:', jsVars.slice(0, 5));
                }
            }
        } catch (error) {
            console.log('AXZM request error:', error.message);
        }
        
        // One more attempt: try to understand if this manuscript actually has viewable images
        console.log('\n=== CHECKING MANUSCRIPT AVAILABILITY ===');
        
        // Check the original document page for any error messages or restrictions
        const restrictionPatterns = [
            /restricted/gi,
            /not available/gi,
            /access denied/gi,
            /copyright/gi,
            /permission/gi,
            /unavailable/gi,
        ];
        
        for (const pattern of restrictionPatterns) {
            const matches = docHtml.match(pattern) || [];
            if (matches.length > 0) {
                console.log(`Warning: Found restriction indicator "${pattern.source}":`, matches);
            }
        }
        
        // Check UURL page for restrictions
        for (const pattern of restrictionPatterns) {
            const matches = uurlHtml.match(pattern) || [];
            if (matches.length > 0) {
                console.log(`Warning: Found restriction in UURL "${pattern.source}":`, matches);
            }
        }
        
        // Check gallery page for restrictions
        for (const pattern of restrictionPatterns) {
            const matches = galleryHtml.match(pattern) || [];
            if (matches.length > 0) {
                console.log(`Warning: Found restriction in gallery "${pattern.source}":`, matches);
            }
        }
        
        return {
            success: false,
            note: 'Deep inspection completed but no working image access method found',
            mapPath,
            galleryUrl,
            foundUrls: Array.from(foundUrls),
            recommendation: 'This manuscript may have access restrictions or use a proprietary image delivery system'
        };
        
    } catch (error) {
        console.error('Deep inspection error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

inspectAjaxZoomDeeper().then(result => {
    console.log('\n=== DEEP INSPECTION COMPLETE ===');
    console.log(JSON.stringify(result, null, 2));
}).catch(error => {
    console.error('Unexpected error:', error);
});