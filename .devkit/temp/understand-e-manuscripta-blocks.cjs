const fetch = require('node-fetch').default;

async function understandEManuscriptaBlocks() {
    console.log('=== Understanding E-Manuscripta Block Architecture ===');
    
    // Test one block that should have the main content
    const mainBlock = '5157616'; // [1-20] from title
    const rangeBlock1 = '5157228'; // [8-27] from title  
    const rangeBlock2 = '5157615'; // [404-423] from title
    
    console.log('1. Investigating block architecture...');
    
    for (const blockInfo of [
        { id: mainBlock, expectedRange: '[1-20]' },
        { id: rangeBlock1, expectedRange: '[8-27]' },
        { id: rangeBlock2, expectedRange: '[404-423]' }
    ]) {
        console.log(`\n=== Block ${blockInfo.id} (expected: ${blockInfo.expectedRange}) ===`);
        
        const thumbviewUrl = `https://www.e-manuscripta.ch/bau/content/thumbview/${blockInfo.id}`;
        
        try {
            const response = await fetch(thumbviewUrl);
            const html = await response.text();
            
            // Look for ANY form of page navigation or page structure
            console.log('Searching for page navigation patterns...');
            
            // Pattern 1: Look for any select dropdowns (not just goToPage)
            const selectPattern = /<select[^>]*>(.*?)<\/select>/gs;
            const selectMatches = html.match(selectPattern);
            if (selectMatches) {
                console.log(`  Found ${selectMatches.length} select elements`);
                selectMatches.forEach((select, i) => {
                    if (select.includes('option') && select.includes('[')) {
                        console.log(`    Select ${i + 1}: Contains page options`);
                        // Extract first few options
                        const optionPattern = /<option[^>]*>([^<]+)<\/option>/g;
                        const options = [];
                        let match;
                        while ((match = optionPattern.exec(select)) !== null && options.length < 5) {
                            options.push(match[1].trim());
                        }
                        console.log(`      Sample options: ${options.join(', ')}`);
                    }
                });
            }
            
            // Pattern 2: Look for numbered navigation links
            const navLinkPattern = /<a[^>]*href="[^"]*"[^>]*>\s*\[(\d+)\]\s*<\/a>/g;
            const navLinks = [];
            let match;
            while ((match = navLinkPattern.exec(html)) !== null) {
                navLinks.push(parseInt(match[1]));
            }
            
            if (navLinks.length > 0) {
                console.log(`  Found ${navLinks.length} numbered navigation links: [${navLinks.slice(0, 10).join(', ')}${navLinks.length > 10 ? '...' : ''}]`);
            }
            
            // Pattern 3: Look for JavaScript data or configuration
            const scriptPattern = /<script[^>]*>(.*?)<\/script>/gs;
            const scripts = html.match(scriptPattern);
            if (scripts) {
                for (const script of scripts) {
                    if (script.includes('pages') || script.includes('pageId') || script.includes('5157')) {
                        console.log(`  Found relevant JavaScript configuration`);
                        // Extract any numeric arrays or page data
                        const numberArrayPattern = /\[[\d\s,]+\]/g;
                        const arrays = script.match(numberArrayPattern);
                        if (arrays) {
                            console.log(`    Numeric arrays found: ${arrays.slice(0, 3).join(', ')}`);
                        }
                        break;
                    }
                }
            }
            
            // Pattern 4: Look for any URLs that might contain page sequences
            const urlPattern = /webcache\/\d+\/(\d+)/g;
            const imageIds = [];
            while ((match = urlPattern.exec(html)) !== null) {
                imageIds.push(match[1]);
            }
            
            const uniqueImageIds = [...new Set(imageIds)];
            console.log(`  Image IDs found: ${uniqueImageIds.length} unique (${uniqueImageIds.slice(0, 5).join(', ')})`);
            
            // Pattern 5: Check if this block is a "view" into a larger sequence
            // Look for any indication of page ranges or sequences
            const pageSequencePattern = /(\d+)\s*-\s*(\d+)/g;
            const ranges = [];
            while ((match = pageSequencePattern.exec(html)) !== null) {
                ranges.push(`${match[1]}-${match[2]}`);
            }
            
            if (ranges.length > 0) {
                console.log(`  Page ranges in content: ${ranges.slice(0, 5).join(', ')}`);
            }
            
        } catch (error) {
            console.log(`  Error: ${error.message}`);
        }
    }
    
    // 2. Test a hypothesis: maybe we need to construct URLs differently
    console.log('\n2. Testing URL construction hypothesis...');
    
    // If all blocks point to the same base image ID (5157616), maybe we need to
    // construct sequential page URLs based on that base ID?
    const baseImageId = 5157616;
    console.log(`Testing sequential page construction from base ID ${baseImageId}:`);
    
    for (let i = 0; i < 10; i++) {
        const testPageId = baseImageId + i;
        const testUrl = `https://www.e-manuscripta.ch/bau/download/webcache/0/${testPageId}`;
        
        try {
            const response = await fetch(testUrl, { method: 'HEAD' });
            if (response.ok) {
                console.log(`  ✓ Page ${i + 1}: ID ${testPageId} - VALID`);
            } else {
                console.log(`  ✗ Page ${i + 1}: ID ${testPageId} - HTTP ${response.status}`);
            }
        } catch (error) {
            console.log(`  ✗ Page ${i + 1}: ID ${testPageId} - ERROR`);
        }
    }
    
    console.log('\n=== Conclusion ===');
    console.log('The E-Manuscripta blocks appear to be range-based views rather than');
    console.log('separate paginated collections. All blocks reference the same base image');
    console.log('sequence but show different page ranges in their titles.');
}

understandEManuscriptaBlocks().catch(console.error);