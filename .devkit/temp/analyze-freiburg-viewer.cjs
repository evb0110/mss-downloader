const https = require('https');
const fs = require('fs');

// Deep analysis of Freiburg viewer to extract image URLs
async function analyzeFreiburgViewer() {
    console.log('🔍 Deep Analysis of Freiburg Viewer Implementation...\n');
    
    const testPages = [
        'https://dl.ub.uni-freiburg.de/diglit/hs360a/0001',
        'https://dl.ub.uni-freiburg.de/diglit/hs360a/0010',
        'https://dl.ub.uni-freiburg.de/diglit/hs360a/0050'
    ];
    
    const results = {
        imageUrls: [],
        jsPatterns: [],
        metadataUrls: [],
        viewerTechnology: '',
        navigationMethods: [],
        resolutionOptions: []
    };
    
    for (const pageUrl of testPages) {
        console.log(`\nAnalyzing: ${pageUrl}`);
        
        try {
            const response = await makeRequest(pageUrl);
            const html = response.data;
            
            // Extract image URLs from HTML
            const imageRegexes = [
                /src=["']([^"']*\.jpg[^"']*)["']/gi,
                /src=["']([^"']*\.png[^"']*)["']/gi,
                /url\(["']?([^"')]*\.jpg[^"')]*)["']?\)/gi,
                /background-image:\s*url\(["']?([^"')]*\.jpg[^"')]*)["']?\)/gi,
                /diglitData[^"'\s]+\.jpg/gi,
                /"([^"]*diglitData[^"]*\.jpg[^"]*)"/gi
            ];
            
            for (const regex of imageRegexes) {
                let match;
                while ((match = regex.exec(html)) !== null) {
                    const imageUrl = match[1] || match[0];
                    if (imageUrl && !results.imageUrls.includes(imageUrl)) {
                        results.imageUrls.push(imageUrl);
                        console.log(`  Found image: ${imageUrl}`);
                    }
                }
            }
            
            // Extract JavaScript patterns that might load images
            const jsPatterns = [
                /reload_img\([^)]+\)/gi,
                /image_url\s*=\s*["']([^"']+)["']/gi,
                /img_src\s*=\s*["']([^"']+)["']/gi,
                /zoomlevel\s*=\s*(\d+)/gi,
                /diglit[^"'\s]+/gi
            ];
            
            for (const regex of jsPatterns) {
                let match;
                while ((match = regex.exec(html)) !== null) {
                    results.jsPatterns.push(match[0]);
                }
            }
            
            // Look for metadata or manifest URLs
            const metadataRegexes = [
                /mets\.xml/gi,
                /manifest\.json/gi,
                /metadata[^"'\s]+/gi,
                /dfg-viewer[^"'\s]+/gi
            ];
            
            for (const regex of metadataRegexes) {
                let match;
                while ((match = regex.exec(html)) !== null) {
                    if (!results.metadataUrls.includes(match[0])) {
                        results.metadataUrls.push(match[0]);
                    }
                }
            }
            
            // Check for viewer technology indicators
            if (html.includes('iiif')) {
                results.viewerTechnology = 'IIIF';
            } else if (html.includes('openseadragon')) {
                results.viewerTechnology = 'OpenSeadragon';
            } else if (html.includes('digilib')) {
                results.viewerTechnology = 'Digilib';
            } else {
                results.viewerTechnology = 'Custom Viewer';
            }
            
            // Extract navigation methods
            const navRegexes = [
                /onclick=["']([^"']*next[^"']*)["']/gi,
                /onclick=["']([^"']*prev[^"']*)["']/gi,
                /onclick=["']([^"']*page[^"']*)["']/gi
            ];
            
            for (const regex of navRegexes) {
                let match;
                while ((match = regex.exec(html)) !== null) {
                    if (!results.navigationMethods.includes(match[1])) {
                        results.navigationMethods.push(match[1]);
                    }
                }
            }
            
        } catch (error) {
            console.log(`  Error analyzing ${pageUrl}: ${error.message}`);
        }
    }
    
    // Test the found image URLs
    console.log('\n🖼️  Testing discovered image URLs...');
    for (const imageUrl of results.imageUrls.slice(0, 5)) { // Test first 5
        try {
            let fullUrl = imageUrl;
            if (!imageUrl.startsWith('http')) {
                fullUrl = 'https://dl.ub.uni-freiburg.de' + (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl);
            }
            
            const response = await makeRequest(fullUrl, 'HEAD');
            const size = parseInt(response.headers['content-length']) || 0;
            console.log(`  ${fullUrl} - ${response.statusCode} (${Math.round(size/1024)}KB)`);
        } catch (error) {
            console.log(`  ${imageUrl} - Error: ${error.message}`);
        }
    }
    
    console.log('\n📊 Analysis Results:');
    console.log(JSON.stringify(results, null, 2));
    
    // Save results
    fs.writeFileSync('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/freiburg-viewer-analysis.json', 
        JSON.stringify(results, null, 2));
    
    console.log('\n✅ Viewer analysis complete.');
    
    return results;
}

function makeRequest(url, method = 'GET') {
    return new Promise((resolve, reject) => {
        const options = {
            method,
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        };
        
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data
                });
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => reject(new Error('Request timeout')));
        req.end();
    });
}

analyzeFreiburgViewer().catch(console.error);