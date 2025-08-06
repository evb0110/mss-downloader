#!/usr/bin/env node

/**
 * ULTRA-VALIDATION: Issue #12 - MDC Catalonia
 * Comprehensive validation with page downloads
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');
const fs = require('fs');
const path = require('path');
const https = require('https');

console.log('\n🔥 ULTRA-VALIDATION: MDC CATALONIA (Issue #12)');
console.log('═'.repeat(60));

async function downloadImage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

async function ultraValidation() {
    const loader = new SharedManifestLoaders();
    const userURL = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';
    
    console.log('\n📋 ISSUE DETAILS:');
    console.log('   Issue #12: каталония (Catalonia)');
    console.log('   Author: @textorhub');
    console.log('   Error reported: ETIMEDOUT 193.240.184.109:443https://...');
    console.log('   User version: v1.4.53');
    console.log('   Fixed in: v1.4.81');
    console.log('   Current version: v1.4.90');
    
    try {
        console.log('\n1️⃣ TESTING MANIFEST LOADING...');
        const startTime = Date.now();
        const manifest = await loader.getMDCCataloniaManifest(userURL);
        const loadTime = Date.now() - startTime;
        
        console.log(`   ✅ Manifest loaded in ${loadTime}ms`);
        console.log(`   ✅ Found ${manifest.images.length} pages`);
        
        // Check URL formatting
        console.log('\n2️⃣ CHECKING URL FORMATTING...');
        const hasIPConcatenation = manifest.images.some(img => 
            img.url.includes(':443https://') || 
            img.url.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+https?:\/\//)
        );
        
        if (hasIPConcatenation) {
            console.log('   ❌ URL concatenation bug detected!');
            return false;
        } else {
            console.log('   ✅ All URLs properly formatted');
        }
        
        // Download test pages
        console.log('\n3️⃣ DOWNLOADING TEST PAGES...');
        const testDir = path.join(__dirname, 'validation-pages');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        
        const pagesToTest = [0, Math.floor(manifest.images.length / 2), manifest.images.length - 1];
        const downloadResults = [];
        
        for (const pageIndex of pagesToTest) {
            const page = manifest.images[pageIndex];
            console.log(`   Downloading page ${pageIndex + 1}/${manifest.images.length}...`);
            
            try {
                const buffer = await downloadImage(page.url);
                const filename = path.join(testDir, `page-${pageIndex + 1}.jpg`);
                fs.writeFileSync(filename, buffer);
                
                const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
                console.log(`   ✅ Page ${pageIndex + 1}: ${sizeMB} MB`);
                downloadResults.push({ page: pageIndex + 1, size: buffer.length, success: true });
            } catch (err) {
                console.log(`   ❌ Failed to download page ${pageIndex + 1}: ${err.message}`);
                downloadResults.push({ page: pageIndex + 1, error: err.message, success: false });
            }
        }
        
        // Analyze results
        console.log('\n4️⃣ VALIDATION SUMMARY:');
        const successCount = downloadResults.filter(r => r.success).length;
        const totalSize = downloadResults
            .filter(r => r.success)
            .reduce((sum, r) => sum + r.size, 0);
        
        console.log(`   Pages downloaded: ${successCount}/${downloadResults.length}`);
        console.log(`   Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Average page size: ${(totalSize / successCount / 1024 / 1024).toFixed(2)} MB`);
        
        if (successCount === downloadResults.length) {
            console.log('\n✅✅✅ VALIDATION PASSED! ✅✅✅');
            console.log('\nMDC CATALONIA IS FULLY FUNCTIONAL!');
            console.log('The URL concatenation bug was fixed in v1.4.81');
            console.log('\n📢 USER ACTION REQUIRED:');
            console.log('   User @textorhub needs to UPDATE');
            console.log('   From: v1.4.53 (has bug)');
            console.log('   To: v1.4.90 (bug fixed)');
            return true;
        } else {
            console.log('\n⚠️ PARTIAL SUCCESS');
            return false;
        }
        
    } catch (error) {
        console.log('\n❌ VALIDATION FAILED!');
        console.log('Error:', error.message);
        
        if (error.message.includes('ETIMEDOUT')) {
            console.log('\n🔴 SAME ERROR AS USER REPORTED!');
            console.log('The bug is NOT fixed yet');
        }
        
        return false;
    }
}

// Run validation
ultraValidation()
    .then(success => {
        if (success) {
            console.log('\n' + '='.repeat(60));
            console.log('🎯 CONCLUSION: Issue #12 is RESOLVED');
            console.log('🔧 ACTION: Post update to GitHub issue');
            console.log('='.repeat(60));
        } else {
            console.log('\n' + '='.repeat(60));
            console.log('⚠️ CONCLUSION: Issue #12 needs attention');
            console.log('='.repeat(60));
        }
        process.exit(success ? 0 : 1);
    })
    .catch(err => {
        console.error('💥 Critical error:', err);
        process.exit(1);
    });