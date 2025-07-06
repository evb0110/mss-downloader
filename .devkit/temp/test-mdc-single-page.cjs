#!/usr/bin/env node

// Test single page handling for MDC Catalonia
async function testSinglePage() {
    console.log('🧪 Testing MDC Catalonia single page handling...\n');
    
    const testUrl = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/49455';
    const collection = 'incunableBC';
    const itemId = '49455';
    
    try {
        // Test direct IIIF endpoint for single page
        const iiifInfoUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/info.json`;
        console.log(`🔍 Testing single page IIIF: ${iiifInfoUrl}`);
        
        const infoResponse = await fetch(iiifInfoUrl);
        if (!infoResponse.ok) {
            console.log(`❌ Single page IIIF failed: ${infoResponse.status}`);
            return;
        }
        
        const iiifInfo = await infoResponse.json();
        console.log(`✅ Single page IIIF works: ${iiifInfo.width}x${iiifInfo.height}px`);
        
        // Test image URL
        const imageUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/full/max/0/default.jpg`;
        console.log(`🔍 Testing image URL: ${imageUrl}`);
        
        const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
        if (!imageResponse.ok) {
            console.log(`❌ Image URL failed: ${imageResponse.status}`);
            return;
        }
        
        console.log(`✅ Image URL works: ${imageResponse.status}`);
        console.log('🎉 Single page handling works correctly!');
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

testSinglePage().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});