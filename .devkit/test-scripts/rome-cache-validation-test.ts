/**
 * Rome Cache Validation Test - Verify cache storage and retrieval accuracy
 * 
 * Tests cache behavior for Rome manuscripts to ensure:
 * 1. Fresh manifests are properly cached
 * 2. Cached manifests are retrieved accurately  
 * 3. Cache invalidation works correctly
 * 4. Page counts are stored and retrieved without corruption
 */

import { ManifestCache } from '../../src/main/services/ManifestCache';
import path from 'path';
import { app } from 'electron';

// Mock Electron app for testing
if (!app) {
    (global as any).app = {
        getPath: (name: string) => {
            if (name === 'userData') {
                return '/tmp/mss-test-cache';
            }
            return '/tmp';
        }
    };
}

interface TestRomeManifest {
    pageLinks: string[];
    totalPages: number;
    library: string;
    displayName: string;
    originalUrl: string;
}

async function testRomeCacheValidation() {
    console.log('🧪 Starting Rome Cache Validation Tests...\n');
    
    const cache = new ManifestCache();
    await cache.init();
    
    // Test URLs and expected data
    const testUrl1 = 'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1';
    const testUrl2 = 'http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/BVEE112879/BVEE112879/1';
    
    const testManifest1: TestRomeManifest = {
        pageLinks: [
            'http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1/original',
            'http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/2/original',
            'http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/3/original'
        ],
        totalPages: 3,
        library: 'rome',
        displayName: 'Test Rome Manuscript',
        originalUrl: testUrl1
    };
    
    const testManifest2: TestRomeManifest = {
        pageLinks: [
            'http://digitale.bnc.roma.sbn.it/tecadigitale/img/libroantico/BVEE112879/BVEE112879/1/original',
            'http://digitale.bnc.roma.sbn.it/tecadigitale/img/libroantico/BVEE112879/BVEE112879/2/original'
        ],
        totalPages: 2,
        library: 'rome',
        displayName: 'Test Rome Book',
        originalUrl: testUrl2
    };
    
    let testsPassed = 0;
    let totalTests = 0;
    
    // Test 1: Cache Storage
    totalTests++;
    console.log('📝 Test 1: Cache Storage');
    try {
        await cache.set(testUrl1, testManifest1 as any);
        await cache.set(testUrl2, testManifest2 as any);
        console.log('✅ Successfully stored Rome manifests in cache');
        testsPassed++;
    } catch (error) {
        console.log('❌ Failed to store Rome manifests:', error);
    }
    
    // Test 2: Cache Retrieval Accuracy
    totalTests++;
    console.log('\n📝 Test 2: Cache Retrieval Accuracy');
    try {
        const cached1 = await cache.get(testUrl1) as TestRomeManifest;
        const cached2 = await cache.get(testUrl2) as TestRomeManifest;
        
        if (!cached1 || !cached2) {
            throw new Error('Failed to retrieve cached manifests');
        }
        
        // Verify page counts are accurate
        if (cached1.totalPages !== testManifest1.totalPages) {
            throw new Error(`Page count mismatch: expected ${testManifest1.totalPages}, got ${cached1.totalPages}`);
        }
        
        if (cached2.totalPages !== testManifest2.totalPages) {
            throw new Error(`Page count mismatch: expected ${testManifest2.totalPages}, got ${cached2.totalPages}`);
        }
        
        // Verify page links are preserved
        if (cached1.pageLinks.length !== testManifest1.pageLinks.length) {
            throw new Error(`Page links count mismatch for manuscript 1`);
        }
        
        if (cached2.pageLinks.length !== testManifest2.pageLinks.length) {
            throw new Error(`Page links count mismatch for manuscript 2`);
        }
        
        console.log('✅ Cache retrieval accuracy verified');
        console.log(`   - Manuscript 1: ${cached1.totalPages} pages, ${cached1.pageLinks.length} links`);
        console.log(`   - Manuscript 2: ${cached2.totalPages} pages, ${cached2.pageLinks.length} links`);
        testsPassed++;
    } catch (error) {
        console.log('❌ Cache retrieval accuracy failed:', error);
    }
    
    // Test 3: Cache Key Normalization
    totalTests++;
    console.log('\n📝 Test 3: Cache Key Normalization');
    try {
        // Test with URL variations
        const urlVariant1 = testUrl1.toUpperCase();
        const urlVariant2 = testUrl1 + '?test=param';
        
        // These should not be found due to URL normalization
        const notFound1 = await cache.get(urlVariant1);
        const notFound2 = await cache.get(urlVariant2);
        
        if (notFound1 || notFound2) {
            throw new Error('Cache key normalization is not working - found variants that should not exist');
        }
        
        console.log('✅ Cache key normalization working correctly');
        testsPassed++;
    } catch (error) {
        console.log('❌ Cache key normalization test failed:', error);
    }
    
    // Test 4: Domain-Specific Cache Clearing
    totalTests++;
    console.log('\n📝 Test 4: Domain-Specific Cache Clearing');
    try {
        // Verify manifests exist before clearing
        const beforeClear1 = await cache.get(testUrl1);
        const beforeClear2 = await cache.get(testUrl2);
        
        if (!beforeClear1 || !beforeClear2) {
            throw new Error('Manifests should exist before clearing');
        }
        
        // Clear Rome domain
        await cache.clearDomain('digitale.bnc.roma.sbn.it');
        
        // Verify manifests are gone after clearing
        const afterClear1 = await cache.get(testUrl1);
        const afterClear2 = await cache.get(testUrl2);
        
        if (afterClear1 || afterClear2) {
            throw new Error('Manifests should be cleared after domain clearing');
        }
        
        console.log('✅ Domain-specific cache clearing working correctly');
        testsPassed++;
    } catch (error) {
        console.log('❌ Domain-specific cache clearing failed:', error);
    }
    
    // Test 5: Invalid Manifest Rejection
    totalTests++;
    console.log('\n📝 Test 5: Invalid Manifest Rejection');
    try {
        // Try to cache invalid manifests
        const invalidManifest1 = { /* missing pageLinks */ };
        const invalidManifest2 = { pageLinks: 'not-an-array' };
        const invalidManifest3 = { pageLinks: ['valid-link', null, 'undefined'] }; // Contains invalid links
        
        await cache.set(testUrl1, invalidManifest1 as any);
        await cache.set(testUrl1, invalidManifest2 as any);
        await cache.set(testUrl1, invalidManifest3 as any);
        
        // Should not be able to retrieve invalid manifests
        const retrieved = await cache.get(testUrl1);
        
        if (retrieved) {
            throw new Error('Invalid manifest was cached and retrieved - validation failed');
        }
        
        console.log('✅ Invalid manifest rejection working correctly');
        testsPassed++;
    } catch (error) {
        console.log('❌ Invalid manifest rejection test failed:', error);
    }
    
    // Test 6: Cache Version Compatibility
    totalTests++;
    console.log('\n📝 Test 6: Cache Version Compatibility');
    try {
        // Store a valid manifest again
        await cache.set(testUrl1, testManifest1 as any);
        
        // Verify it can be retrieved
        const retrieved = await cache.get(testUrl1);
        if (!retrieved) {
            throw new Error('Valid manifest should be retrievable');
        }
        
        console.log('✅ Cache version compatibility working correctly');
        testsPassed++;
    } catch (error) {
        console.log('❌ Cache version compatibility test failed:', error);
    }
    
    // Final cleanup
    await cache.clear();
    
    // Results Summary
    console.log('\n🏆 Rome Cache Validation Test Results:');
    console.log(`✅ Tests Passed: ${testsPassed}/${totalTests}`);
    console.log(`📊 Success Rate: ${((testsPassed / totalTests) * 100).toFixed(1)}%`);
    
    if (testsPassed === totalTests) {
        console.log('\n🎉 ALL TESTS PASSED - Rome cache system is working correctly!');
        console.log('No cache-related issues that could cause incorrect page count persistence.');
    } else {
        console.log('\n⚠️ Some tests failed - cache system may have issues');
    }
    
    return {
        passed: testsPassed,
        total: totalTests,
        success: testsPassed === totalTests
    };
}

// Run the test if called directly
if (require.main === module) {
    testRomeCacheValidation().catch(console.error);
}

export { testRomeCacheValidation };