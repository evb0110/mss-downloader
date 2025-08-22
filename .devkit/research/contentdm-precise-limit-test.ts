#!/usr/bin/env bun

/**
 * Find the exact pixel width limit for ContentDM IIIF server
 */

async function findExactSizeLimit() {
    console.log('🎯 Finding exact ContentDM size limit');
    
    const baseUrl = 'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217706';
    
    // We know 4000 works and 5000 doesn't, so test in between
    const testSizes = [
        4100, 4200, 4300, 4400, 4500,
        4600, 4700, 4800, 4900, 5000
    ];
    
    let maxWorkingSize = 4000;
    
    for (const size of testSizes) {
        const testUrl = `${baseUrl}/full/${size},/0/default.jpg`;
        
        try {
            const response = await fetch(testUrl, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Referer': 'https://cdm21059.contentdm.oclc.org/',
                }
            });
            
            if (response.ok) {
                console.log(`✅ ${size}px → 200 OK`);
                maxWorkingSize = size;
            } else {
                console.log(`❌ ${size}px → ${response.status} ${response.statusText}`);
                break; // Once we hit the first failure, subsequent sizes will also fail
            }
            
            // Small delay to be nice to server
            await new Promise(resolve => setTimeout(resolve, 400));
            
        } catch (error) {
            console.log(`❌ ${size}px → Network Error: ${error instanceof Error ? error.message : String(error)}`);
            break;
        }
    }
    
    console.log(`\n🎯 Maximum working width: ${maxWorkingSize}px`);
    
    return maxWorkingSize;
}

// Test the relationship between original size and scaling limits
async function testScalingRelationship() {
    console.log('\n🔍 Testing scaling relationship with original image dimensions');
    
    // From IIIF info: original is 2112x2652
    const originalWidth = 2112;
    const originalHeight = 2652;
    
    console.log(`📏 Original dimensions: ${originalWidth}x${originalHeight}px`);
    
    // Calculate what different scale percentages mean in actual pixels
    const scaleTests = [
        { percent: 100, expectedWidth: originalWidth },
        { percent: 150, expectedWidth: Math.round(originalWidth * 1.5) },
        { percent: 200, expectedWidth: Math.round(originalWidth * 2.0) },
        { percent: 225, expectedWidth: Math.round(originalWidth * 2.25) },
        { percent: 250, expectedWidth: Math.round(originalWidth * 2.5) },
    ];
    
    console.log('\n📊 Scale percentage tests:');
    
    const baseUrl = 'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217706';
    
    for (const test of scaleTests) {
        const testUrl = `${baseUrl}/full/pct:${test.percent}/0/default.jpg`;
        
        try {
            const response = await fetch(testUrl, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Referer': 'https://cdm21059.contentdm.oclc.org/',
                }
            });
            
            const statusEmoji = response.ok ? '✅' : '❌';
            console.log(`${statusEmoji} ${test.percent}% (${test.expectedWidth}px) → ${response.status} ${response.statusText}`);
            
            await new Promise(resolve => setTimeout(resolve, 400));
            
        } catch (error) {
            console.log(`❌ ${test.percent}% → Network Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

async function main() {
    const maxSize = await findExactSizeLimit();
    await testScalingRelationship();
    
    console.log('\n📋 ContentDM IIIF Size Limit Summary:');
    console.log(`   Maximum working width: ${maxSize}px`);
    console.log(`   Scale limit: 200% (anything above fails)`);
    console.log(`   Original dimensions: 2112x2652px`);
    console.log(`   200% scale = ${Math.round(2112 * 2)}x${Math.round(2652 * 2)}px`);
    
    // Calculate the relationship
    const originalWidth = 2112;
    const scaleLimitWidth = originalWidth * 2; // 200% = 4224px
    
    console.log('\n💡 Key Insight:');
    console.log(`   The 200% scaling limit means max width = ${scaleLimitWidth}px`);
    console.log(`   But our tests show max working width is around ${maxSize}px`);
    console.log(`   This suggests the limit is likely based on the larger of:`);
    console.log(`   - Absolute pixel width limits`);
    console.log(`   - Scale percentage limits (200%)`);
}

if (import.meta.main) {
    main();
}