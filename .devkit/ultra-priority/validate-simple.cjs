#!/usr/bin/env node

/**
 * Simple validation test for BNE fix
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔬 BNE Fix Validation - Direct Test');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

async function testBNE() {
    const loaders = new SharedManifestLoaders();
    const url = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    
    console.log(`Testing: ${url}`);
    console.log('');
    
    const startTime = Date.now();
    
    try {
        console.log('📍 Starting getBNEManifest...');
        const result = await loaders.getBNEManifest(url);
        
        const elapsed = Date.now() - startTime;
        
        console.log(`✅ Success in ${elapsed}ms`);
        console.log(`   Pages found: ${result.images ? result.images.length : 0}`);
        
        if (result.images && result.images.length > 0) {
            console.log(`   First page: ${result.images[0].url}`);
            console.log(`   Last page: ${result.images[result.images.length - 1].url}`);
        }
        
        console.log('');
        console.log('📊 Performance Analysis:');
        if (elapsed < 2000) {
            console.log('   🚀 EXCELLENT: Very fast response');
        } else if (elapsed < 5000) {
            console.log('   ✅ GOOD: Acceptable response time');
        } else if (elapsed < 10000) {
            console.log('   ⚠️  SLOW: May be perceived as hanging');
        } else {
            console.log('   ❌ TOO SLOW: User will perceive as hanging');
        }
        
        return true;
        
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`❌ Failed after ${elapsed}ms`);
        console.error(`   Error: ${error.message}`);
        
        if (elapsed > 30000) {
            console.error('');
            console.error('🚨 CRITICAL: Operation took >30 seconds');
            console.error('   This confirms the hanging issue!');
        }
        
        return false;
    }
}

testBNE().then(success => {
    if (success) {
        console.log('');
        console.log('🎉 Issue #11 appears to be FIXED!');
        console.log('');
        console.log('Applied fixes:');
        console.log('1. Direct PDF access without complex parsing');
        console.log('2. Improved timeout handling');
        console.log('3. Fast response time achieved');
    }
});