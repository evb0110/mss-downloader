#!/usr/bin/env bun
// Test that the tile URLs are actually accessible

async function testTileUrls() {
    console.log('🧪 Testing actual tile URL accessibility...');
    
    // Test the corrected URL format
    const correctUrl = 'https://selene.bordeaux.fr/in/dz/330636101_MS0778_0006.xml';
    const wrongUrl = 'https://selene.bordeaux.fr/in/dz/330636101_MS_0778_0006.xml';
    
    console.log('\n🔍 Testing CORRECT URL (MS0778 - no underscore):');
    console.log(`   ${correctUrl}`);
    
    try {
        const correctResponse = await fetch(correctUrl);
        console.log(`   Status: ${correctResponse.status} ${correctResponse.statusText}`);
        
        if (correctResponse.ok) {
            const xml = await correctResponse.text();
            console.log(`   ✅ SUCCESS: XML manifest found (${xml.length} characters)`);
            
            // Parse basic DZI info
            const tileSize = xml.match(/TileSize="(\d+)"/)?.[1];
            const format = xml.match(/Format="([^"]+)"/)?.[1];
            const width = xml.match(/<Size[^>]+Width="(\d+)"/)?.[1];
            const height = xml.match(/<Size[^>]+Height="(\d+)"/)?.[1];
            
            console.log(`   📏 Tile Size: ${tileSize}px, Format: ${format}`);
            console.log(`   📐 Image Dimensions: ${width}x${height}px`);
        } else {
            console.log(`   ❌ FAILED: HTTP ${correctResponse.status}`);
        }
    } catch (error) {
        console.log(`   💥 ERROR: ${error}`);
    }
    
    console.log('\n🚫 Testing WRONG URL (MS_0778 - with underscore):');
    console.log(`   ${wrongUrl}`);
    
    try {
        const wrongResponse = await fetch(wrongUrl);
        console.log(`   Status: ${wrongResponse.status} ${wrongResponse.statusText}`);
        
        if (wrongResponse.ok) {
            console.log(`   ⚠️  UNEXPECTED: Wrong URL also works - format may have changed`);
        } else {
            console.log(`   ✅ EXPECTED: Wrong URL returns ${wrongResponse.status} as expected`);
        }
    } catch (error) {
        console.log(`   💥 ERROR: ${error}`);
    }
    
    console.log('\n🧩 Testing actual tile image download:');
    const tileUrl = 'https://selene.bordeaux.fr/in/dz/330636101_MS0778_0006_files/13/0_0.jpg';
    console.log(`   ${tileUrl}`);
    
    try {
        const tileResponse = await fetch(tileUrl);
        console.log(`   Status: ${tileResponse.status} ${tileResponse.statusText}`);
        
        if (tileResponse.ok) {
            const buffer = await tileResponse.arrayBuffer();
            console.log(`   ✅ SUCCESS: Tile image downloaded (${buffer.byteLength} bytes)`);
            
            if (buffer.byteLength > 10000) {
                console.log('   🎨 HIGH QUALITY: Large tile suggests high resolution');
            } else if (buffer.byteLength > 1000) {
                console.log('   🎨 MEDIUM QUALITY: Moderate tile size');
            } else {
                console.log('   🎨 LOW QUALITY: Small tile size');
            }
        } else {
            console.log(`   ❌ FAILED: HTTP ${tileResponse.status}`);
        }
    } catch (error) {
        console.log(`   💥 ERROR: ${error}`);
    }
    
    console.log('\n📋 SUMMARY:');
    console.log('   If the CORRECT URL works and the WRONG URL fails,');
    console.log('   then the base ID fix should resolve the production issues.');
}

testTileUrls();