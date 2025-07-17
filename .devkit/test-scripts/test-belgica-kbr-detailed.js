const https = require('https');
const fs = require('fs');

async function fetchWithHTTPS(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { rejectUnauthorized: false }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, text: () => data, status: res.statusCode }));
        }).on('error', reject);
    });
}

async function analyzeBelgicaKBRDetailed() {
    const testUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
    console.log('Performing detailed analysis of Belgica KBR...\n');
    
    try {
        const response = await fetchWithHTTPS(testUrl);
        const html = await response.text();
        
        // Save HTML for inspection
        fs.writeFileSync('.devkit/reports/belgica-kbr-page.html', html);
        console.log('Saved HTML to .devkit/reports/belgica-kbr-page.html');
        
        // Look for iframe
        const iframeMatch = html.match(/<iframe[^>]*src=["']([^"']+)["']/i);
        if (iframeMatch) {
            console.log('\nFound iframe:', iframeMatch[1]);
            
            // Fetch iframe content
            const iframeUrl = iframeMatch[1].startsWith('http') ? iframeMatch[1] : `https://belgica.kbr.be${iframeMatch[1]}`;
            const iframeResponse = await fetchWithHTTPS(iframeUrl);
            const iframeHtml = await iframeResponse.text();
            
            fs.writeFileSync('.devkit/reports/belgica-kbr-iframe.html', iframeHtml);
            console.log('Saved iframe content to .devkit/reports/belgica-kbr-iframe.html');
            
            // Analyze iframe content
            console.log('\nAnalyzing iframe content...');
            
            // Look for image URLs
            const imgPatterns = [
                /<img[^>]*src=["']([^"']+)["']/gi,
                /url\(['"]([^'"]+\.(?:jpg|jpeg|png|gif))['"]\)/gi,
                /\/image\/[^"'\s]+/gi,
                /\.jpg[^"'\s]*/gi,
                /\.png[^"'\s]*/gi
            ];
            
            imgPatterns.forEach(pattern => {
                const matches = [...iframeHtml.matchAll(pattern)];
                if (matches.length > 0) {
                    console.log(`\nFound ${matches.length} matches for ${pattern}:`);
                    matches.slice(0, 3).forEach(match => {
                        console.log(`  - ${match[0]}`);
                    });
                }
            });
            
            // Look for JavaScript configurations
            const scriptContent = iframeHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
            if (scriptContent) {
                scriptContent.forEach((script, index) => {
                    if (script.includes('image') || script.includes('page') || script.includes('viewer')) {
                        console.log(`\nScript ${index} contains viewer-related code:`);
                        const cleanScript = script.replace(/<\/?script[^>]*>/gi, '').trim();
                        if (cleanScript.length > 0) {
                            console.log(cleanScript.substring(0, 300) + '...');
                        }
                    }
                });
            }
        }
        
        // Look for data attributes or API endpoints
        const apiPatterns = [
            /data-[^=]*=["'][^"']*api[^"']*["']/gi,
            /\/api\/[^"'\s]+/gi,
            /getImage[^"'\s]*/gi,
            /imageserver[^"'\s]*/gi
        ];
        
        console.log('\n\nLooking for API endpoints:');
        apiPatterns.forEach(pattern => {
            const matches = html.match(pattern);
            if (matches) {
                console.log(`Found ${pattern}: ${matches.slice(0, 3).join(', ')}`);
            }
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

analyzeBelgicaKBRDetailed();