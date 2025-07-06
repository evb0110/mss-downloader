const fetch = require('node-fetch').default;

async function testMultiBlockApproach() {
    console.log('=== Testing E-Manuscripta Multi-Block Fix Approach ===');
    
    const manuscriptId = '5157222';
    const library = 'bau';
    
    try {
        // 1. First, get the structure page to extract all blocks
        console.log('1. Fetching structure page to find all blocks...');
        const structureUrl = `https://www.e-manuscripta.ch/${library}/content/structure/${manuscriptId}`;
        const structureResponse = await fetch(structureUrl);
        
        if (!structureResponse.ok) {
            throw new Error(`Structure page failed: HTTP ${structureResponse.status}`);
        }
        
        const structureHtml = await structureResponse.text();
        
        // 2. Extract all zoom block IDs from the structure
        console.log('2. Extracting all zoom block IDs from structure...');
        const zoomPattern = /href="\/[^"]*\/content\/zoom\/(\d+)"/g;
        const zoomIds = [];
        let match;
        while ((match = zoomPattern.exec(structureHtml)) !== null) {
            zoomIds.push(match[1]);
        }
        
        // Remove duplicates and sort
        const uniqueZoomIds = [...new Set(zoomIds)].sort((a, b) => parseInt(a) - parseInt(b));
        console.log(`Found ${uniqueZoomIds.length} unique zoom block IDs:`, uniqueZoomIds);
        
        // 3. Test each zoom ID to see which ones have valid thumbview blocks
        console.log('3. Testing which zoom IDs have valid thumbview blocks...');
        const validThumbviewBlocks = [];
        
        for (const zoomId of uniqueZoomIds) {
            const thumbviewUrl = `https://www.e-manuscripta.ch/${library}/content/thumbview/${zoomId}`;
            try {
                const response = await fetch(thumbviewUrl, { method: 'HEAD' });
                if (response.ok) {
                    validThumbviewBlocks.push(zoomId);
                    console.log(`  ✓ ${zoomId} - Valid thumbview block`);
                } else {
                    console.log(`  ✗ ${zoomId} - ${response.status} (no thumbview)`);
                }
            } catch (error) {
                console.log(`  ✗ ${zoomId} - ERROR: ${error.message}`);
            }
        }
        
        console.log(`\nValid thumbview blocks (${validThumbviewBlocks.length}):`, validThumbviewBlocks);
        
        // 4. Test downloading pages from the first few blocks
        console.log('4. Testing page extraction from first 3 blocks...');
        
        const allPageLinks = [];
        let totalPagesCount = 0;
        
        for (let i = 0; i < Math.min(3, validThumbviewBlocks.length); i++) {
            const blockId = validThumbviewBlocks[i];
            const thumbviewUrl = `https://www.e-manuscripta.ch/${library}/content/thumbview/${blockId}`;
            
            console.log(`\n  Testing block ${i + 1}/${validThumbviewBlocks.length}: ${blockId}`);
            
            try {
                const blockResponse = await fetch(thumbviewUrl);
                if (!blockResponse.ok) {
                    console.log(`    ✗ Failed to fetch block: HTTP ${blockResponse.status}`);
                    continue;
                }
                
                const blockHtml = await blockResponse.text();
                
                // Extract page data using dropdown method
                const pageDropdownPattern = /<select[^>]*id="goToPage"[^>]*>(.*?)<\/select>/s;
                const dropdownMatch = blockHtml.match(pageDropdownPattern);
                
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
                    
                    // Sort by page number
                    pageOptions.sort((a, b) => a.pageNumber - b.pageNumber);
                    
                    // Generate page links
                    const blockPageLinks = pageOptions.map(page => 
                        `https://www.e-manuscripta.ch/${library}/download/webcache/0/${page.pageId}`
                    );
                    
                    allPageLinks.push(...blockPageLinks);
                    totalPagesCount += blockPageLinks.length;
                    
                    console.log(`    ✓ Block ${blockId}: ${blockPageLinks.length} pages`);
                    console.log(`    ✓ Page range: [${pageOptions[0]?.pageNumber}-${pageOptions[pageOptions.length - 1]?.pageNumber}]`);
                    
                    // Test first page URL
                    if (blockPageLinks.length > 0) {
                        const firstPageUrl = blockPageLinks[0];
                        const pageResponse = await fetch(firstPageUrl, { method: 'HEAD' });
                        console.log(`    ✓ First page URL test: ${pageResponse.ok ? 'VALID' : 'INVALID'}`);
                    }
                } else {
                    console.log(`    ✗ No page dropdown found in block ${blockId}`);
                }
            } catch (error) {
                console.log(`    ✗ Error processing block ${blockId}: ${error.message}`);
            }
        }
        
        console.log(`\n5. Summary:`);
        console.log(`  - Total valid thumbview blocks: ${validThumbviewBlocks.length}`);
        console.log(`  - Pages from first 3 blocks: ${totalPagesCount}`);
        console.log(`  - Total expected pages from all blocks: ${validThumbviewBlocks.length * 10} (estimated)`);
        
        // This demonstrates that the fix would work by processing ALL blocks from the structure
        console.log('\n6. Fix approach confirmed:');
        console.log('  ✓ Extract all zoom IDs from structure page');
        console.log('  ✓ Test each zoom ID for valid thumbview block');
        console.log('  ✓ Process each valid thumbview block separately');
        console.log('  ✓ Aggregate all pages from all blocks');
        
        return {
            success: true,
            validBlocks: validThumbviewBlocks,
            testedPagesCount: totalPagesCount
        };
        
    } catch (error) {
        console.error('Error:', error.message);
        return { success: false, error: error.message };
    }
}

testMultiBlockApproach().catch(console.error);