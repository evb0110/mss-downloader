const https = require('https');

async function fetchWithHTTPS(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { rejectUnauthorized: false }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, text: () => data }));
        }).on('error', reject);
    });
}

async function analyzeBelgicaKBR() {
    const testUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
    console.log('Analyzing Belgica KBR manuscript:', testUrl);
    
    try {
        const response = await fetchWithHTTPS(testUrl);
        const html = await response.text();
        
        // Look for tile patterns
        const tilePatterns = [
            /tile[^"']*\.(?:jpg|png)/gi,
            /\/tiles?\//gi,
            /getTile/gi,
            /pyramid/gi,
            /dzc_output/gi,
            /ImageServer/gi
        ];
        
        console.log('\nChecking for tile-based image system:');
        tilePatterns.forEach(pattern => {
            const matches = html.match(pattern);
            if (matches) {
                console.log(`Found ${pattern}: ${matches.slice(0, 3).join(', ')}...`);
            }
        });
        
        // Look for viewer initialization
        const viewerPatterns = [
            /new\s+(?:OpenSeadragon|Viewer|ImageViewer)/gi,
            /tileSources/gi,
            /dziPath/gi,
            /imageServer/gi
        ];
        
        console.log('\nChecking for viewer configuration:');
        viewerPatterns.forEach(pattern => {
            const matches = html.match(pattern);
            if (matches) {
                console.log(`Found ${pattern}: ${matches[0]}`);
            }
        });
        
        // Extract JavaScript content
        const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        if (scriptMatches) {
            console.log(`\nFound ${scriptMatches.length} script tags`);
            
            // Look for configuration objects
            scriptMatches.forEach((script, index) => {
                if (script.includes('tileSources') || script.includes('dziPath') || script.includes('tiles')) {
                    console.log(`\nScript ${index} contains tile configuration:`);
                    console.log(script.substring(0, 500) + '...');
                }
            });
        }
        
    } catch (error) {
        console.error('Error analyzing Belgica KBR:', error.message);
    }
}

analyzeBelgicaKBR();