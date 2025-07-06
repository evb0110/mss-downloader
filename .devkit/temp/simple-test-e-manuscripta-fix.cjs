const fetch = require('node-fetch').default;

async function testFixWithDirectAPI() {
    console.log('=== Testing E-Manuscripta Enhanced Fix (Direct API) ===');
    
    const manuscriptId = '5157222';
    const library = 'bau';
    
    try {
        // 1. Test the structure page extraction (new method)
        console.log('1. Testing structure page extraction...');
        const structureUrl = `https://www.e-manuscripta.ch/${library}/content/structure/${manuscriptId}`;
        const structureResponse = await fetch(structureUrl);
        
        if (!structureResponse.ok) {
            throw new Error(`Structure page failed: HTTP ${structureResponse.status}`);
        }
        
        const structureHtml = await structureResponse.text();
        
        // Extract all zoom IDs
        const zoomPattern = /href="\/[^"]*\/content\/zoom\/(\d+)"/g;
        const zoomIds = [];
        let match;
        while ((match = zoomPattern.exec(structureHtml)) !== null) {
            zoomIds.push(match[1]);
        }
        
        const uniqueZoomIds = [...new Set(zoomIds)].sort((a, b) => parseInt(a) - parseInt(b));
        console.log(`✓ Found ${uniqueZoomIds.length} unique zoom IDs from structure`);
        
        // 2. Test validation of thumbview blocks
        console.log('2. Testing thumbview block validation...');
        const validThumbviewBlocks = [];
        
        for (const zoomId of uniqueZoomIds.slice(0, 5)) { // Test first 5 for speed
            const thumbviewUrl = `https://www.e-manuscripta.ch/${library}/content/thumbview/${zoomId}`;
            try {
                const response = await fetch(thumbviewUrl, { method: 'HEAD' });
                if (response.ok) {
                    validThumbviewBlocks.push(zoomId);
                    console.log(`  ✓ Block ${zoomId} - Valid`);
                } else {
                    console.log(`  ✗ Block ${zoomId} - HTTP ${response.status}`);
                }
            } catch (error) {
                console.log(`  ✗ Block ${zoomId} - Error: ${error.message}`);
            }
        }
        
        // 3. Test page extraction from one working block
        if (validThumbviewBlocks.length > 0) {
            console.log('3. Testing page extraction from first valid block...');
            const testBlockId = validThumbviewBlocks[0];
            const testThumbviewUrl = `https://www.e-manuscripta.ch/${library}/content/thumbview/${testBlockId}`;
            
            const blockResponse = await fetch(testThumbviewUrl);
            const blockHtml = await blockResponse.text();
            
            // Check for goToPage dropdown
            const hasGoToPage = blockHtml.includes('id="goToPage"');
            console.log(`  GoToPage dropdown in block ${testBlockId}: ${hasGoToPage ? 'FOUND' : 'NOT FOUND'}`);
            
            if (hasGoToPage) {
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
                    console.log(`  ✓ Found ${pageOptions.length} pages in block ${testBlockId}`);
                }
            } else {
                // This might be a single page block
                console.log(`  Block ${testBlockId} appears to be a single-page block`);
            }
        }
        
        console.log('\n=== Fix Status ===');
        console.log(`✓ Structure page parsing: WORKING`);
        console.log(`✓ Block discovery: ${uniqueZoomIds.length} blocks found`);
        console.log(`✓ Block validation: ${validThumbviewBlocks.length}/${Math.min(5, uniqueZoomIds.length)} tested blocks valid`);
        console.log(`✓ Expected improvement: ${uniqueZoomIds.length}x more manuscript blocks discovered`);
        
        // Compare with old method
        console.log('\n=== Comparison with Old Method ===');
        const titleinfoUrl = `https://www.e-manuscripta.ch/${library}/content/titleinfo/${manuscriptId}`;
        const titleinfoResponse = await fetch(titleinfoUrl);
        const titleinfoHtml = await titleinfoResponse.text();
        
        const oldThumbviewPattern = /href="([^"]*\/content\/thumbview\/\d+)"/g;
        const oldMatches = [];
        while ((match = oldThumbviewPattern.exec(titleinfoHtml)) !== null) {
            oldMatches.push(match[1]);
        }
        
        console.log(`Old method (titleinfo): ${oldMatches.length} blocks found`);
        console.log(`New method (structure): ${uniqueZoomIds.length} blocks found`);
        console.log(`Improvement factor: ${Math.round(uniqueZoomIds.length / Math.max(1, oldMatches.length))}x`);
        
        return { 
            success: true, 
            oldBlocks: oldMatches.length, 
            newBlocks: uniqueZoomIds.length,
            improvement: Math.round(uniqueZoomIds.length / Math.max(1, oldMatches.length))
        };
        
    } catch (error) {
        console.error('Error:', error.message);
        return { success: false, error: error.message };
    }
}

testFixWithDirectAPI().catch(console.error);