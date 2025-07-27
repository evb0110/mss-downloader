const https = require('https');

const testUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';

function checkRedirect(url) {
    return new Promise((resolve) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (response) => {
            console.log('URL:', url);
            console.log('Status:', response.statusCode);
            console.log('Location:', response.headers.location);
            
            if (response.statusCode === 301 || response.statusCode === 302) {
                const newUrl = response.headers.location;
                if (newUrl) {
                    console.log('\nFollowing redirect...');
                    checkRedirect(newUrl).then(resolve);
                } else {
                    resolve();
                }
            } else {
                // Read content
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    console.log('Content length:', data.length);
                    
                    // Check for page links
                    const pageLinks = data.match(/\/collection\/lindau-gospels\/\d+/g);
                    if (pageLinks) {
                        const unique = [...new Set(pageLinks)];
                        console.log(`Found ${unique.length} page links`);
                        console.log('Sample:', unique.slice(0, 5).join(', '));
                    }
                    
                    resolve();
                });
            }
        }).on('error', (err) => {
            console.error('Error:', err.message);
            resolve();
        });
    });
}

checkRedirect(testUrl).catch(console.error);