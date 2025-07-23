const fs = require('fs');
const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

const fetchFn = (url, options = {}) => {
    const https = require('https');
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                // Remove encoding to avoid compression issues
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                ...options.headers
            },
            timeout: 30000
        };

        https.get(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // Save the HTML to file for inspection
                fs.writeFileSync('/tmp/florence_from_loader.html', data);
                console.log('HTML saved to /tmp/florence_from_loader.html');
                console.log('HTML length:', data.length);
                console.log('Contains __INITIAL_STATE__:', data.includes('__INITIAL_STATE__'));
                
                // Test the regex
                const testMatch = data.match(/window\.__INITIAL_STATE__\s*=\s*JSON\.parse\s*\(\s*"([^"]*(?:\\.[^"]*)*)"\s*\)\s*;/);
                console.log('Regex matches:', !!testMatch);
                
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: async () => data,
                    json: async () => JSON.parse(data)
                });
            });
        }).on('error', reject);
    });
};

async function debugFlorenceHTML() {
    console.log('=== Debug Florence HTML Processing ===\n');
    
    const loader = new SharedManifestLoaders(fetchFn);
    
    // Manually test the fetch first
    const url = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
    console.log('Testing fetchWithRetry...');
    
    try {
        const response = await loader.fetchWithRetry(url);
        const html = await response.text();
        
        console.log('Response OK:', response.ok);
        console.log('HTML length from loader:', html.length);
        console.log('Contains __INITIAL_STATE__:', html.includes('__INITIAL_STATE__'));
        
        const testMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*JSON\.parse\s*\(\s*"([^"]*(?:\\.[^"]*)*)"\s*\)\s*;/);
        console.log('Regex matches from loader:', !!testMatch);
        
        if (testMatch) {
            console.log('Match length:', testMatch[1].length);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugFlorenceHTML().catch(console.error);