#!/usr/bin/env node

/**
 * BDL Hanging Issue Investigation
 * Test to identify where BDL downloads hang during "calculation" phase
 */

// Use Node.js built-in fetch (Node 18+)
const fetch = globalThis.fetch;

async function testBDLHanging() {
    console.log('🔍 Testing BDL hanging issue during calculation phase...\n');
    
    const testUrl = 'https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3903';
    
    try {
        // Step 1: Test URL parsing (should be instant)
        console.log('1️⃣ Testing URL parsing...');
        const urlWithoutHash = testUrl.split('#')[0];
        const urlParams = new URLSearchParams(urlWithoutHash.split('?')[1]);
        const manuscriptId = urlParams.get('cdOggetto');
        const pathType = urlParams.get('path');
        
        if (!manuscriptId || !pathType) {
            throw new Error('URL parsing failed');
        }
        
        console.log(`   ✅ Parsed: manuscriptId=${manuscriptId}, pathType=${pathType}`);
        
        // Step 2: Test API call (this might hang)
        console.log('\n2️⃣ Testing BDL API call...');
        const servicePath = pathType === 'fe' ? 'public' : 'private';
        const pagesApiUrl = `https://www.bdl.servizirl.it/bdl/${servicePath}/rest/json/item/${manuscriptId}/bookreader/pages`;
        
        console.log(`   📡 Calling: ${pagesApiUrl}`);
        
        const startTime = Date.now();
        
        // Add timeout to detect hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('   ⚠️ API call hanging - aborting after 30 seconds');
            controller.abort();
        }, 30000);
        
        try {
            const response = await fetch(pagesApiUrl, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            });
            
            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;
            
            console.log(`   ⏱️ API response time: ${responseTime}ms`);
            
            if (!response.ok) {
                console.log(`   ❌ API failed: HTTP ${response.status} ${response.statusText}`);
                return;
            }
            
            const pagesData = await response.json();
            console.log(`   ✅ API success: ${pagesData.length} pages found`);
            
            // Step 3: Test image URL construction (should be instant)
            console.log('\n3️⃣ Testing image URL construction...');
            const imageUrls = [];
            
            for (let i = 0; i < Math.min(5, pagesData.length); i++) {
                const page = pagesData[i];
                if (page.idMediaServer) {
                    const imageUrl = `https://www.bdl.servizirl.it/cantaloupe/iiif/2/${page.idMediaServer}/full/max/0/default.jpg`;
                    imageUrls.push(imageUrl);
                }
            }
            
            console.log(`   ✅ Generated ${imageUrls.length} image URLs`);
            
            // Step 4: Test first image validation (this might hang)
            console.log('\n4️⃣ Testing first image validation...');
            
            if (imageUrls.length > 0) {
                const firstImageUrl = imageUrls[0];
                console.log(`   📡 Testing: ${firstImageUrl}`);
                
                const imageStartTime = Date.now();
                const imageController = new AbortController();
                const imageTimeoutId = setTimeout(() => {
                    console.log('   ⚠️ Image validation hanging - aborting after 20 seconds');
                    imageController.abort();
                }, 20000);
                
                try {
                    const imageResponse = await fetch(firstImageUrl, {
                        method: 'HEAD',
                        signal: imageController.signal,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                        }
                    });
                    
                    clearTimeout(imageTimeoutId);
                    const imageResponseTime = Date.now() - imageStartTime;
                    
                    console.log(`   ⏱️ Image validation time: ${imageResponseTime}ms`);
                    console.log(`   📊 Image response: HTTP ${imageResponse.status} ${imageResponse.statusText}`);
                    
                    if (imageResponse.ok) {
                        console.log('   ✅ Image validation successful');
                    } else {
                        console.log('   ❌ Image validation failed - server error');
                    }
                    
                } catch (imageError) {
                    clearTimeout(imageTimeoutId);
                    if (imageError.name === 'AbortError') {
                        console.log('   ⚠️ Image validation timed out (hanging detected)');
                    } else {
                        console.log(`   ❌ Image validation error: ${imageError.message}`);
                    }
                }
            }
            
            console.log('\n🎯 HANGING ANALYSIS COMPLETE');
            console.log('=====================================');
            
            // Analyze where hanging occurs
            if (responseTime > 10000) {
                console.log('🚨 HANGING DETECTED: API call took > 10 seconds');
                console.log('   💡 Solution: Increase API timeout in progress monitor');
            }
            
            console.log('\n📋 RECOMMENDATIONS:');
            console.log('1. Add BDL-specific timeout configuration');
            console.log('2. Implement better progress feedback during API calls');
            console.log('3. Add fallback mechanisms for server errors');
            console.log('4. Improve user messaging about server issues');
            
        } catch (apiError) {
            clearTimeout(timeoutId);
            if (apiError.name === 'AbortError') {
                console.log('   ⚠️ API call timed out (hanging detected)');
                console.log('\n🚨 HANGING DETECTED: API call hanging after 30 seconds');
                console.log('   💡 Solution: This is the primary hanging issue');
            } else {
                console.log(`   ❌ API error: ${apiError.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testBDLHanging().catch(console.error);