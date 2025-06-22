import https from 'https';

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
    });
}

async function testMorganUrls() {
    const testUrls = [
        'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        'https://www.themorgan.org/collection/gospel-book/143812/thumbs'
    ];
    
    console.log('Testing Morgan Library URL extraction...\n');
    
    for (const url of testUrls) {
        try {
            console.log(`Testing URL: ${url}`);
            const pageContent = await fetchUrl(url);
            
            // Extract styled images and convert to high-res
            const styledImageRegex = /\/sites\/default\/files\/styles\/[^"']*\/public\/images\/collection\/[^"'?]+\.jpg/g;
            const styledMatches = pageContent.match(styledImageRegex) || [];
            
            // Extract direct images  
            const directImageRegex = /\/sites\/default\/files\/images\/collection\/[^"'?]+\.jpg/g;
            const directMatches = pageContent.match(directImageRegex) || [];
            
            console.log(`  Found ${styledMatches.length} styled images`);
            console.log(`  Found ${directMatches.length} direct high-res images`);
            
            // Show conversion logic
            const convertedUrls = [];
            for (const match of styledMatches) {
                const originalPath = match.replace(/\/styles\/[^\/]+\/public\//, '/');
                const fullUrl = `https://www.themorgan.org${originalPath}`;
                convertedUrls.push(fullUrl);
            }
            
            for (const match of directMatches) {
                const fullUrl = `https://www.themorgan.org${match}`;
                convertedUrls.push(fullUrl);
            }
            
            // Remove duplicates
            const uniqueUrls = [...new Set(convertedUrls)];
            
            console.log(`  Total images after conversion: ${uniqueUrls.length}`);
            console.log(`  First 3 converted URLs:`);
            
            for (let i = 0; i < Math.min(3, uniqueUrls.length); i++) {
                console.log(`    ${i + 1}: ${uniqueUrls[i]}`);
            }
            
            console.log('  ✅ SUCCESS\n');
            
        } catch (error) {
            console.log(`  ❌ ERROR: ${error.message}\n`);
        }
    }
}

testMorganUrls().catch(console.error);