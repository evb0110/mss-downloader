#!/usr/bin/env node

/**
 * BNE Library Implementation Test
 * Tests the newly implemented BNE support in the manuscript downloader
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('🇪🇸 BNE (Biblioteca Nacional de España) Implementation Test');
console.log('=' .repeat(60));

// Test URLs from the analysis
const testUrls = [
    'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
    'https://bdh-rd.bne.es/viewer.vm?id=0000060229&page=1',
    'https://bdh-rd.bne.es/viewer.vm?id=0000015300&page=1'
];

// Create validation directory
const validationDir = path.join(__dirname, '../validation-current/bne-implementation-test');
if (!fs.existsSync(validationDir)) {
    fs.mkdirSync(validationDir, { recursive: true });
}

async function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                res.body = Buffer.concat(chunks);
                resolve(res);
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function extractManuscriptId(url) {
    const match = url.match(/[?&]id=(\d+)/);
    return match ? match[1] : null;
}

async function testPageDiscovery(manuscriptId) {
    console.log(`\n📖 Testing page discovery for manuscript ${manuscriptId}:`);
    
    const pages = [];
    let consecutiveFailures = 0;
    
    for (let page = 1; page <= 20; page++) { // Test first 20 pages
        const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&jpeg=true`;
        
        try {
            const response = await fetch(testUrl, { method: 'HEAD' });
            
            if (response.statusCode === 200 && response.headers['content-type']?.includes('image')) {
                pages.push(page);
                consecutiveFailures = 0;
                process.stdout.write(`${page} `);
            } else {
                consecutiveFailures++;
                if (consecutiveFailures >= 3) {
                    console.log(`\n   Stopped after ${consecutiveFailures} consecutive failures`);
                    break;
                }
            }
        } catch (error) {
            consecutiveFailures++;
            if (consecutiveFailures >= 3) {
                console.log(`\n   Stopped after ${consecutiveFailures} consecutive failures`);
                break;
            }
        }
        
        // Small delay to avoid overwhelming server
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n   Total pages found: ${pages.length}`);
    return pages;
}

async function downloadSampleImage(manuscriptId, page) {
    const imageUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&jpeg=true`;
    console.log(`   Downloading sample image: page ${page}`);
    
    try {
        const response = await fetch(imageUrl);
        
        if (response.statusCode === 200) {
            const filename = `bne_${manuscriptId}_page_${page}.jpg`;
            const filepath = path.join(validationDir, filename);
            fs.writeFileSync(filepath, response.body);
            
            const stats = fs.statSync(filepath);
            console.log(`   ✅ Downloaded: ${filename} (${Math.round(stats.size / 1024)} KB)`);
            return { success: true, size: stats.size, filename };
        } else {
            console.log(`   ❌ Failed: HTTP ${response.statusCode}`);
            return { success: false, error: `HTTP ${response.statusCode}` };
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testBneImplementation() {
    const results = [];
    
    for (const [index, url] of testUrls.entries()) {
        console.log(`\n${index + 1}. Testing URL: ${url}`);
        
        const manuscriptId = extractManuscriptId(url);
        if (!manuscriptId) {
            console.log('   ❌ Could not extract manuscript ID');
            continue;
        }
        
        console.log(`   📝 Manuscript ID: ${manuscriptId}`);
        
        // Test page discovery
        const pages = await testPageDiscovery(manuscriptId);
        
        if (pages.length === 0) {
            console.log('   ❌ No pages found');
            results.push({ url, manuscriptId, success: false, error: 'No pages found' });
            continue;
        }
        
        // Download sample images
        const samplePage = pages[0]; // First page
        const downloadResult = await downloadSampleImage(manuscriptId, samplePage);
        
        results.push({
            url,
            manuscriptId,
            success: downloadResult.success,
            totalPages: pages.length,
            sampleDownload: downloadResult
        });
    }
    
    return results;
}

async function main() {
    try {
        const results = await testBneImplementation();
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 BNE Implementation Test Results:');
        console.log('='.repeat(60));
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`✅ Successful: ${successful.length}/${results.length}`);
        console.log(`❌ Failed: ${failed.length}/${results.length}`);
        
        if (successful.length > 0) {
            console.log('\n✅ Successful Tests:');
            successful.forEach(result => {
                console.log(`   - Manuscript ${result.manuscriptId}: ${result.totalPages} pages, sample downloaded`);
            });
        }
        
        if (failed.length > 0) {
            console.log('\n❌ Failed Tests:');
            failed.forEach(result => {
                console.log(`   - Manuscript ${result.manuscriptId}: ${result.error || 'Unknown error'}`);
            });
        }
        
        console.log(`\n📁 Validation files saved to: ${validationDir}`);
        
        // Summary for validation report
        const overallSuccess = (successful.length / results.length) * 100;
        console.log(`\n🎯 Overall Success Rate: ${overallSuccess.toFixed(1)}%`);
        
        if (overallSuccess >= 80) {
            console.log('✅ BNE implementation appears to be working correctly!');
        } else {
            console.log('⚠️  BNE implementation needs further investigation.');
        }
        
        // Save detailed results
        const reportPath = path.join(validationDir, 'test-results.json');
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            testUrls,
            results,
            successRate: overallSuccess
        }, null, 2));
        
        console.log(`📋 Detailed results saved to: test-results.json`);
        
    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}