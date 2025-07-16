const fetch = require('node-fetch');

async function testWolfenbuettel() {
    const manuscriptId = '1008-helmst';
    console.log(`Testing Wolfenbüttel manuscript: ${manuscriptId}`);
    
    const allImageNames = [];
    let pointer = 0;
    let pageCount = 0;
    let hasMorePages = true;
    
    console.time('Total fetch time');
    
    while (hasMorePages && pageCount < 50) { // Safety limit
        pageCount++;
        const thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=mss/${manuscriptId}&pointer=${pointer}`;
        
        const response = await fetch(thumbsUrl);
        if (response.ok) {
            const html = await response.text();
            
            // Extract image names
            const imageMatches = html.matchAll(/image=([^'"&]+)/g);
            const imageNames = Array.from(imageMatches, m => m[1]);
            
            if (imageNames.length > 0) {
                allImageNames.push(...imageNames);
                console.log(`Page ${pageCount}: Found ${imageNames.length} images at pointer=${pointer} (total: ${allImageNames.length})`);
                
                // Check for next page
                const nextPageMatch = html.match(/href="thumbs\.php\?dir=mss\/[^&]+&pointer=(\d+)"[^>]*><img[^>]*title="forward"/);
                if (nextPageMatch) {
                    const nextPointer = parseInt(nextPageMatch[1], 10);
                    if (nextPointer === pointer) {
                        console.log('Reached last page (forward points to same page)');
                        hasMorePages = false;
                    } else {
                        pointer = nextPointer;
                    }
                } else {
                    console.log('No forward button found');
                    hasMorePages = false;
                }
            } else {
                hasMorePages = false;
            }
        } else {
            hasMorePages = false;
        }
    }
    
    console.timeEnd('Total fetch time');
    
    // Deduplicate
    const uniqueImages = [...new Set(allImageNames)];
    
    console.log('\nResults:');
    console.log(`- Pages fetched: ${pageCount}`);
    console.log(`- Total images collected: ${allImageNames.length}`);
    console.log(`- Unique images: ${uniqueImages.length}`);
    console.log(`- First image: ${uniqueImages[0]}`);
    console.log(`- Last image: ${uniqueImages[uniqueImages.length - 1]}`);
    
    if (uniqueImages.length > 20) {
        console.log('\n✅ SUCCESS: Found all pages!');
    }
}

testWolfenbuettel().catch(console.error);