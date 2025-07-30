/**
 * Florence Library v1.4.49 Validation Script
 * Tests the fixed ContentDM implementation with proper error handling
 */

const path = require('path');
const fs = require('fs');
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function main() {
    console.log('🧪 Florence Library v1.4.49 Validation Test');
    console.log('=' .repeat(60));
    
    const loader = new SharedManifestLoaders();
    
    // Test URLs from the test suite
    const testUrls = [
        'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',  // Evangelia manuscript
        'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317539/',  // Parent compound object
        'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/174871/',  // Alternative test manuscript
    ];
    
    const results = [];
    
    for (let i = 0; i < testUrls.length; i++) {
        const url = testUrls[i];
        console.log(`\n📄 Test ${i + 1}/3: ${url}`);
        console.log('-'.repeat(60));
        
        try {
            const startTime = Date.now();
            const manifest = await loader.getFlorenceManifest(url);
            const duration = Date.now() - startTime;
            
            console.log(`✅ Success! Loaded in ${duration}ms`);
            console.log(`📊 Pages found: ${manifest.images?.length || 0}`);
            
            if (manifest.images && manifest.images.length > 0) {
                console.log(`🔗 Sample URLs:`);
                for (let j = 0; j < Math.min(3, manifest.images.length); j++) {
                    console.log(`   ${j + 1}. ${manifest.images[j].label}: ${manifest.images[j].url}`);
                }
                if (manifest.images.length > 3) {
                    console.log(`   ... and ${manifest.images.length - 3} more pages`);
                }
            }
            
            results.push({
                url,
                status: 'success',
                pageCount: manifest.images?.length || 0,
                duration,
                firstPageUrl: manifest.images?.[0]?.url || null
            });
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            results.push({
                url,
                status: 'error',
                error: error.message,
                pageCount: 0
            });
        }
    }
    
    // Summary
    console.log('\n📊 Validation Summary');
    console.log('=' .repeat(60));
    
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;
    const totalPages = results.reduce((sum, r) => sum + r.pageCount, 0);
    
    console.log(`✅ Successful: ${successful}/${testUrls.length}`);
    console.log(`❌ Failed: ${failed}/${testUrls.length}`);
    console.log(`📄 Total pages discovered: ${totalPages}`);
    
    if (successful > 0) {
        const avgPages = totalPages / successful;
        console.log(`📊 Average pages per manuscript: ${avgPages.toFixed(1)}`);
    }
    
    // Test image accessibility (sample check)
    if (results.some(r => r.firstPageUrl)) {
        console.log('\n🔍 Testing Image Accessibility...');
        const testResult = results.find(r => r.firstPageUrl);
        
        try {
            const https = require('https');
            const testUrl = testResult.firstPageUrl;
            
            const headCheck = await new Promise((resolve, reject) => {
                const req = https.request(testUrl, { method: 'HEAD' }, (res) => {
                    resolve({
                        status: res.statusCode,
                        contentType: res.headers['content-type'],
                        contentLength: res.headers['content-length']
                    });
                });
                req.on('error', reject);
                req.setTimeout(10000, () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
                req.end();
            });
            
            if (headCheck.status === 200) {
                console.log(`✅ Sample image accessible (${headCheck.contentType}, ${headCheck.contentLength} bytes)`);
            } else {
                console.log(`⚠️ Sample image returned status: ${headCheck.status}`);
            }
            
        } catch (imageError) {
            console.log(`❌ Image accessibility test failed: ${imageError.message}`);
        }
    }
    
    // Write results to file
    const resultsPath = path.join(__dirname, '../validation-results/v1.4.49/florence-validation-results.json');
    const resultsDir = path.dirname(resultsPath);
    
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    fs.writeFileSync(resultsPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        version: 'v1.4.49',
        library: 'florence',
        testUrls,
        results,
        summary: {
            successful,
            failed,
            totalPages,
            averagePages: successful > 0 ? totalPages / successful : 0
        }
    }, null, 2));
    
    console.log(`\n💾 Results saved to: ${resultsPath}`);
    
    // Overall status
    if (failed === 0) {
        console.log('\n🎉 All tests passed! Florence library is working correctly.');
        process.exit(0);
    } else if (successful > 0) {
        console.log(`\n⚠️ Partial success: ${successful} passed, ${failed} failed.`);
        process.exit(1);
    } else {
        console.log('\n💥 All tests failed! Florence library needs further investigation.');
        process.exit(2);
    }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(3);
});

main().catch(error => {
    console.error('Validation script failed:', error);
    process.exit(4);
});