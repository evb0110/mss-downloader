#!/usr/bin/env node

/**
 * Test BNC Roma implementation to verify file sizes and quality
 */

async function testBNCRoma() {
    console.log('🔍 Testing BNC Roma implementation...\n');
    
    const testUrl = 'http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/BVEE112879/BVEE112879/1';
    
    try {
        // Test the /original endpoint that should be used
        const originalUrl = 'http://digitale.bnc.roma.sbn.it/tecadigitale/img/libroantico/BVEE112879/BVEE112879/1/original';
        const fullUrl = 'http://digitale.bnc.roma.sbn.it/tecadigitale/img/libroantico/BVEE112879/BVEE112879/1/full';
        
        console.log('1️⃣ Testing /original endpoint (should be highest quality)...');
        await testImageEndpoint(originalUrl, 'original');
        
        console.log('\n2️⃣ Testing /full endpoint (fallback)...');
        await testImageEndpoint(fullUrl, 'full');
        
        console.log('\n🎯 ANALYSIS:');
        console.log('If /original endpoint works and provides larger files, the implementation is correct.');
        console.log('If /original fails or provides small files, there may be a server-side issue.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

async function testImageEndpoint(url, endpointName) {
    try {
        console.log(`📡 Testing: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('   ⚠️ Request hanging - aborting after 15 seconds');
            controller.abort();
        }, 15000);
        
        const startTime = Date.now();
        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        
        console.log(`   ⏱️ Response time: ${responseTime}ms`);
        console.log(`   📊 Status: HTTP ${response.status} ${response.statusText}`);
        console.log(`   📄 Content-Type: ${response.headers.get('content-type')}`);
        
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
            const sizeKB = Math.round(parseInt(contentLength) / 1024);
            console.log(`   📏 File size: ${contentLength} bytes (${sizeKB} KB)`);
            
            // Analyze file size
            if (sizeKB < 50) {
                console.log(`   ⚠️ WARNING: Very small file size for ${endpointName} - may be thumbnail or error page`);
            } else if (sizeKB < 200) {
                console.log(`   ⚠️ Small file size for ${endpointName} - may be low quality`);
            } else if (sizeKB < 500) {
                console.log(`   ✅ Medium file size for ${endpointName} - acceptable quality`);
            } else {
                console.log(`   ✅ Large file size for ${endpointName} - high quality`);
            }
        } else {
            console.log('   ❓ No content-length header');
        }
        
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('image/jpeg')) {
                console.log(`   ✅ ${endpointName} endpoint working correctly`);
            } else {
                console.log(`   ❌ ${endpointName} endpoint returning non-image content: ${contentType}`);
            }
        } else {
            console.log(`   ❌ ${endpointName} endpoint failed: HTTP ${response.status}`);
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log(`   ⚠️ ${endpointName} endpoint timed out (hanging detected)`);
        } else {
            console.log(`   ❌ ${endpointName} endpoint error: ${error.message}`);
        }
    }
}

testBNCRoma().catch(console.error);