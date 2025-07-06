const https = require('https');
const fs = require('fs');

async function testAxzmProperEndpoint() {
    try {
        console.log('=== TESTING PROPER AJAX-ZOOM ENDPOINT ===');
        
        // The proper endpoint should be one of the PHP files in the axZm directory
        const directoryPath = 'A/1/5/8/9/4/8/5/0000-00-00_00/';
        
        const phpEndpoints = [
            'zoomLoad.php',
            'zoomBatch.php', 
            'zoomObjects.inc.php',
            'zoomDownload.php'
        ];
        
        for (const phpFile of phpEndpoints) {
            const testUrl = `https://viewerd.kbr.be/AJAX/axZm/${phpFile}?zoomDir=display/${directoryPath}&example=info`;
            console.log(`\nTesting: ${testUrl}`);
            
            const response = await fetch(testUrl, {
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
                    'Referer': 'https://viewerd.kbr.be/gallery.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            console.log(`Response status: ${response.status}`);
            console.log(`Response content-type: ${response.headers.get('content-type')}`);
            
            if (response.ok) {
                const responseText = await response.text();
                console.log(`Response length: ${responseText.length}`);
                
                if (responseText.length < 1000) {
                    console.log('Response content:', responseText);
                } else {
                    console.log('Response preview:', responseText.substring(0, 200) + '...');
                }
                
                // Save response for analysis
                const filename = `.devkit/temp/axzm-${phpFile.replace('.php', '')}-response.txt`;
                fs.writeFileSync(filename, responseText);
                
                // Look for JSON response
                if (responseText.includes('{') && responseText.includes('}')) {
                    try {
                        const jsonData = JSON.parse(responseText);
                        console.log('JSON Response keys:', Object.keys(jsonData));
                        
                        if (jsonData.zoom || jsonData.images || jsonData.src) {
                            console.log('SUCCESS: Found image data in JSON response');
                            return {
                                success: true,
                                method: 'axzm_php_endpoint',
                                phpFile,
                                jsonData
                            };
                        }
                    } catch (e) {
                        console.log('Not valid JSON');
                    }
                }
                
                // Look for image references
                const imagePattern = /BE-KBR00_[^"'>\s]+\.jpg/g;
                const imageMatches = responseText.match(imagePattern) || [];
                console.log(`Found ${imageMatches.length} image references`);
                
                if (imageMatches.length > 0) {
                    console.log('Images found:', imageMatches.slice(0, 5));
                    return {
                        success: true,
                        method: 'axzm_php_endpoint',
                        phpFile,
                        images: imageMatches
                    };
                }
                
            } else {
                console.log(`Request failed: ${response.status} ${response.statusText}`);
            }
        }
        
        // If PHP endpoints don't work, try the index.php approach
        console.log('\n=== TRYING INDEX.PHP APPROACH ===');
        
        const indexUrl = `https://viewerd.kbr.be/AJAX/axZm/index.php?zoomDir=display/${directoryPath}&example=info`;
        console.log(`Testing: ${indexUrl}`);
        
        const indexResponse = await fetch(indexUrl, {
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
                'Referer': 'https://viewerd.kbr.be/gallery.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        console.log(`Index response status: ${indexResponse.status}`);
        
        if (indexResponse.ok) {
            const indexText = await indexResponse.text();
            console.log(`Index response length: ${indexText.length}`);
            
            if (indexText.length < 1000) {
                console.log('Index response content:', indexText);
            }
            
            // Save response
            fs.writeFileSync('.devkit/temp/axzm-index-response.txt', indexText);
        }
        
        // Last resort: try to find the actual API endpoint by examining the JavaScript
        console.log('\n=== ANALYZING JAVASCRIPT FOR API ENDPOINT ===');
        
        // Look for AJAX calls in the gallery page JavaScript
        const galleryJsPattern = /jQuery\.ajax\(([^)]+)\)/g;
        const galleryPage = fs.readFileSync('.devkit/temp/gallery-page.html', 'utf8');
        
        const ajaxMatches = galleryPage.match(galleryJsPattern) || [];
        console.log('Found AJAX calls:', ajaxMatches.length);
        
        if (ajaxMatches.length > 0) {
            console.log('AJAX calls found:', ajaxMatches);
        }
        
        // Check if there's a specific API endpoint mentioned
        const apiPattern = /url\s*:\s*["']([^"']+)["']/g;
        const urlMatches = galleryPage.match(apiPattern) || [];
        console.log('URL patterns:', urlMatches);
        
        return {
            success: false,
            error: 'All endpoint tests failed',
            ajaxMatches,
            urlMatches
        };
        
    } catch (error) {
        console.error('Error testing AXZM proper endpoint:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

testAxzmProperEndpoint().then(result => {
    console.log('\n=== PROPER ENDPOINT TEST COMPLETE ===');
    console.log(JSON.stringify(result, null, 2));
});