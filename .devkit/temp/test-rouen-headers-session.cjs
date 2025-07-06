#!/usr/bin/env node

const https = require('https');

/**
 * Test Rouen library header and session requirements
 */

const TEST_MANUSCRIPT = 'btv1b10052442z';
const TEST_PAGE = '1';
const RESOLUTION = 'highres';

async function testDownload(testName, options) {
    return new Promise((resolve) => {
        const imageUrl = `https://www.rotomagus.fr/ark:/12148/${TEST_MANUSCRIPT}/f${TEST_PAGE}.${RESOLUTION}`;
        
        console.log(`\n🧪 Test: ${testName}`);
        console.log(`   URL: ${imageUrl}`);
        console.log(`   Headers: ${JSON.stringify(options.headers || {}, null, 6)}`);

        const req = https.request(imageUrl, options, (res) => {
            let size = 0;
            res.on('data', (chunk) => size += chunk.length);
            res.on('end', () => {
                const result = {
                    testName,
                    statusCode: res.statusCode,
                    contentType: res.headers['content-type'],
                    size: size,
                    success: res.statusCode === 200 && size > 1000
                };
                
                console.log(`   ✅ Status: ${result.statusCode}`);
                console.log(`   📦 Size: ${result.size} bytes`);
                console.log(`   🎨 Content-Type: ${result.contentType}`);
                console.log(`   🏆 Success: ${result.success ? 'YES' : 'NO'}`);
                
                resolve(result);
            });
        });

        req.on('error', (error) => {
            console.log(`   ❌ Error: ${error.message}`);
            resolve({
                testName,
                error: error.message,
                success: false
            });
        });

        req.end();
    });
}

async function runHeaderTests() {
    console.log('🔍 Testing Rouen Library Header and Session Requirements\n');

    const tests = [
        {
            name: 'No headers (baseline)',
            options: {
                method: 'GET'
            }
        },
        {
            name: 'Only User-Agent',
            options: {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            }
        },
        {
            name: 'Only Referer',
            options: {
                method: 'GET',
                headers: {
                    'Referer': `https://www.rotomagus.fr/ark:/12148/${TEST_MANUSCRIPT}/f${TEST_PAGE}.item.zoom`
                }
            }
        },
        {
            name: 'User-Agent + Referer (full headers)',
            options: {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Referer': `https://www.rotomagus.fr/ark:/12148/${TEST_MANUSCRIPT}/f${TEST_PAGE}.item.zoom`
                }
            }
        },
        {
            name: 'Full browser headers',
            options: {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': `https://www.rotomagus.fr/ark:/12148/${TEST_MANUSCRIPT}/f${TEST_PAGE}.item.zoom`,
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive'
                }
            }
        }
    ];

    const results = [];
    
    for (const test of tests) {
        const result = await testDownload(test.name, test.options);
        results.push(result);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n📊 HEADER REQUIREMENTS ANALYSIS\n');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful tests: ${successful.length}/${results.length}`);
    console.log(`❌ Failed tests: ${failed.length}/${results.length}\n`);
    
    successful.forEach(test => {
        console.log(`   ✅ ${test.testName}: ${test.size} bytes`);
    });
    
    if (failed.length > 0) {
        console.log('\n❌ Failed tests:');
        failed.forEach(test => {
            console.log(`   ❌ ${test.testName}: ${test.error || `Status ${test.statusCode}`}`);
        });
    }

    console.log('\n💡 CONCLUSIONS:');
    
    if (successful.length === results.length) {
        console.log('   🎉 All header configurations work - minimal requirements');
        console.log('   ✅ Rouen library appears to have relaxed header requirements');
        console.log('   📝 Recommendation: Use standard User-Agent for best compatibility');
    } else if (successful.length > 0) {
        console.log('   ⚠️  Some header configurations required for success');
        const requiredHeaders = [];
        
        if (successful.some(t => t.testName.includes('User-Agent'))) {
            requiredHeaders.push('User-Agent');
        }
        if (successful.some(t => t.testName.includes('Referer'))) {
            requiredHeaders.push('Referer');
        }
        
        console.log(`   📋 Required headers: ${requiredHeaders.join(', ')}`);
    } else {
        console.log('   ❌ All tests failed - server may be blocking requests');
        console.log('   💡 Consider checking IP restrictions or authentication requirements');
    }

    return {
        testResults: results,
        successRate: `${successful.length}/${results.length}`,
        requiredHeaders: successful.length > 0 ? ['User-Agent recommended', 'Referer optional'] : ['Investigation needed']
    };
}

runHeaderTests().catch(console.error);