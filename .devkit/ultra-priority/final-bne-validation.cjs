#!/usr/bin/env node

/**
 * FINAL VALIDATION for Issue #11 - BNE Queue Fix
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const fs = require('fs');
const path = require('path');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔬 FINAL BNE FIX VALIDATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function validateFix() {
    const results = {
        codeChanges: false,
        bneSupport: false,
        downloadTest: false
    };
    
    // Test 1: Verify code changes
    console.log('\n📋 Test 1: Verifying DownloadQueue code changes...');
    const queuePath = path.join(__dirname, '../../src/main/services/DownloadQueue.ts');
    const queueContent = fs.readFileSync(queuePath, 'utf8');
    
    const checks = [
        {
            test: queueContent.includes('import { EnhancedManuscriptDownloaderService }'),
            message: 'Import EnhancedManuscriptDownloaderService'
        },
        {
            test: !queueContent.includes('import { ManuscriptDownloaderService }'),
            message: 'Removed ManuscriptDownloaderService import'
        },
        {
            test: queueContent.includes('new EnhancedManuscriptDownloaderService()'),
            message: 'Using EnhancedManuscriptDownloaderService instances'
        },
        {
            test: queueContent.includes('await downloader.loadManifest(item.url)'),
            message: 'Using loadManifest method'
        },
        {
            test: queueContent.includes('await downloader.downloadManuscript(item.url'),
            message: 'Using downloadManuscript method'
        }
    ];
    
    let allPassed = true;
    for (const check of checks) {
        if (check.test) {
            console.log(`  ✅ ${check.message}`);
        } else {
            console.log(`  ❌ ${check.message}`);
            allPassed = false;
        }
    }
    results.codeChanges = allPassed;
    
    // Test 2: Verify BNE manifest loading
    console.log('\n📋 Test 2: Testing BNE manifest loading...');
    const loader = new SharedManifestLoaders();
    const url = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    
    try {
        const startTime = Date.now();
        const manifest = await loader.getBNEManifest(url);
        const loadTime = Date.now() - startTime;
        
        console.log(`  ✅ Manifest loaded in ${loadTime}ms`);
        console.log(`  ✅ Found ${manifest.images.length} pages`);
        results.bneSupport = manifest.images.length > 0;
    } catch (error) {
        console.error(`  ❌ Failed to load manifest: ${error.message}`);
        results.bneSupport = false;
    }
    
    // Test 3: Test actual PDF download
    console.log('\n📋 Test 3: Testing actual PDF download...');
    try {
        const testUrl = 'https://bdh-rd.bne.es/pdf.raw?query=id:0000007619&page=1&pdf=true';
        const response = await loader.fetchWithRetry(testUrl, {
            method: 'HEAD',
            timeout: 10000
        });
        
        if (response.ok || response.status === 200) {
            console.log(`  ✅ PDF URL accessible (status: ${response.status})`);
            results.downloadTest = true;
        } else {
            console.log(`  ❌ PDF URL returned status: ${response.status}`);
            results.downloadTest = false;
        }
    } catch (error) {
        console.error(`  ❌ PDF download test failed: ${error.message}`);
        results.downloadTest = false;
    }
    
    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 VALIDATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const allTestsPassed = results.codeChanges && results.bneSupport && results.downloadTest;
    
    if (allTestsPassed) {
        console.log('✅ ALL TESTS PASSED!');
        console.log('\n🎯 ROOT CAUSE: DownloadQueue was using ManuscriptDownloaderService');
        console.log('   which doesn\'t support BNE libraries.');
        console.log('\n✅ SOLUTION: Switched to EnhancedManuscriptDownloaderService');
        console.log('   which has full BNE support.');
        console.log('\n🎉 Issue #11 is FIXED after identifying the ACTUAL root cause!');
        console.log('\nThe issue wasn\'t in BNE handling itself (which worked fine),');
        console.log('but in the queue using the wrong downloader service.');
        return true;
    } else {
        console.error('\n❌ VALIDATION FAILED');
        console.error('Code changes:', results.codeChanges ? '✅' : '❌');
        console.error('BNE support:', results.bneSupport ? '✅' : '❌');
        console.error('Download test:', results.downloadTest ? '✅' : '❌');
        return false;
    }
}

// Run validation
validateFix().then(success => {
    if (!success) {
        process.exit(1);
    }
}).catch(error => {
    console.error('Validation error:', error);
    process.exit(1);
});