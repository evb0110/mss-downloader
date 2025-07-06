const fetch = require('node-fetch').default;
const fs = require('fs');

async function analyzeEManuscriptaStructure() {
    console.log('=== E-Manuscripta Structure Analysis ===');
    
    const structureUrl = 'https://www.e-manuscripta.ch/bau/content/structure/5157222';
    
    try {
        console.log(`\n1. Fetching structure page: ${structureUrl}`);
        const response = await fetch(structureUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        console.log(`Structure page loaded: ${html.length} characters`);
        
        // Save the HTML for manual inspection
        fs.writeFileSync('.devkit/temp/structure-5157222.html', html);
        console.log('HTML saved to .devkit/temp/structure-5157222.html');
        
        // Look for structure patterns that might indicate different blocks
        console.log('\n2. Searching for block structure patterns...');
        
        // Look for thumbview links in the structure
        const thumbviewPattern = /href="[^"]*\/content\/thumbview\/(\d+)"/g;
        const thumbviewIds = [];
        let match;
        while ((match = thumbviewPattern.exec(html)) !== null) {
            thumbviewIds.push(match[1]);
        }
        
        console.log(`Found ${thumbviewIds.length} thumbview IDs in structure:`, thumbviewIds);
        
        // Look for any hierarchical structure
        console.log('\n3. Searching for hierarchical structure...');
        
        // Look for ul/ol/li structures
        const listPattern = /<[uo]l[^>]*>(.*?)<\/[uo]l>/gs;
        const lists = [];
        while ((match = listPattern.exec(html)) !== null) {
            if (match[1].includes('515') || match[1].includes('thumbview') || match[1].includes('[')) {
                lists.push(match[1]);
            }
        }
        
        console.log(`Found ${lists.length} relevant lists`);
        lists.forEach((list, i) => {
            console.log(`\n  List ${i + 1}:`);
            console.log(`    ${list.substring(0, 300)}${list.length > 300 ? '...' : ''}`);
        });
        
        // Look for div structures that might contain block information
        console.log('\n4. Searching for div structures with block info...');
        const divPattern = /<div[^>]*class="[^"]*struct[^"]*"[^>]*>(.*?)<\/div>/gs;
        const divs = [];
        while ((match = divPattern.exec(html)) !== null) {
            if (match[1].includes('515') || match[1].includes('thumbview') || match[1].includes('[')) {
                divs.push(match[1]);
            }
        }
        
        console.log(`Found ${divs.length} relevant structure divs`);
        divs.forEach((div, i) => {
            console.log(`\n  Div ${i + 1}:`);
            console.log(`    ${div.substring(0, 300)}${div.length > 300 ? '...' : ''}`);
        });
        
        // Let's also check the first block directly to see how many pages it has
        console.log('\n5. Testing first block (5157616) to understand page structure...');
        const firstBlockUrl = 'https://www.e-manuscripta.ch/bau/content/thumbview/5157616';
        
        try {
            const blockResponse = await fetch(firstBlockUrl);
            if (blockResponse.ok) {
                const blockHtml = await blockResponse.text();
                console.log(`First block loaded: ${blockHtml.length} characters`);
                
                // Look for page dropdown to understand page count
                const pageDropdownPattern = /<select[^>]*id="goToPage"[^>]*>(.*?)<\/select>/s;
                const dropdownMatch = blockHtml.match(pageDropdownPattern);
                if (dropdownMatch) {
                    const optionPattern = /<option[^>]*value="(\d+)"[^>]*>\s*\[(\d+)\]\s*/g;
                    const pageOptions = [];
                    let optionMatch;
                    while ((optionMatch = optionPattern.exec(dropdownMatch[1])) !== null) {
                        pageOptions.push({
                            pageId: optionMatch[1],
                            pageNumber: optionMatch[2]
                        });
                    }
                    console.log(`First block has ${pageOptions.length} pages:`);
                    console.log(`  First page: [${pageOptions[0]?.pageNumber}] (ID: ${pageOptions[0]?.pageId})`);
                    console.log(`  Last page: [${pageOptions[pageOptions.length - 1]?.pageNumber}] (ID: ${pageOptions[pageOptions.length - 1]?.pageId})`);
                }
            }
        } catch (error) {
            console.log(`Error fetching first block: ${error.message}`);
        }
        
        // Now let's check a much broader range to find the mysterious 5157228
        console.log('\n6. Testing broader range to find all blocks...');
        
        // Test a broader range around the base manuscript ID
        const baseId = 5157222;
        console.log(`Testing range around base manuscript ID ${baseId}:`);
        
        const testIds = [];
        for (let i = -50; i <= 50; i++) {
            testIds.push(baseId + i);
        }
        
        const validBlocks = [];
        for (const testId of testIds) {
            const testUrl = `https://www.e-manuscripta.ch/bau/content/thumbview/${testId}`;
            try {
                const testResponse = await fetch(testUrl, { method: 'HEAD' });
                if (testResponse.ok) {
                    validBlocks.push(testId);
                    console.log(`  ✓ ${testId} - VALID block`);
                }
            } catch (error) {
                // Silent fail for testing
            }
        }
        
        console.log(`\nFound ${validBlocks.length} valid blocks in range:`, validBlocks);
        
        // Test if 5157228 is related to a different pattern
        console.log('\n7. Testing 5157228 specifically...');
        const specialId = 5157228;
        const specialUrl = `https://www.e-manuscripta.ch/bau/content/thumbview/${specialId}`;
        
        try {
            const specialResponse = await fetch(specialUrl);
            if (specialResponse.ok) {
                const specialHtml = await specialResponse.text();
                console.log(`Special block 5157228 loaded: ${specialHtml.length} characters`);
                
                // Look for page dropdown to understand page count
                const pageDropdownPattern = /<select[^>]*id="goToPage"[^>]*>(.*?)<\/select>/s;
                const dropdownMatch = specialHtml.match(pageDropdownPattern);
                if (dropdownMatch) {
                    const optionPattern = /<option[^>]*value="(\d+)"[^>]*>\s*\[(\d+)\]\s*/g;
                    const pageOptions = [];
                    let optionMatch;
                    while ((optionMatch = optionPattern.exec(dropdownMatch[1])) !== null) {
                        pageOptions.push({
                            pageId: optionMatch[1],
                            pageNumber: optionMatch[2]
                        });
                    }
                    console.log(`Special block 5157228 has ${pageOptions.length} pages:`);
                    console.log(`  First page: [${pageOptions[0]?.pageNumber}] (ID: ${pageOptions[0]?.pageId})`);
                    console.log(`  Last page: [${pageOptions[pageOptions.length - 1]?.pageNumber}] (ID: ${pageOptions[pageOptions.length - 1]?.pageId})`);
                }
            }
        } catch (error) {
            console.log(`Error fetching special block: ${error.message}`);
        }
        
        console.log('\n=== Structure Analysis Complete ===');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

analyzeEManuscriptaStructure().catch(console.error);