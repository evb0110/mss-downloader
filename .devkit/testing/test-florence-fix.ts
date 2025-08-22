#!/usr/bin/env bun

/**
 * Test script to verify Florence intelligent sizing fix
 * Tests the problematic manuscript that was returning 403 Forbidden errors
 */

const PROBLEMATIC_URL = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217710/rec/2';
const TEST_IMAGE_URL_6000 = 'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217706/full/6000,/0/default.jpg';
const TEST_IMAGE_URL_4000 = 'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217706/full/4000,/0/default.jpg';

async function testImageSize(url: string): Promise<{ success: boolean; status?: number; error?: string }> {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return {
            success: response.ok,
            status: response.status
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        };
    }
}

async function main() {
    console.log('🧪 Testing Florence ContentDM size limitations...\n');
    
    // Test the old 6000px size (should fail)
    console.log('📋 Testing old 6000px size:');
    const test6000 = await testImageSize(TEST_IMAGE_URL_6000);
    console.log(`   Result: ${test6000.success ? '✅ Success' : '❌ Failed'} (${test6000.status || test6000.error})`);
    
    // Test the new 4000px size (should work)
    console.log('\n📋 Testing new 4000px size:');
    const test4000 = await testImageSize(TEST_IMAGE_URL_4000);
    console.log(`   Result: ${test4000.success ? '✅ Success' : '❌ Failed'} (${test4000.status || test4000.error})`);
    
    // Verify the fix
    console.log('\n🎯 Fix Verification:');
    if (!test6000.success && test4000.success) {
        console.log('✅ EXCELLENT! The intelligent sizing fix should work:');
        console.log('   - 6000px fails (403 Forbidden) as expected');
        console.log('   - 4000px works (200 OK) as the fallback');
        console.log('   - Users will now get working downloads instead of 403 errors');
    } else if (test6000.success && test4000.success) {
        console.log('⚠️  Both sizes work - manuscript might not have size restrictions');
        console.log('   - This is actually good - intelligent sizing will pick 6000px');
        console.log('   - Fix still provides value for other restricted manuscripts');
    } else if (!test4000.success) {
        console.log('❌ PROBLEM! Even 4000px fails - this needs investigation');
        console.log('   - Check network connectivity');
        console.log('   - Server might be down or have changed limits');
    } else {
        console.log('🤔 Unexpected result pattern');
    }
    
    console.log('\n📊 Summary:');
    console.log(`   - Original issue: ${PROBLEMATIC_URL} was failing`);
    console.log(`   - Root cause: Hardcoded 6000px exceeded server limits`);
    console.log(`   - Solution: Intelligent sizing with fallback [6000→4000→2048→1024→800]`);
    console.log(`   - Status: Fix implemented in FlorenceLoader.ts and SharedManifestLoaders.ts`);
}

main().catch(console.error);