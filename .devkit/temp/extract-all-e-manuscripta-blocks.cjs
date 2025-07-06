const fetch = require('node-fetch').default;
const fs = require('fs');

async function extractAllEManuscriptaBlocks() {
    console.log('=== Extract All E-Manuscripta Blocks ===');
    
    // Read the saved structure HTML
    const html = fs.readFileSync('.devkit/temp/structure-5157222.html', 'utf8');
    
    console.log('1. Extracting all zoom block IDs from structure...');
    
    // Extract all zoom URLs from the structure
    const zoomPattern = /href="\/bau\/content\/zoom\/(\d+)"/g;
    const zoomIds = [];
    let match;
    while ((match = zoomPattern.exec(html)) !== null) {
        zoomIds.push(match[1]);
    }
    
    console.log(`Found ${zoomIds.length} zoom block IDs:`, zoomIds);
    
    // Remove duplicates and sort
    const uniqueZoomIds = [...new Set(zoomIds)].sort((a, b) => parseInt(a) - parseInt(b));
    console.log(`Unique zoom block IDs (${uniqueZoomIds.length}):`, uniqueZoomIds);
    
    // Now let's test each one to see which ones are valid thumbview blocks
    console.log('\n2. Testing which zoom IDs have corresponding thumbview blocks...');
    
    const validThumbviewBlocks = [];
    
    for (const zoomId of uniqueZoomIds) {
        const thumbviewUrl = `https://www.e-manuscripta.ch/bau/content/thumbview/${zoomId}`;
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
    
    // Let's also check the page count for each valid block
    console.log('\n3. Checking page counts for valid blocks...');
    
    const blockPageCounts = [];
    
    for (const blockId of validThumbviewBlocks.slice(0, 5)) { // Test first 5 blocks
        const thumbviewUrl = `https://www.e-manuscripta.ch/bau/content/thumbview/${blockId}`;
        try {
            const response = await fetch(thumbviewUrl);
            if (response.ok) {
                const html = await response.text();
                
                // Look for page dropdown to understand page count
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
                    
                    const pageCount = pageOptions.length;
                    const firstPage = pageOptions[0]?.pageNumber || 'N/A';
                    const lastPage = pageOptions[pageOptions.length - 1]?.pageNumber || 'N/A';
                    
                    blockPageCounts.push({
                        blockId,
                        pageCount,
                        firstPage,
                        lastPage,
                        pageRange: `[${firstPage}-${lastPage}]`
                    });
                    
                    console.log(`  Block ${blockId}: ${pageCount} pages, range [${firstPage}-${lastPage}]`);
                } else {
                    console.log(`  Block ${blockId}: No page dropdown found`);
                }
            }
        } catch (error) {
            console.log(`  Block ${blockId}: ERROR - ${error.message}`);
        }
    }
    
    console.log('\n4. Summary of findings:');
    console.log(`  - Total unique zoom IDs in structure: ${uniqueZoomIds.length}`);
    console.log(`  - Valid thumbview blocks: ${validThumbviewBlocks.length}`);
    console.log(`  - Tested page counts for: ${blockPageCounts.length} blocks`);
    
    // Show the specific blocks that the user mentioned
    console.log('\n5. Checking user-mentioned blocks:');
    const userMentionedBlocks = ['5157616', '5157228', '5157615'];
    
    for (const blockId of userMentionedBlocks) {
        const isInStructure = uniqueZoomIds.includes(blockId);
        const isValidThumbview = validThumbviewBlocks.includes(blockId);
        
        console.log(`  Block ${blockId}:`);
        console.log(`    - In structure: ${isInStructure ? 'YES' : 'NO'}`);
        console.log(`    - Valid thumbview: ${isValidThumbview ? 'YES' : 'NO'}`);
    }
    
    // Save the results
    const results = {
        manuscriptId: '5157222',
        allZoomIds: uniqueZoomIds,
        validThumbviewBlocks: validThumbviewBlocks,
        blockPageCounts: blockPageCounts,
        userMentionedBlocks: userMentionedBlocks.map(blockId => ({
            blockId,
            inStructure: uniqueZoomIds.includes(blockId),
            validThumbview: validThumbviewBlocks.includes(blockId)
        }))
    };
    
    fs.writeFileSync('.devkit/temp/e-manuscripta-blocks-analysis.json', JSON.stringify(results, null, 2));
    console.log('\n6. Results saved to .devkit/temp/e-manuscripta-blocks-analysis.json');
    
    console.log('\n=== Analysis Complete ===');
}

extractAllEManuscriptaBlocks().catch(console.error);