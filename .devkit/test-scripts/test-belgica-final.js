const https = require('https');
const fs = require('fs');
const path = require('path');

async function fetchWithHTTPS(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        https.get({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...options.headers
            },
            rejectUnauthorized: false
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ 
                ok: res.statusCode >= 200 && res.statusCode < 300, 
                text: () => data, 
                status: res.statusCode,
                headers: res.headers 
            }));
        }).on('error', reject);
    });
}

async function implementBelgicaKBR() {
    console.log('Implementing Belgica KBR support...\n');
    
    // The map parameter from the viewer: A/1/5/8/9/4/8/5/0000-00-00_00/
    // Document ID: 16994415
    
    // Test various URL patterns
    const docId = '16994415';
    const mapPath = 'A/1/5/8/9/4/8/5/0000-00-00_00';
    
    const testUrls = [
        `https://viewerd.kbr.be/display/${mapPath}/001.jpg`,
        `https://viewerd.kbr.be/display/${mapPath}/1.jpg`,
        `https://viewerd.kbr.be/display/${mapPath}/page001.jpg`,
        `https://viewerd.kbr.be/AJAX/axZm/zoomLoad.php?zoomDir=display/${mapPath}`,
        `https://viewerd.kbr.be/pic/zoom/${mapPath}/`,
        `https://uurl.kbr.be/${docId}/images/1.jpg`,
        `https://belgica.kbr.be/display/${docId}/001.jpg`
    ];
    
    console.log('Testing URL patterns...\n');
    
    for (const url of testUrls) {
        try {
            const response = await fetchWithHTTPS(url);
            console.log(`${response.status} - ${url}`);
            if (response.status === 301 || response.status === 302) {
                console.log(`  Redirect to: ${response.headers.location}`);
            }
            if (response.ok) {
                const content = await response.text();
                console.log(`  Content length: ${content.length}`);
                if (content.length < 1000) {
                    console.log(`  Content preview: ${content.substring(0, 200)}`);
                }
            }
        } catch (error) {
            console.log(`Error - ${url}: ${error.message}`);
        }
    }
    
    // Try to fetch the AJAX-ZOOM configuration
    console.log('\n\nTrying AJAX-ZOOM endpoints...\n');
    
    const ajaxZoomUrl = `https://viewerd.kbr.be/AJAX/axZm/index.php?zoomData=eNpLtDK0qs60MrROtDKyqi4G8pQKlKyLrYyBDH1HfUN9U30LfUt9EyBpqm9cMAS6YBRvYKAPUgZUlaZknWRlYF1bC1wwuzYSCg,,&example=map`;
    
    try {
        const response = await fetchWithHTTPS(ajaxZoomUrl);
        console.log(`AJAX-ZOOM response: ${response.status}`);
        if (response.ok) {
            const content = await response.text();
            fs.writeFileSync('.devkit/reports/belgica-ajax-zoom.html', content);
            console.log('Saved AJAX-ZOOM response');
            
            // Look for image references
            const imgMatches = content.match(/src=["']([^"']*\.(?:jpg|jpeg|png))['"]/gi);
            if (imgMatches) {
                console.log(`\nFound ${imgMatches.length} image references`);
                imgMatches.slice(0, 5).forEach(match => {
                    console.log(`  ${match}`);
                });
            }
        }
    } catch (error) {
        console.log('AJAX-ZOOM error:', error.message);
    }
}

implementBelgicaKBR();