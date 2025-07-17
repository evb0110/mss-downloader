const https = require('https');
const fs = require('fs');

async function fetchWithHTTPS(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        https.get({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            rejectUnauthorized: false
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, text: () => data, status: res.statusCode }));
        }).on('error', reject);
    });
}

async function analyzeViewer() {
    const viewerUrl = 'https://viewerd.kbr.be/gallery.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/';
    console.log('Fetching viewer page:', viewerUrl);
    
    try {
        const response = await fetchWithHTTPS(viewerUrl);
        const html = await response.text();
        
        fs.writeFileSync('.devkit/reports/belgica-viewer.html', html);
        console.log('\nSaved viewer HTML');
        
        // Extract all image URLs
        const imgUrls = [];
        const imgMatches = html.matchAll(/<img[^>]*src=["']([^"']+)["']/gi);
        for (const match of imgMatches) {
            imgUrls.push(match[1]);
        }
        
        console.log(`\nFound ${imgUrls.length} images:`);
        imgUrls.forEach((url, i) => {
            console.log(`${i + 1}. ${url}`);
        });
        
        // Look for page navigation or total pages
        const pagePatterns = [
            /page[^0-9]*(\d+)[^0-9]*of[^0-9]*(\d+)/gi,
            /(\d+)[^0-9]*\/[^0-9]*(\d+)/gi,
            /total[^0-9]*(\d+)[^0-9]*page/gi
        ];
        
        console.log('\nLooking for page information:');
        pagePatterns.forEach(pattern => {
            const matches = html.match(pattern);
            if (matches) {
                console.log(`Found: ${matches[0]}`);
            }
        });
        
        // Extract JavaScript variables
        const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        if (scriptMatches) {
            console.log('\nAnalyzing JavaScript:');
            scriptMatches.forEach(script => {
                // Look for array definitions or page configurations
                if (script.includes('pages') || script.includes('images') || script.includes('urls')) {
                    const varMatches = script.match(/(?:var|let|const)\s+(\w+)\s*=\s*\[([^\]]+)\]/g);
                    if (varMatches) {
                        varMatches.forEach(match => {
                            console.log('Found array:', match.substring(0, 100) + '...');
                        });
                    }
                }
            });
        }
        
        // Test if images are accessible
        if (imgUrls.length > 0) {
            console.log('\nTesting first image URL...');
            const testImgUrl = imgUrls[0].startsWith('http') ? imgUrls[0] : `https://viewerd.kbr.be${imgUrls[0]}`;
            const imgResponse = await fetchWithHTTPS(testImgUrl);
            console.log(`Image status: ${imgResponse.status}`);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

analyzeViewer();