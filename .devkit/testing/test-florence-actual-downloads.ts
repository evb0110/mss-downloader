#!/usr/bin/env bun

/**
 * Test Florence ContentDM IIIF API by actually downloading images
 * to get accurate file size comparisons
 */

interface DownloadResult {
    success: boolean;
    error?: string;
    fileSize?: number;
    url?: string;
    filePath?: string;
}

async function downloadAndMeasure(url: string, filename: string): Promise<DownloadResult> {
    try {
        console.log(`   Downloading: ${filename}...`);
        const response = await fetch(url);
        
        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}`, url };
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const filePath = `/tmp/florence-test/${filename}`;
        
        // Write file
        await Bun.write(filePath, arrayBuffer);
        
        // Get file size
        const stat = await Bun.file(filePath).size;
        
        return { success: true, fileSize: stat, url, filePath };
    } catch (error: any) {
        return { success: false, error: error.message, url };
    }
}

async function testFlorenceActualDownloads(): Promise<void> {
    console.log('🔍 Testing Florence ContentDM - Actual File Downloads');
    console.log('==================================================');
    
    // Create test directory
    await Bun.write('/tmp/florence-test/.keep', '');
    
    const collection = 'plutei';
    const pageId = '24932';
    
    // Test URLs
    const oldNativeAPI = `https://cdm21059.contentdm.oclc.org/digital/api/singleitem/image/${collection}/${pageId}/default.jpg`;
    const newIIIFAPI = `https://cdm21059.contentdm.oclc.org/digital/iiif/${collection}/${pageId}/full/max/0/default.jpg`;
    
    console.log('📥 Downloading with OLD Native API (low resolution):');
    const oldResult = await downloadAndMeasure(oldNativeAPI, 'old_native_api.jpg');
    
    if (oldResult.success) {
        console.log(`   ✅ SUCCESS: ${oldResult.fileSize} bytes (${Math.round(oldResult.fileSize! / 1024)} KB)`);
    } else {
        console.log(`   ❌ FAILED: ${oldResult.error}`);
    }
    
    console.log('\n📥 Downloading with NEW IIIF API (maximum resolution):');
    const newResult = await downloadAndMeasure(newIIIFAPI, 'new_iiif_api.jpg');
    
    if (newResult.success) {
        console.log(`   ✅ SUCCESS: ${newResult.fileSize} bytes (${Math.round(newResult.fileSize! / 1024)} KB)`);
    } else {
        console.log(`   ❌ FAILED: ${newResult.error}`);
    }
    
    // Compare results
    if (oldResult.success && newResult.success) {
        const improvementRatio = newResult.fileSize! / oldResult.fileSize!;
        console.log('\n📊 DETAILED COMPARISON:');
        console.log(`   Old Native API: ${oldResult.fileSize} bytes (${Math.round(oldResult.fileSize! / 1024)} KB)`);
        console.log(`   New IIIF API:   ${newResult.fileSize} bytes (${Math.round(newResult.fileSize! / 1024)} KB)`);
        console.log(`   File Size Ratio: ${improvementRatio.toFixed(1)}x larger`);
        
        // Check image dimensions using identify command if available
        console.log('\n🖼️  Image Dimensions:');
        try {
            const oldDimensions = await Bun.spawn(['identify', oldResult.filePath!]).text();
            const newDimensions = await Bun.spawn(['identify', newResult.filePath!]).text();
            
            console.log(`   Old: ${oldDimensions.trim()}`);
            console.log(`   New: ${newDimensions.trim()}`);
        } catch (error) {
            console.log('   (ImageMagick identify not available for dimension check)');
        }
        
        // Quality assessment
        if (improvementRatio >= 10) {
            console.log('\n🎉 OUTSTANDING: 10x+ improvement! Perfect high-resolution implementation');
        } else if (improvementRatio >= 8) {
            console.log('\n🎉 EXCELLENT: 8x+ improvement achieved!');
        } else if (improvementRatio >= 5) {
            console.log('\n✅ GOOD: 5x+ improvement achieved!');
        } else if (improvementRatio >= 2) {
            console.log('\n🔶 MODERATE: 2x+ improvement achieved');
        } else {
            console.log('\n⚠️  WARNING: Less than 2x improvement - may need further optimization');
        }
        
        console.log('\n📁 Files saved to:');
        console.log(`   Old API: ${oldResult.filePath}`);
        console.log(`   New API: ${newResult.filePath}`);
        
    } else {
        console.log('\n❌ Cannot compare - one or both downloads failed');
    }
    
    // Test with second page to confirm consistency
    console.log('\n📥 Testing second page (24933) for consistency:');
    const page2IIIF = `https://cdm21059.contentdm.oclc.org/digital/iiif/${collection}/24933/full/max/0/default.jpg`;
    const page2Result = await downloadAndMeasure(page2IIIF, 'page2_iiif_api.jpg');
    
    if (page2Result.success) {
        console.log(`   ✅ Page 2: ${page2Result.fileSize} bytes (${Math.round(page2Result.fileSize! / 1024)} KB) - Consistent high resolution`);
    } else {
        console.log(`   ❌ Page 2 FAILED: ${page2Result.error}`);
    }
    
    console.log('\n🏛️ FLORENCE DOWNLOAD TEST COMPLETE');
    console.log('Files available at /tmp/florence-test/ for manual inspection');
}

// Run the test
testFlorenceActualDownloads().catch(console.error);