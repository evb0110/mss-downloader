const https = require('https');

// Let's analyze the relationship between the URLs
console.log('🔍 Analyzing University of Graz URL patterns...\n');

// Known working manuscript
const titleinfoId = '8224538';
const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${titleinfoId}/manifest`;

console.log(`Fetching manifest for known working ID ${titleinfoId}...`);

https.get(manifestUrl, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json'
    }
}, (res) => {
    let data = '';
    
    res.on('data', chunk => {
        data += chunk;
    });
    
    res.on('end', () => {
        if (res.statusCode === 200) {
            try {
                const manifest = JSON.parse(data);
                const canvases = manifest.sequences[0].canvases;
                
                console.log(`\nFound ${canvases.length} pages in manifest`);
                console.log('\nAnalyzing page IDs...');
                
                // Check first few and last few pages
                const checkPages = [0, 1, 2, 3, 4, ...Array.from({length: 5}, (_, i) => canvases.length - 5 + i)];
                
                for (const idx of checkPages) {
                    if (idx >= 0 && idx < canvases.length) {
                        const canvas = canvases[idx];
                        const imageUrl = canvas.images[0]?.resource?.['@id'];
                        if (imageUrl) {
                            const pageIdMatch = imageUrl.match(/\/webcache\/\d+\/(\d+)$/);
                            if (pageIdMatch) {
                                const pageId = pageIdMatch[1];
                                console.log(`Page ${idx + 1}: ID ${pageId} - ${imageUrl}`);
                                
                                // Check if this matches our problematic URL
                                if (pageId === '8224544') {
                                    console.log(`\n✅ FOUND! Page ID 8224544 is page ${idx + 1} of manuscript ${titleinfoId}`);
                                }
                            }
                        }
                    }
                }
                
                // Also check for the specific page
                const targetPageId = '8224544';
                const targetPageIdNum = parseInt(targetPageId);
                
                // Check pages around where we'd expect it based on ID
                console.log(`\n\nLooking for page ID ${targetPageId} in the manifest...`);
                
                let found = false;
                for (let i = 0; i < canvases.length; i++) {
                    const canvas = canvases[i];
                    const imageUrl = canvas.images[0]?.resource?.['@id'];
                    if (imageUrl && imageUrl.includes(`/${targetPageId}`)) {
                        console.log(`\n✅ FOUND at position ${i + 1}!`);
                        console.log(`URL: ${imageUrl}`);
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    console.log(`\n❌ Page ID ${targetPageId} not found in this manifest`);
                    
                    // Let's check what the page ID pattern is
                    const firstPageUrl = canvases[0].images[0]?.resource?.['@id'];
                    const firstPageIdMatch = firstPageUrl?.match(/\/webcache\/\d+\/(\d+)$/);
                    if (firstPageIdMatch) {
                        const firstPageId = parseInt(firstPageIdMatch[1]);
                        console.log(`\nFirst page ID: ${firstPageId}`);
                        console.log(`Target page ID: ${targetPageIdNum}`);
                        console.log(`Difference: ${targetPageIdNum - firstPageId}`);
                        
                        if (targetPageIdNum > firstPageId && targetPageIdNum < firstPageId + canvases.length * 2) {
                            console.log(`\nThe page ID ${targetPageId} appears to be within the range of this manuscript`);
                        }
                    }
                }
                
            } catch (e) {
                console.error('Error parsing manifest:', e.message);
            }
        }
    });
}).on('error', (err) => {
    console.error('Error fetching manifest:', err.message);
});