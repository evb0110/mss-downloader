const fetch = require('node-fetch').default;

async function investigateRangeBlocks() {
    console.log('=== Investigating E-Manuscripta Range-Based Blocks ===');
    
    // The user mentioned these specific URLs with page ranges
    const userMentionedBlocks = [
        'https://www.e-manuscripta.ch/bau/content/thumbview/5157616', // [1-20]
        'https://www.e-manuscripta.ch/bau/content/thumbview/5157228', // User claimed this exists 
        'https://www.e-manuscripta.ch/bau/content/thumbview/5157615'  // User claimed this exists
    ];
    
    console.log('1. Testing user-mentioned blocks...');
    
    for (const url of userMentionedBlocks) {
        const blockId = url.split('/').pop();
        console.log(`\n=== Testing block ${blockId} ===`);
        
        try {
            const response = await fetch(url);
            console.log(`Status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const html = await response.text();
                
                // Extract title to see page range
                const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                if (titleMatch && titleMatch[1]) {
                    console.log(`Title: ${titleMatch[1].trim()}`);
                }
                
                // Look for goToPage dropdown
                const hasGoToPage = html.includes('id="goToPage"');
                console.log(`GoToPage dropdown: ${hasGoToPage ? 'FOUND' : 'NOT FOUND'}`);
                
                if (hasGoToPage) {
                    const pageDropdownPattern = /<select[^>]*id="goToPage"[^>]*>(.*?)<\/select>/s;
                    const dropdownMatch = html.match(pageDropdownPattern);
                    
                    if (dropdownMatch) {
                        const optionPattern = /<option[^>]*value="(\d+)"[^>]*>\s*\[(\d+)\]\s*/g;
                        const pageOptions = [];
                        let optionMatch;
                        while ((optionMatch = optionPattern.exec(dropdownMatch[1])) !== null) {
                            pageOptions.push({
                                pageId: optionMatch[1],
                                pageNumber: parseInt(optionMatch[2])
                            });
                        }
                        
                        pageOptions.sort((a, b) => a.pageNumber - b.pageNumber);
                        console.log(`✓ Found ${pageOptions.length} pages with goToPage dropdown`);
                        
                        if (pageOptions.length > 0) {
                            console.log(`  First page: [${pageOptions[0].pageNumber}] ID=${pageOptions[0].pageId}`);
                            console.log(`  Last page: [${pageOptions[pageOptions.length - 1].pageNumber}] ID=${pageOptions[pageOptions.length - 1].pageId}`);
                            
                            // Test downloading first page
                            const firstPageUrl = `https://www.e-manuscripta.ch/bau/download/webcache/0/${pageOptions[0].pageId}`;
                            const imageResponse = await fetch(firstPageUrl, { method: 'HEAD' });
                            console.log(`  First page URL test: ${imageResponse.ok ? 'VALID' : 'INVALID'}`);
                        }
                    }
                } else {
                    // Look for range indicators or other patterns
                    const rangePattern = /\[(\d+)-(\d+)\]/g;
                    const rangeMatches = [];
                    let match;
                    while ((match = rangePattern.exec(html)) !== null) {
                        rangeMatches.push(`[${match[1]}-${match[2]}]`);
                    }
                    
                    if (rangeMatches.length > 0) {
                        console.log(`Page ranges found: ${rangeMatches.join(', ')}`);
                    }
                    
                    // Look for image references
                    const imagePattern = /download\/webcache\/\d+\/(\d+)/g;
                    const imageIds = [];
                    while ((match = imagePattern.exec(html)) !== null) {
                        imageIds.push(match[1]);
                    }
                    
                    const uniqueImageIds = [...new Set(imageIds)];
                    console.log(`Unique image IDs: ${uniqueImageIds.length} (${uniqueImageIds.slice(0, 5).join(', ')})`);
                }
            }
        } catch (error) {
            console.log(`Error: ${error.message}`);
        }
    }
    
    // Now let's look at the sequential pattern around the mentioned ranges
    console.log('\n2. Testing sequential pattern discovery...');
    
    // Test range around 5157228 (mentioned by user but not in structure)
    const testRange = [];
    for (let i = 5157220; i <= 5157235; i++) {
        testRange.push(i);
    }
    
    console.log(`Testing blocks in range ${testRange[0]} to ${testRange[testRange.length - 1]}:`);
    
    for (const blockId of testRange) {
        const url = `https://www.e-manuscripta.ch/bau/content/thumbview/${blockId}`;
        try {
            const response = await fetch(url, { method: 'HEAD' });
            if (response.ok) {
                console.log(`  ✓ ${blockId} - VALID`);
            }
        } catch (error) {
            // Silent fail for testing
        }
    }
    
    console.log('\n=== Analysis Complete ===');
    console.log('Key findings:');
    console.log('- Need to identify which blocks have actual goToPage dropdowns');
    console.log('- Many blocks may be single-page references to covers/special pages');
    console.log('- The real multi-page content blocks need proper identification');
}

investigateRangeBlocks().catch(console.error);