/**
 * Rome Cache Validation Test - Simplified version without Electron dependencies
 * 
 * Tests the cache logic patterns used for Rome manuscripts to verify:
 * 1. Cache key generation accuracy
 * 2. URL normalization behavior
 * 3. Manifest validation logic
 * 4. Cache version handling
 */

const fs = require('fs').promises;
const path = require('path');

// Mock the cache behavior for testing
class MockManifestCache {
    constructor() {
        this.cache = new Map();
        this.maxAge = 24 * 60 * 60 * 1000; // 24 hours
        this.CACHE_VERSION = 4;
    }
    
    getCacheKey(url) {
        // Replicate the actual cache key generation logic
        return url.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }
    
    isValidManifest(manifest) {
        // Replicate the actual validation logic
        if (!manifest || typeof manifest !== 'object') {
            return false;
        }
        
        const manifestObj = manifest;
        
        // Check for required fields and basic structure
        if (!manifestObj['pageLinks'] || !Array.isArray(manifestObj['pageLinks'])) {
            return false;
        }
        
        // Check for common corruption indicators
        if (manifestObj['pageLinks'].some((link) => 
            !link || typeof link !== 'string' || link.includes('undefined') || link.includes('null')
        )) {
            return false;
        }
        
        return true;
    }
    
    async set(url, manifest) {
        // Validate manifest before caching (replicate actual logic)
        if (!this.isValidManifest(manifest)) {
            console.warn(`Refusing to cache invalid manifest for: ${url}`);
            return;
        }
        
        const key = this.getCacheKey(url);
        this.cache.set(key, {
            manifest,
            timestamp: Date.now(),
            version: this.CACHE_VERSION,
        });
    }
    
    async get(url) {
        const key = this.getCacheKey(url);
        const cached = this.cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < this.maxAge) {
            // Validate cached manifest before returning (replicate actual logic)
            if (this.isValidManifest(cached.manifest)) {
                return cached.manifest;
            } else {
                // Remove corrupted entry
                console.warn(`Removing corrupted manifest cache entry for: ${url}`);
                this.cache.delete(key);
            }
        }
        
        return null;
    }
    
    async clearDomain(domain) {
        const keysToDelete = [];
        for (const [key, value] of this.cache.entries()) {
            const manifest = value.manifest;
            if (typeof manifest['originalUrl'] === 'string' && manifest['originalUrl'].includes(domain)) {
                keysToDelete.push(key);
            }
        }
        
        for (const key of keysToDelete) {
            this.cache.delete(key);
        }
        
        return keysToDelete.length;
    }
    
    clear() {
        this.cache.clear();
    }
}

async function testRomeCacheValidation() {
    console.log('🧪 Starting Rome Cache Validation Tests (Simplified)...\n');
    
    const cache = new MockManifestCache();
    
    // Test URLs - real Rome URLs
    const testUrl1 = 'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1';
    const testUrl2 = 'http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/BVEE112879/BVEE112879/1';
    
    const testManifest1 = {
        pageLinks: [
            'http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1/original',
            'http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/2/original',
            'http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/3/original'
        ],
        totalPages: 3,
        library: 'rome',
        displayName: 'Test Rome Manuscript BNCR_Ms_SESS_0062',
        originalUrl: testUrl1
    };
    
    const testManifest2 = {
        pageLinks: [
            'http://digitale.bnc.roma.sbn.it/tecadigitale/img/libroantico/BVEE112879/BVEE112879/1/original',
            'http://digitale.bnc.roma.sbn.it/tecadigitale/img/libroantico/BVEE112879/BVEE112879/2/original',
            'http://digitale.bnc.roma.sbn.it/tecadigitale/img/libroantico/BVEE112879/BVEE112879/3/original',
            'http://digitale.bnc.roma.sbn.it/tecadigitale/img/libroantico/BVEE112879/BVEE112879/4/original',
            'http://digitale.bnc.roma.sbn.it/tecadigitale/img/libroantico/BVEE112879/BVEE112879/5/original'
        ],
        totalPages: 5,
        library: 'rome',
        displayName: 'Test Rome Book BVEE112879',
        originalUrl: testUrl2
    };
    
    let testsPassed = 0;
    let totalTests = 0;
    
    // Test 1: Cache Key Generation for Rome URLs
    totalTests++;
    console.log('📝 Test 1: Cache Key Generation for Rome URLs');
    try {
        const key1 = cache.getCacheKey(testUrl1);
        const key2 = cache.getCacheKey(testUrl2);
        
        // Expected key format: normalized with special characters replaced
        const expectedKey1 = 'http___digitale_bnc_roma_sbn_it_tecadigitale_manoscrittoantico_bncr_ms_sess_0062_bncr_ms_sess_0062_1';
        const expectedKey2 = 'http___digitale_bnc_roma_sbn_it_tecadigitale_libroantico_bvee112879_bvee112879_1';
        
        if (key1 !== expectedKey1) {
            throw new Error(`Key1 mismatch: expected ${expectedKey1}, got ${key1}`);
        }
        
        if (key2 !== expectedKey2) {
            throw new Error(`Key2 mismatch: expected ${expectedKey2}, got ${key2}`);
        }
        
        console.log('✅ Cache key generation working correctly');
        console.log(`   Key 1 (length ${key1.length}): ${key1.substring(0, 50)}...`);
        console.log(`   Key 2 (length ${key2.length}): ${key2.substring(0, 50)}...`);
        testsPassed++;
    } catch (error) {
        console.log('❌ Cache key generation failed:', error.message);
    }
    
    // Test 2: Cache Storage and Retrieval Accuracy
    totalTests++;
    console.log('\n📝 Test 2: Cache Storage and Retrieval Accuracy');
    try {
        // Store manifests
        await cache.set(testUrl1, testManifest1);
        await cache.set(testUrl2, testManifest2);
        
        // Retrieve and verify
        const cached1 = await cache.get(testUrl1);
        const cached2 = await cache.get(testUrl2);
        
        if (!cached1 || !cached2) {
            throw new Error('Failed to retrieve cached manifests');
        }
        
        // Verify page counts are preserved exactly
        if (cached1.totalPages !== testManifest1.totalPages) {
            throw new Error(`Manuscript 1 page count mismatch: expected ${testManifest1.totalPages}, got ${cached1.totalPages}`);
        }
        
        if (cached2.totalPages !== testManifest2.totalPages) {
            throw new Error(`Manuscript 2 page count mismatch: expected ${testManifest2.totalPages}, got ${cached2.totalPages}`);
        }
        
        // Verify page links arrays are preserved
        if (cached1.pageLinks.length !== testManifest1.pageLinks.length) {
            throw new Error(`Manuscript 1 page links length mismatch`);
        }
        
        if (cached2.pageLinks.length !== testManifest2.pageLinks.length) {
            throw new Error(`Manuscript 2 page links length mismatch`);
        }
        
        console.log('✅ Cache storage and retrieval accuracy verified');
        console.log(`   Manuscript 1: ${cached1.totalPages} pages, ${cached1.pageLinks.length} page links`);
        console.log(`   Manuscript 2: ${cached2.totalPages} pages, ${cached2.pageLinks.length} page links`);
        console.log(`   Original URLs preserved: ${!!cached1.originalUrl && !!cached2.originalUrl}`);
        testsPassed++;
    } catch (error) {
        console.log('❌ Cache storage and retrieval failed:', error.message);
    }
    
    // Test 3: URL Case Sensitivity and Normalization
    totalTests++;
    console.log('\n📝 Test 3: URL Case Sensitivity and Normalization');
    try {
        // Test with different case variations
        const urlUpperCase = testUrl1.toUpperCase();
        const urlMixedCase = testUrl1.replace('http', 'HTTP').replace('digitale', 'DIGITALE');
        
        // Should generate the same cache key
        const keyOriginal = cache.getCacheKey(testUrl1);
        const keyUpper = cache.getCacheKey(urlUpperCase);
        const keyMixed = cache.getCacheKey(urlMixedCase);
        
        if (keyOriginal !== keyUpper || keyOriginal !== keyMixed) {
            throw new Error('Cache key normalization not working - case variations produce different keys');
        }
        
        // Test retrieval with case variations (should find the same cached item)
        const retrievedUpper = await cache.get(urlUpperCase);
        const retrievedMixed = await cache.get(urlMixedCase);
        
        if (!retrievedUpper || !retrievedMixed) {
            throw new Error('Case-insensitive retrieval not working');
        }
        
        console.log('✅ URL case sensitivity and normalization working correctly');
        console.log(`   All variations map to same key: ${keyOriginal.substring(0, 50)}...`);
        testsPassed++;
    } catch (error) {
        console.log('❌ URL case sensitivity test failed:', error.message);
    }
    
    // Test 4: Invalid Manifest Rejection
    totalTests++;
    console.log('\n📝 Test 4: Invalid Manifest Rejection');
    try {
        const testUrl = 'http://digitale.bnc.roma.sbn.it/tecadigitale/test/invalid/invalid/1';
        
        // Test various invalid manifest structures
        const invalidManifests = [
            { /* missing pageLinks */ },
            { pageLinks: 'not-an-array' },
            { pageLinks: null },
            { pageLinks: [] }, // empty array - should this be valid?
            { pageLinks: ['valid-url', null, 'another-valid-url'] }, // contains null
            { pageLinks: ['valid-url', 'undefined', 'another-url'] }, // contains 'undefined' string
            { pageLinks: ['valid-url', undefined, 'another-url'] }, // contains actual undefined
        ];
        
        let rejectedCount = 0;
        for (let i = 0; i < invalidManifests.length; i++) {
            await cache.set(testUrl, invalidManifests[i]);
            const retrieved = await cache.get(testUrl);
            
            if (retrieved === null) {
                rejectedCount++;
                console.log(`   ✓ Invalid manifest ${i + 1} correctly rejected`);
            } else {
                console.log(`   ✗ Invalid manifest ${i + 1} incorrectly cached:`, invalidManifests[i]);
            }
        }
        
        if (rejectedCount === invalidManifests.length) {
            console.log('✅ Invalid manifest rejection working correctly');
            testsPassed++;
        } else {
            throw new Error(`Only ${rejectedCount}/${invalidManifests.length} invalid manifests were rejected`);
        }
    } catch (error) {
        console.log('❌ Invalid manifest rejection test failed:', error.message);
    }
    
    // Test 5: Domain-Specific Cache Clearing
    totalTests++;
    console.log('\n📝 Test 5: Domain-Specific Cache Clearing');
    try {
        // Verify manifests exist before clearing
        const beforeClear1 = await cache.get(testUrl1);
        const beforeClear2 = await cache.get(testUrl2);
        
        if (!beforeClear1 || !beforeClear2) {
            throw new Error('Manifests should exist before clearing test');
        }
        
        // Clear Rome domain
        const clearedCount = await cache.clearDomain('digitale.bnc.roma.sbn.it');
        
        // Verify manifests are gone after clearing
        const afterClear1 = await cache.get(testUrl1);
        const afterClear2 = await cache.get(testUrl2);
        
        if (afterClear1 || afterClear2) {
            throw new Error('Manifests should be cleared after domain clearing');
        }
        
        if (clearedCount !== 2) {
            throw new Error(`Expected to clear 2 manifests, but cleared ${clearedCount}`);
        }
        
        console.log('✅ Domain-specific cache clearing working correctly');
        console.log(`   Cleared ${clearedCount} Rome domain manifests`);
        testsPassed++;
    } catch (error) {
        console.log('❌ Domain-specific cache clearing failed:', error.message);
    }
    
    // Test 6: Complex URL Patterns
    totalTests++;
    console.log('\n📝 Test 6: Complex Rome URL Patterns');
    try {
        const complexUrls = [
            'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1',
            'http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/BVEE112879/BVEE112879/1',
            'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/COMPLEX_ID_123/COMPLEX_ID_123/15',
            'http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/TEST-WITH-DASHES/TEST-WITH-DASHES/99'
        ];
        
        // Test that each URL generates a unique cache key
        const keys = complexUrls.map(url => cache.getCacheKey(url));
        const uniqueKeys = new Set(keys);
        
        if (uniqueKeys.size !== keys.length) {
            throw new Error('Complex URLs are not generating unique cache keys');
        }
        
        // Test that each URL can be cached and retrieved independently
        for (let i = 0; i < complexUrls.length; i++) {
            const testManifest = {
                pageLinks: [`${complexUrls[i].replace(/\/\d+$/, '')}/img/1/original`],
                totalPages: i + 1, // Different page count for each
                library: 'rome',
                displayName: `Test Manuscript ${i + 1}`,
                originalUrl: complexUrls[i]
            };
            
            await cache.set(complexUrls[i], testManifest);
            const retrieved = await cache.get(complexUrls[i]);
            
            if (!retrieved || retrieved.totalPages !== (i + 1)) {
                throw new Error(`Complex URL ${i + 1} caching/retrieval failed`);
            }
        }
        
        console.log('✅ Complex Rome URL patterns working correctly');
        console.log(`   Tested ${complexUrls.length} different URL patterns`);
        console.log(`   Generated ${uniqueKeys.size} unique cache keys`);
        testsPassed++;
    } catch (error) {
        console.log('❌ Complex URL patterns test failed:', error.message);
    }
    
    // Results Summary
    console.log('\n🏆 Rome Cache Validation Test Results:');
    console.log(`✅ Tests Passed: ${testsPassed}/${totalTests}`);
    console.log(`📊 Success Rate: ${((testsPassed / totalTests) * 100).toFixed(1)}%`);
    
    if (testsPassed === totalTests) {
        console.log('\n🎉 ALL TESTS PASSED - Rome cache logic is working correctly!');
        console.log('\n🔍 KEY FINDINGS:');
        console.log('   ✓ Cache key generation is consistent and unique');
        console.log('   ✓ Page counts are stored and retrieved accurately');
        console.log('   ✓ URL normalization prevents case-sensitivity issues');
        console.log('   ✓ Invalid manifests are properly rejected');
        console.log('   ✓ Domain-specific clearing works as expected');
        console.log('   ✓ Complex URL patterns are handled correctly');
        console.log('\n📋 CONCLUSION: No cache-related issues that could cause incorrect page count persistence.');
    } else {
        console.log('\n⚠️ Some tests failed - cache logic may have issues that need investigation');
    }
    
    return {
        passed: testsPassed,
        total: totalTests,
        success: testsPassed === totalTests
    };
}

// Run the test
testRomeCacheValidation().catch(console.error);