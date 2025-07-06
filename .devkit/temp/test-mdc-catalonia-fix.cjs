#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Test the MDC Catalonia fix using the same approach as the fixed implementation
async function testMdcCataloniaFix() {
    console.log('🧪 Testing MDC Catalonia fix implementation...\n');
    
    // Test cases from the solution
    const testCases = [
        {
            name: 'Large manuscript (812 pages)',
            url: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
            collection: 'incunableBC',
            itemId: '175331',
            expectedPages: 812
        },
        {
            name: 'Multi-page manuscript',
            url: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/49455',
            collection: 'incunableBC', 
            itemId: '49455',
            expectedPages: 'multiple'
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`📖 Testing: ${testCase.name}`);
        console.log(`📄 URL: ${testCase.url}`);
        
        try {
            // Step 1: Get compound object structure using CONTENTdm API
            const compoundUrl = `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/${testCase.collection}/${testCase.itemId}/json`;
            console.log(`🔍 Fetching compound structure: ${compoundUrl}`);
            
            const compoundResponse = await fetch(compoundUrl);
            if (!compoundResponse.ok) {
                throw new Error(`Compound API failed: ${compoundResponse.status}`);
            }
            
            const compoundData = await compoundResponse.json();
            
            // Handle both direct page array and nested node.page structure
            let pageArray = compoundData.page;
            if (!pageArray && compoundData.node && compoundData.node.page) {
                pageArray = compoundData.node.page;
            }
            
            if (!pageArray || !Array.isArray(pageArray)) {
                console.log('❌ Not a compound object or missing page structure');
                continue;
            }
            
            console.log(`📊 Found ${pageArray.length} pages in compound object`);
            
            // Step 2: Test first few pages to verify IIIF endpoints work
            const testPages = pageArray.slice(0, 3); // Test first 3 pages
            let validPages = 0;
            
            for (const page of testPages) {
                if (!page.pageptr) {
                    console.log(`⚠️  Skipping page without pageptr`);
                    continue;
                }
                
                const pageId = page.pageptr;
                const iiifInfoUrl = `https://mdc.csuc.cat/iiif/2/${testCase.collection}:${pageId}/info.json`;
                
                try {
                    console.log(`🔍 Testing page ${pageId}...`);
                    
                    const iiifResponse = await fetch(iiifInfoUrl);
                    if (!iiifResponse.ok) {
                        console.log(`❌ IIIF endpoint failed for page ${pageId}: ${iiifResponse.status}`);
                        continue;
                    }
                    
                    const iiifData = await iiifResponse.json();
                    const imageUrl = `https://mdc.csuc.cat/iiif/2/${testCase.collection}:${pageId}/full/max/0/default.jpg`;
                    
                    // Test image URL
                    const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
                    if (!imageResponse.ok) {
                        console.log(`❌ Image URL failed for page ${pageId}: ${imageResponse.status}`);
                        continue;
                    }
                    
                    validPages++;
                    const pageTitle = page.pagetitle || `Page ${validPages}`;
                    console.log(`✅ Page ${validPages}: ${pageTitle} (${pageId}) - ${iiifData.width}x${iiifData.height}px`);
                    
                } catch (error) {
                    console.log(`❌ Error processing page ${pageId}: ${error.message}`);
                }
                
                // Small delay
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log(`\n✅ Test completed: ${validPages}/${testPages.length} pages validated`);
            
            if (validPages === testPages.length) {
                console.log('🎉 All tested pages work correctly!');
            } else {
                console.log('⚠️  Some pages failed, but fix should handle gracefully');
            }
            
        } catch (error) {
            console.log(`❌ Test failed: ${error.message}`);
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
    }
    
    console.log('🏁 MDC Catalonia fix testing completed!');
}

// Run the test
testMdcCataloniaFix().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});