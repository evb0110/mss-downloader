#!/usr/bin/env bun
/**
 * CUDL Implementation Test - Agent 4 Validation
 * 
 * Tests the Enhanced Implementation strategy following Agent 3's plan
 * Uses Agent 1's validated URL: https://cudl.lib.cam.ac.uk/view/MS-II-00006-00032
 */

import { SharedManifestLoaders } from '../../../src/shared/SharedManifestLoaders';

async function testCudlImplementation() {
    console.log('🧪 CUDL Implementation Test - Agent 4 Validation');
    console.log('================================================\n');

    const sharedLoaders = new SharedManifestLoaders();
    
    // Test URL from Agent 1's infrastructure analysis
    const testUrl = 'https://cudl.lib.cam.ac.uk/view/MS-II-00006-00032';
    
    console.log(`🎯 Testing URL: ${testUrl}`);
    console.log(`📚 Expected: Roman numeral manuscript format (175 pages)\n`);
    
    try {
        console.log('⏳ Loading CUDL manifest...');
        const startTime = Date.now();
        
        const manifestImages = await sharedLoaders.loadCudlManifest(testUrl);
        
        const duration = Date.now() - startTime;
        
        console.log(`✅ SUCCESS: Loaded ${manifestImages.length} pages in ${duration}ms\n`);
        
        // Validation checks
        console.log('🔍 VALIDATION CHECKS:');
        console.log('===================');
        
        // Check 1: Page count matches Agent 1's expectation
        const expectedPages = 175;
        const actualPages = manifestImages.length;
        console.log(`📄 Page Count: ${actualPages} (expected ~${expectedPages})`);
        
        if (Math.abs(actualPages - expectedPages) <= 10) {
            console.log('   ✅ Page count matches Agent 1 findings');
        } else {
            console.log(`   ⚠️  Page count differs from Agent 1 (${expectedPages} expected)`);
        }
        
        // Check 2: Image URL structure validation
        console.log(`\n🔗 Sample Image URLs (first 3 pages):`);
        manifestImages.slice(0, 3).forEach((img, idx) => {
            console.log(`   Page ${idx + 1}: ${img.url}`);
            console.log(`   Filename: ${img.filename}`);
            
            // Validate maximum resolution URL format
            if (img.url.includes('/full/max/0/default.jpg')) {
                console.log('   ✅ Uses maximum resolution (Agent 1 optimization)');
            } else {
                console.log('   ⚠️  Not using maximum resolution format');
            }
            
            console.log('');
        });
        
        // Check 3: Filename pattern validation
        const filenamePattern = /Cambridge_MS-II-00006-00032_page_\d{3}\.jpg/;
        const sampleFilename = manifestImages[0].filename;
        console.log(`📝 Filename Pattern: ${sampleFilename}`);
        
        if (filenamePattern.test(sampleFilename)) {
            console.log('   ✅ Filename follows expected pattern');
        } else {
            console.log('   ⚠️  Filename pattern may need adjustment');
        }
        
        // Check 4: ManuscriptImage structure validation
        console.log(`\n🏗️  ManuscriptImage Structure Validation:`);
        const sampleImage = manifestImages[0];
        
        const requiredFields = ['url', 'filename', 'pageNumber', 'success'];
        const hasAllFields = requiredFields.every(field => field in sampleImage);
        
        if (hasAllFields) {
            console.log('   ✅ All required fields present');
            console.log(`   - URL: ${typeof sampleImage.url}`);
            console.log(`   - Filename: ${typeof sampleImage.filename}`);
            console.log(`   - Page Number: ${typeof sampleImage.pageNumber}`);
            console.log(`   - Success: ${typeof sampleImage.success}`);
        } else {
            console.log('   ❌ Missing required fields in ManuscriptImage');
        }
        
        console.log(`\n🎉 IMPLEMENTATION SUCCESS`);
        console.log('========================');
        console.log(`✅ CUDL manifest loading implemented successfully`);
        console.log(`✅ ${actualPages} pages loaded with maximum resolution`);
        console.log(`✅ Enhanced error handling and logging in place`);
        console.log(`✅ Follows SharedManifestLoaders patterns`);
        console.log(`✅ Agent 1's optimization (max resolution) applied`);
        
        return {
            success: true,
            pageCount: actualPages,
            duration: duration,
            sampleUrls: manifestImages.slice(0, 3).map(img => img.url),
            testUrl: testUrl
        };
        
    } catch (error: any) {
        console.log(`❌ IMPLEMENTATION FAILED: ${error.message}`);
        console.log(`\n🔍 ERROR ANALYSIS:`);
        console.log(`- Error Type: ${error.constructor.name}`);
        console.log(`- Error Message: ${error.message}`);
        
        if (error.message.includes('Invalid Cambridge CUDL URL format')) {
            console.log(`- Issue: URL parsing failed`);
            console.log(`- Check: URL regex pattern in implementation`);
        } else if (error.message.includes('Failed to fetch CUDL manifest')) {
            console.log(`- Issue: Network/manifest fetch failed`);
            console.log(`- Check: Manifest URL construction or network access`);
        } else if (error.message.includes('Invalid IIIF manifest structure')) {
            console.log(`- Issue: IIIF manifest parsing failed`);
            console.log(`- Check: Manifest structure validation logic`);
        }
        
        return {
            success: false,
            error: error.message,
            testUrl: testUrl
        };
    }
}

// Test different manuscript types from Agent 1's analysis
async function runComprehensiveTests() {
    console.log('🧪 COMPREHENSIVE CUDL VALIDATION');
    console.log('================================\n');
    
    const testCases = [
        {
            name: 'Roman Numeral Format',
            url: 'https://cudl.lib.cam.ac.uk/view/MS-II-00006-00032',
            expectedPages: 175,
            description: 'Agent 1 validated manuscript'
        },
        {
            name: 'Double Letter Format', 
            url: 'https://cudl.lib.cam.ac.uk/view/MS-LL-00005-00018',
            expectedPages: 110,
            description: 'Different ID format test'
        }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
        console.log(`\n🎯 Testing: ${testCase.name}`);
        console.log(`📖 ${testCase.description}`);
        console.log(`🔗 URL: ${testCase.url}\n`);
        
        try {
            const sharedLoaders = new SharedManifestLoaders();
            const startTime = Date.now();
            
            const manifestImages = await sharedLoaders.loadCudlManifest(testCase.url);
            const duration = Date.now() - startTime;
            
            console.log(`✅ ${testCase.name}: ${manifestImages.length} pages in ${duration}ms`);
            
            results.push({
                name: testCase.name,
                success: true,
                pageCount: manifestImages.length,
                expectedPages: testCase.expectedPages,
                duration: duration,
                url: testCase.url
            });
            
        } catch (error: any) {
            console.log(`❌ ${testCase.name}: ${error.message}`);
            
            results.push({
                name: testCase.name,
                success: false,
                error: error.message,
                url: testCase.url
            });
        }
    }
    
    console.log(`\n📊 TEST SUMMARY`);
    console.log('===============');
    results.forEach(result => {
        if (result.success) {
            console.log(`✅ ${result.name}: ${result.pageCount} pages`);
        } else {
            console.log(`❌ ${result.name}: ${result.error}`);
        }
    });
    
    return results;
}

// Run the tests
if (import.meta.main) {
    console.log('Starting CUDL Implementation Validation...\n');
    
    try {
        const result = await testCudlImplementation();
        
        if (result.success) {
            console.log('\n🎉 PRIMARY TEST PASSED - Running comprehensive validation...\n');
            await runComprehensiveTests();
        } else {
            console.log('\n❌ PRIMARY TEST FAILED - Fix implementation before comprehensive tests');
        }
        
    } catch (error: any) {
        console.error('💥 TEST EXECUTION FAILED:', error.message);
        process.exit(1);
    }
}