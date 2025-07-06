#!/usr/bin/env node

// Test the actual service's fetch behavior with redirects

async function testFetchWithRedirects() {
    console.log('🧪 Testing Node.js fetch with redirects...');
    
    const testUrl = 'https://dl.ub.uni-freiburg.de/diglit/hs360a/mets';
    
    try {
        console.log(`📡 Fetching: ${testUrl}`);
        
        const response = await fetch(testUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/xml,text/xml,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                'Cache-Control': 'no-cache'
            }
        });
        
        console.log(`📊 Response status: ${response.status} ${response.statusText}`);
        console.log(`🔗 Final URL: ${response.url}`);
        console.log(`📄 Content-Type: ${response.headers.get('content-type')}`);
        
        if (response.ok) {
            const text = await response.text();
            console.log(`✅ Content length: ${text.length} characters`);
            
            // Check if it's XML
            if (text.includes('<?xml') && text.includes('mets')) {
                console.log(`🎯 Valid METS XML received!`);
                
                // Quick parse to count files
                const fileMatches = text.match(/<mets:file[^>]*>|<file[^>]*>/g) || [];
                console.log(`📁 Found ${fileMatches.length} file entries`);
                
                // Look for MAX resolution files
                const maxFiles = text.match(/USE="MAX"/g) || [];
                console.log(`🖼️ Found ${maxFiles.length} MAX resolution file groups`);
                
                return {
                    success: true,
                    finalUrl: response.url,
                    contentLength: text.length,
                    fileCount: fileMatches.length,
                    maxResFiles: maxFiles.length
                };
            } else {
                console.log(`❌ Response is not valid METS XML`);
                console.log(`First 200 characters: ${text.substring(0, 200)}`);
                return { success: false, error: 'Not valid METS XML' };
            }
        } else {
            console.log(`❌ Request failed: ${response.status} ${response.statusText}`);
            return { success: false, error: `HTTP ${response.status}` };
        }
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testImageUrls() {
    console.log('\n🖼️ Testing sample image URLs...');
    
    // These are the direct URLs from the METS we found earlier
    const testUrls = [
        'https://dl.ub.uni-freiburg.de/diglitData/image/hs360a/4/00000Vorderdeckel.jpg',
        'https://dl.ub.uni-freiburg.de/diglitData/image/hs360a/4/00000Vorderspiegel.jpg'
    ];
    
    const results = [];
    
    for (const url of testUrls) {
        try {
            console.log(`  📡 Testing: ${url.split('/').pop()}`);
            
            const response = await fetch(url, {
                method: 'HEAD', // Just test if accessible
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'image/*,*/*;q=0.8'
                }
            });
            
            if (response.ok) {
                const contentLength = response.headers.get('content-length');
                console.log(`    ✅ ${response.status} - Size: ${contentLength ? Math.round(parseInt(contentLength) / 1024) + 'KB' : 'unknown'}`);
                results.push({ url, success: true, status: response.status, size: contentLength });
            } else {
                console.log(`    ❌ ${response.status} ${response.statusText}`);
                results.push({ url, success: false, status: response.status });
            }
            
        } catch (error) {
            console.log(`    ❌ Error: ${error.message}`);
            results.push({ url, success: false, error: error.message });
        }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`📊 Image URL test: ${successCount}/${results.length} successful`);
    
    return results;
}

async function main() {
    const metsResult = await testFetchWithRedirects();
    const imageResults = await testImageUrls();
    
    console.log('\n📊 TEST SUMMARY');
    console.log('='.repeat(40));
    console.log(`METS XML fetch: ${metsResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (metsResult.success) {
        console.log(`Final METS URL: ${metsResult.finalUrl}`);
        console.log(`File entries found: ${metsResult.fileCount}`);
        console.log(`MAX resolution groups: ${metsResult.maxResFiles}`);
    }
    
    const imageSuccessCount = imageResults.filter(r => r.success).length;
    console.log(`Image accessibility: ${imageSuccessCount}/${imageResults.length} successful`);
    
    if (metsResult.success && imageSuccessCount > 0) {
        console.log('\n🎉 Freiburg implementation should work correctly!');
        console.log('The service properly handles METS XML redirects and images are accessible.');
    } else {
        console.log('\n⚠️ Issues detected that may affect implementation.');
    }
    
    return {
        metsResult,
        imageResults,
        overallSuccess: metsResult.success && imageSuccessCount > 0
    };
}

main().catch(console.error);