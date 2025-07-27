const https = require('https');

async function fetchPageContent(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function testMorganPages() {
    const manuscriptId = 'lindau-gospels';
    const baseUrl = 'https://www.themorgan.org/collection';
    
    console.log('Testing multiple Morgan Library pages...\n');
    
    // Test the first few pages
    const pagesToTest = [1, 2, 3, 4, 5];
    const foundImages = [];
    
    for (const pageNum of pagesToTest) {
        const pageUrl = `${baseUrl}/${manuscriptId}/${pageNum}`;
        console.log(`\nFetching page ${pageNum}: ${pageUrl}`);
        
        try {
            const content = await fetchPageContent(pageUrl);
            console.log(`Page content length: ${content.length} characters`);
            
            // Look for all image patterns
            const patterns = [
                { name: 'facsimile', regex: /\/sites\/default\/files\/facsimile\/[^"']+\/([^"']+\.jpg)/g },
                { name: 'images/collection', regex: /\/images\/collection\/([^"'?]+\.jpg)/g },
                { name: 'direct jpg', regex: /https?:\/\/[^"']*themorgan\.org[^"']*\.jpg/g },
                { name: 'data-src', regex: /data-src="([^"]+\.jpg)"/g },
                { name: 'src attribute', regex: /src="([^"]+\.jpg)"/g }
            ];
            
            for (const pattern of patterns) {
                const matches = [...content.matchAll(pattern.regex)];
                if (matches.length > 0) {
                    console.log(`  ${pattern.name}: found ${matches.length} matches`);
                    matches.slice(0, 3).forEach(match => {
                        const img = match[0].includes('http') ? match[0] : match[1];
                        console.log(`    - ${img}`);
                        if (!img.includes('thumb') && !img.includes('icon') && !img.includes('logo')) {
                            foundImages.push({ page: pageNum, url: img, type: pattern.name });
                        }
                    });
                }
            }
            
            // Special check for manuscript number pattern
            const manuscriptNumMatch = content.match(/76874v_(\d+)/);
            if (manuscriptNumMatch) {
                console.log(`  Found manuscript number pattern: 76874v_${manuscriptNumMatch[1]}`);
            }
            
        } catch (error) {
            console.error(`  Error fetching page ${pageNum}: ${error.message}`);
        }
        
        // Small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n\nSummary of found images:');
    console.log(`Total unique images found: ${foundImages.length}`);
    
    // Group by type
    const byType = {};
    foundImages.forEach(img => {
        if (!byType[img.type]) byType[img.type] = [];
        byType[img.type].push(img);
    });
    
    for (const [type, images] of Object.entries(byType)) {
        console.log(`\n${type}: ${images.length} images`);
        images.slice(0, 3).forEach(img => {
            console.log(`  Page ${img.page}: ${img.url}`);
        });
    }
    
    // Check if we can construct ZIF URLs
    console.log('\n\nPotential ZIF URLs:');
    const zifUrls = foundImages
        .filter(img => img.url.includes('facsimile'))
        .map(img => {
            const match = img.url.match(/([^/]+)\.jpg$/);
            if (match) {
                const imageId = match[1];
                return `https://host.themorgan.org/facsimile/images/${manuscriptId}/${imageId}.zif`;
            }
            return null;
        })
        .filter(url => url !== null);
    
    zifUrls.slice(0, 5).forEach(url => console.log(`  ${url}`));
}

testMorganPages();