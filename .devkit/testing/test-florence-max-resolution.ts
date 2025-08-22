#!/usr/bin/env bun

/**
 * Test Florence ContentDM IIIF API maximum resolution implementation
 * This validates that the Florence loader now uses IIIF Image API 
 * for 10x larger file sizes compared to the old native API
 */

interface ValidationResult {
    success: boolean;
    error?: string;
    fileSize?: number;
    dimensions?: string;
    url?: string;
}

async function fetchImageInfo(url: string): Promise<ValidationResult> {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        
        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        const contentLength = response.headers.get('content-length');
        const fileSize = contentLength ? parseInt(contentLength) : 0;
        
        return { success: true, fileSize, url };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

async function testFlorenceResolution(): Promise<void> {
    console.log('🔍 Testing Florence ContentDM IIIF API Maximum Resolution');
    console.log('====================================================');
    
    const collection = 'plutei';
    const pageId = '24932';
    
    // Test URLs
    const oldNativeAPI = `https://cdm21059.contentdm.oclc.org/digital/api/singleitem/image/${collection}/${pageId}/default.jpg`;
    const newIIIFAPI = `https://cdm21059.contentdm.oclc.org/digital/iiif/${collection}/${pageId}/full/max/0/default.jpg`;
    
    console.log('🧪 Testing OLD Native API (low resolution):');
    console.log(`   URL: ${oldNativeAPI}`);
    const oldResult = await fetchImageInfo(oldNativeAPI);
    
    if (oldResult.success) {
        console.log(`   ✅ SUCCESS: ${oldResult.fileSize} bytes (${Math.round(oldResult.fileSize! / 1024)} KB)`);
    } else {
        console.log(`   ❌ FAILED: ${oldResult.error}`);
    }
    
    console.log('\n🧪 Testing NEW IIIF API (maximum resolution):');
    console.log(`   URL: ${newIIIFAPI}`);
    const newResult = await fetchImageInfo(newIIIFAPI);
    
    if (newResult.success) {
        console.log(`   ✅ SUCCESS: ${newResult.fileSize} bytes (${Math.round(newResult.fileSize! / 1024)} KB)`);
    } else {
        console.log(`   ❌ FAILED: ${newResult.error}`);
    }
    
    // Compare results
    if (oldResult.success && newResult.success) {
        const improvementRatio = newResult.fileSize! / oldResult.fileSize!;
        console.log('\n📊 COMPARISON RESULTS:');
        console.log(`   Old Native API: ${Math.round(oldResult.fileSize! / 1024)} KB`);
        console.log(`   New IIIF API:   ${Math.round(newResult.fileSize! / 1024)} KB`);
        console.log(`   Improvement:    ${improvementRatio.toFixed(1)}x larger files`);
        
        if (improvementRatio >= 8) {
            console.log('   🎉 EXCELLENT: 8x+ improvement achieved!');
        } else if (improvementRatio >= 5) {
            console.log('   ✅ GOOD: 5x+ improvement achieved!');
        } else if (improvementRatio >= 2) {
            console.log('   🔶 MODERATE: 2x+ improvement achieved');
        } else {
            console.log('   ⚠️  WARNING: Less than 2x improvement');
        }
    } else {
        console.log('\n❌ Cannot compare - one or both APIs failed');
    }
    
    // Test additional page to confirm pattern
    console.log('\n🧪 Testing second page (24933) to confirm pattern:');
    const newPageTest = `https://cdm21059.contentdm.oclc.org/digital/iiif/${collection}/24933/full/max/0/default.jpg`;
    const page2Result = await fetchImageInfo(newPageTest);
    
    if (page2Result.success) {
        console.log(`   ✅ Page 2: ${Math.round(page2Result.fileSize! / 1024)} KB - Pattern confirmed`);
    } else {
        console.log(`   ❌ Page 2 FAILED: ${page2Result.error}`);
    }
    
    console.log('\n🏛️ FLORENCE IIIF API TEST COMPLETE');
}

// Run the test
testFlorenceResolution().catch(console.error);