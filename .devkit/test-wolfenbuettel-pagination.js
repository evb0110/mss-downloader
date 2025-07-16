const fetch = require('node-fetch');

// Test manuscript URLs - some with many pages
const testUrls = [
    { url: 'https://diglib.hab.de/wdb.php?dir=mss/1008-helmst', expected: 'More than 20 pages' },
    { url: 'https://diglib.hab.de/wdb.php?dir=mss/105-noviss-2f', expected: '~20 pages' },
    { url: 'https://diglib.hab.de/wdb.php?dir=mss/532-helmst', expected: 'More than 20 pages' }
];

async function testPagination(manuscriptUrl) {
    console.log(`\nTesting: ${manuscriptUrl}`);
    console.log('='.repeat(80));
    
    const urlMatch = manuscriptUrl.match(/dir=mss\/([^&]+)/);
    if (!urlMatch) {
        console.error('Could not extract manuscript ID');
        return;
    }
    
    const manuscriptId = urlMatch[1];
    const allImageNames = [];
    let pointer = 0;
    let pageCount = 0;
    
    while (true) {
        pageCount++;
        const thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=mss/${manuscriptId}&pointer=${pointer}`;
        console.log(`Page ${pageCount}: Fetching ${thumbsUrl}`);
        
        try {
            const response = await fetch(thumbsUrl);
            if (!response.ok) {
                console.error(`HTTP ${response.status}`);
                break;
            }
            
            const html = await response.text();
            
            // Extract image names
            const imageMatches = html.matchAll(/image=([^'"&]+)/g);
            const imageNames = Array.from(imageMatches, m => m[1]);
            
            // Filter out duplicates (navigation links)
            const uniqueImages = [...new Set(imageNames)];
            
            if (uniqueImages.length > 0) {
                allImageNames.push(...uniqueImages);
                console.log(`  Found ${uniqueImages.length} unique images (total: ${allImageNames.length})`);
                
                // Check for next page
                const nextMatch = html.match(/pointer=(\d+)['"][^>]*>Vorwärts/);
                if (nextMatch) {
                    pointer = parseInt(nextMatch[1], 10);
                    console.log(`  Next page pointer: ${pointer}`);
                } else {
                    console.log('  No more pages');
                    break;
                }
            } else {
                console.log('  No images found');
                break;
            }
            
        } catch (error) {
            console.error(`Error: ${error.message}`);
            break;
        }
        
        // Safety limit
        if (pageCount > 50) {
            console.warn('Safety limit reached');
            break;
        }
    }
    
    // Remove duplicates from final list
    const finalImages = [...new Set(allImageNames)];
    
    console.log(`\nResults for ${manuscriptId}:`);
    console.log(`- Total pages fetched: ${pageCount}`);
    console.log(`- Total unique images: ${finalImages.length}`);
    console.log(`- First 5 images: ${finalImages.slice(0, 5).join(', ')}`);
    console.log(`- Last 5 images: ${finalImages.slice(-5).join(', ')}`);
    
    return {
        manuscriptId,
        totalImages: finalImages.length,
        images: finalImages
    };
}

async function runTests() {
    console.log('Wolfenbüttel Pagination Test');
    console.log('Testing manuscripts with many pages\n');
    
    for (const test of testUrls) {
        const result = await testPagination(test.url);
        console.log(`\nExpected: ${test.expected}`);
        console.log(`Actual: ${result.totalImages} images`);
        console.log(result.totalImages > 20 ? '✅ PASSED - Got all pages' : '❌ FAILED - Limited to 20');
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

runTests().catch(console.error);