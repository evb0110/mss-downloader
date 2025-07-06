#!/usr/bin/env node

// Debug MDC 49455 to understand its structure
async function debugMDC49455() {
    console.log('🔍 Debugging MDC item 49455...\n');
    
    const collection = 'incunableBC';
    const itemId = '49455';
    
    try {
        // Get compound object info
        const compoundUrl = `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/${collection}/${itemId}/json`;
        console.log(`📋 Fetching compound info: ${compoundUrl}`);
        
        const compoundResponse = await fetch(compoundUrl);
        if (!compoundResponse.ok) {
            console.log(`❌ Compound API failed: ${compoundResponse.status}`);
            return;
        }
        
        const compoundData = await compoundResponse.json();
        console.log(`📊 Compound data structure:`);
        console.log(JSON.stringify(compoundData, null, 2));
        
        // Check if it has page structure
        if (compoundData.page && Array.isArray(compoundData.page)) {
            console.log(`\n📄 Found ${compoundData.page.length} pages:`);
            
            for (let i = 0; i < Math.min(compoundData.page.length, 5); i++) {
                const page = compoundData.page[i];
                console.log(`  Page ${i + 1}: ${JSON.stringify(page)}`);
                
                if (page.pageptr) {
                    const pageId = page.pageptr;
                    const iiifInfoUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${pageId}/info.json`;
                    
                    try {
                        const iiifResponse = await fetch(iiifInfoUrl);
                        console.log(`    IIIF ${pageId}: ${iiifResponse.status}`);
                        
                        if (iiifResponse.ok) {
                            const iiifData = await iiifResponse.json();
                            console.log(`    Dimensions: ${iiifData.width}x${iiifData.height}px`);
                        }
                    } catch (error) {
                        console.log(`    IIIF ${pageId}: Error - ${error.message}`);
                    }
                }
            }
        } else {
            console.log('❌ No page structure found in compound object');
        }
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

debugMDC49455().catch(error => {
    console.error('Debug failed:', error);
    process.exit(1);
});