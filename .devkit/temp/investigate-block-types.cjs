const fetch = require('node-fetch').default;

async function investigateBlockTypes() {
    console.log('=== Investigating E-Manuscripta Block Types ===');
    
    const library = 'bau';
    const testBlocks = ['5157225', '5157227', '5157616']; // First two failed, last one should work
    
    for (const blockId of testBlocks) {
        console.log(`\n=== Testing Block ${blockId} ===`);
        
        const thumbviewUrl = `https://www.e-manuscripta.ch/${library}/content/thumbview/${blockId}`;
        
        try {
            const response = await fetch(thumbviewUrl);
            if (!response.ok) {
                console.log(`❌ Failed to fetch: HTTP ${response.status}`);
                continue;
            }
            
            const html = await response.text();
            console.log(`✓ Fetched HTML: ${html.length} characters`);
            
            // Check for goToPage dropdown
            const hasGoToPage = html.includes('id="goToPage"');
            console.log(`GoToPage dropdown: ${hasGoToPage ? 'FOUND' : 'NOT FOUND'}`);
            
            if (hasGoToPage) {
                // Extract page count
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
                    console.log(`✓ Found ${pageOptions.length} pages in dropdown`);
                    if (pageOptions.length > 0) {
                        console.log(`  First page: [${pageOptions[0].pageNumber}] ID=${pageOptions[0].pageId}`);
                        console.log(`  Last page: [${pageOptions[pageOptions.length - 1].pageNumber}] ID=${pageOptions[pageOptions.length - 1].pageId}`);
                    }
                }
            } else {
                // Check if it's a single page block
                console.log('Checking for single page indicators...');
                
                // Look for image URLs or page IDs
                const imagePattern = /download\/webcache\/\d+\/(\d+)/g;
                const imageMatches = [];
                let match;
                while ((match = imagePattern.exec(html)) !== null) {
                    imageMatches.push(match[1]);
                }
                
                const uniqueImageIds = [...new Set(imageMatches)];
                console.log(`Found ${uniqueImageIds.length} unique image IDs:`, uniqueImageIds.slice(0, 5));
                
                // Look for title to understand what this block represents
                const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                if (titleMatch && titleMatch[1]) {
                    console.log(`Title: ${titleMatch[1].trim()}`);
                }
                
                // Look for any pagination or navigation hints
                const navPattern = /\[(\d+)\]/g;
                const navMatches = [];
                while ((match = navPattern.exec(html)) !== null) {
                    navMatches.push(match[1]);
                }
                
                const uniqueNavNumbers = [...new Set(navMatches)];
                console.log(`Navigation numbers found: ${uniqueNavNumbers.length} (${uniqueNavNumbers.slice(0, 10).join(', ')})`);
                
                // Check if this might be a cover or special page
                const specialKeywords = ['cover', 'spine', 'binding', 'front', 'back', 'edge'];
                const hasSpecialKeyword = specialKeywords.some(keyword => 
                    html.toLowerCase().includes(keyword)
                );
                console.log(`Special page type: ${hasSpecialKeyword ? 'LIKELY' : 'UNLIKELY'}`);
            }
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }
    
    console.log('\n=== Summary ===');
    console.log('Some blocks may be single pages (covers, special pages) without pagination');
    console.log('The multi-block approach is still valid but needs to handle different block types');
}

investigateBlockTypes().catch(console.error);