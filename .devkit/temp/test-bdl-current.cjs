#!/usr/bin/env node

/**
 * Test current BDL implementation to identify hanging issues
 */

async function testBDLSimple() {
    console.log('\n🔍 Testing BDL with simple fetch...');

    
    const testUrls = [
        'https://www.bdl.servizirl.it/bdl/public/rest/json/item/3903/bookreader/pages',
        'https://www.bdl.servizirl.it/bdl/public/rest/json/item/3904/bookreader/pages'
    ];
    
    for (const url of testUrls) {
        console.log(`\n📡 Testing: ${url}`);
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.log('   ⚠️ Request hanging - aborting after 15 seconds');
                controller.abort();
            }, 15000);
            
            const startTime = Date.now();
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            });
            
            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;
            
            console.log(`   ⏱️ Response time: ${responseTime}ms`);
            console.log(`   📊 Status: HTTP ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`   ✅ Success: ${data.length} pages found`);
            } else {
                console.log('   ❌ Failed: Server error');
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('   ⚠️ Request timed out (hanging detected)');
            } else {
                console.log(`   ❌ Error: ${error.message}`);
            }
        }
    }
}

async function main() {
    await testBDLSimple();
}

main().catch(console.error);