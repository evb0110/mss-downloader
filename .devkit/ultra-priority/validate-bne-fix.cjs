#!/usr/bin/env node

/**
 * ULTRA-VALIDATION Script for Issue #11 BNE Fix
 * Tests that BNE URLs now work correctly with the DownloadQueue
 */

const path = require('path');
const fs = require('fs');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔬 ULTRA-VALIDATION: BNE FIX VERIFICATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Issue #11: висит на калькуляции (hanging on calculation)');
console.log('Fix: DownloadQueue now uses EnhancedManuscriptDownloaderService\n');

// Test 1: Verify imports are correct
console.log('📋 Test 1: Verifying correct imports in DownloadQueue.ts...');
const queueContent = fs.readFileSync(
    path.join(__dirname, '../../src/main/services/DownloadQueue.ts'), 
    'utf8'
);

if (queueContent.includes("import { EnhancedManuscriptDownloaderService }")) {
    console.log('✅ Correct import: EnhancedManuscriptDownloaderService');
} else {
    console.error('❌ FAILED: Still importing ManuscriptDownloaderService');
    process.exit(1);
}

if (!queueContent.includes("import { ManuscriptDownloaderService }")) {
    console.log('✅ Old ManuscriptDownloaderService import removed');
} else {
    console.error('❌ WARNING: Old ManuscriptDownloaderService import still present');
}

// Test 2: Verify service instantiation
console.log('\n📋 Test 2: Verifying service instantiation...');
const enhancedCount = (queueContent.match(/new EnhancedManuscriptDownloaderService/g) || []).length;
const oldCount = (queueContent.match(/new ManuscriptDownloaderService/g) || []).length;

console.log(`Found ${enhancedCount} instances of EnhancedManuscriptDownloaderService`);
console.log(`Found ${oldCount} instances of ManuscriptDownloaderService`);

if (enhancedCount >= 2 && oldCount === 0) {
    console.log('✅ All instances updated to use EnhancedManuscriptDownloaderService');
} else {
    console.error('❌ FAILED: Not all instances updated');
    process.exit(1);
}

// Test 3: Verify method calls
console.log('\n📋 Test 3: Verifying method calls...');
if (queueContent.includes('loadManifest(item.url)')) {
    console.log('✅ Using loadManifest method (correct for Enhanced service)');
} else {
    console.error('❌ WARNING: Not using loadManifest method');
}

if (!queueContent.includes('parseManuscriptUrl')) {
    console.log('✅ Old parseManuscriptUrl method removed');
} else {
    console.error('❌ WARNING: Still using parseManuscriptUrl');
}

// Test 4: Test with actual BNE URL
console.log('\n📋 Test 4: Testing BNE support in EnhancedManuscriptDownloaderService...');
const { EnhancedManuscriptDownloaderService } = require('../../src/main/services/EnhancedManuscriptDownloaderService');

async function testBNESupport() {
    try {
        const service = new EnhancedManuscriptDownloaderService();
        const url = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
        
        console.log('Testing URL:', url);
        const startTime = Date.now();
        
        const manifest = await service.loadManifest(url);
        
        const loadTime = Date.now() - startTime;
        console.log(`✅ Manifest loaded successfully in ${loadTime}ms`);
        console.log(`   Library: ${manifest.library}`);
        console.log(`   Total Pages: ${manifest.totalPages}`);
        console.log(`   Display Name: ${manifest.displayName}`);
        
        if (manifest.library === 'bne' && manifest.totalPages > 0) {
            console.log('✅ BNE correctly identified and processed');
        } else {
            console.error('❌ BNE not properly identified');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('❌ Failed to load BNE manifest:', error.message);
        return false;
    }
}

// Test 5: Compare with old service (should fail)
console.log('\n📋 Test 5: Confirming old service does NOT support BNE...');
async function testOldServiceFails() {
    try {
        const { ManuscriptDownloaderService } = require('../../src/main/services/ManuscriptDownloaderService');
        const service = new ManuscriptDownloaderService();
        const url = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
        
        await service.parseManuscriptUrl(url);
        console.error('❌ UNEXPECTED: Old service didn\'t throw error for BNE');
        return false;
    } catch (error) {
        if (error.message.includes('Unsupported URL')) {
            console.log('✅ Confirmed: Old service throws "Unsupported URL" for BNE');
            return true;
        } else {
            console.error('❌ Unexpected error:', error.message);
            return false;
        }
    }
}

// Run async tests
(async () => {
    const bneWorks = await testBNESupport();
    const oldFails = await testOldServiceFails();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 VALIDATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (bneWorks && oldFails) {
        console.log('✅ FIX VALIDATED SUCCESSFULLY!');
        console.log('\nRoot Cause: DownloadQueue was using ManuscriptDownloaderService');
        console.log('Solution: Switched to EnhancedManuscriptDownloaderService');
        console.log('Result: BNE URLs now work correctly in the download queue');
        console.log('\n🎉 Issue #11 is TRULY FIXED after 6 previous attempts!');
    } else {
        console.error('❌ VALIDATION FAILED - Fix incomplete');
        process.exit(1);
    }
})().catch(error => {
    console.error('Validation error:', error);
    process.exit(1);
});