#!/usr/bin/env bun

/**
 * Test ContentDM's native API endpoints vs IIIF for Florence manuscripts
 */

const pageId = '217703'; // Page 2 from user's example
const collection = 'plutei';

console.log('🔍 TESTING CONTENTDM API PATTERNS');
console.log('================================\n');

// Test patterns the user showed
const nativeAPIUrl = `https://cdm21059.contentdm.oclc.org/digital/api/singleitem/image/${collection}/${pageId}/default.jpg`;
const iiifUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${pageId}/full/4000,/0/default.jpg`;

console.log(`Native API: ${nativeAPIUrl}`);
console.log(`IIIF URL:   ${iiifUrl}\n`);

async function testUrl(url: string, description: string) {
    try {
        console.log(`📋 Testing ${description}...`);
        
        const response = await fetch(url, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/*,*/*;q=0.8',
                'Referer': 'https://cdm21059.contentdm.oclc.org/',
            }
        });
        
        const size = response.headers.get('content-length');
        console.log(`   Status: ${response.status} ${response.statusText}`);
        console.log(`   Size: ${size ? Math.round(parseInt(size) / 1024) + 'KB' : 'unknown'}`);
        console.log(`   Content-Type: ${response.headers.get('content-type') || 'unknown'}`);
        
        return response.ok;
    } catch (error) {
        console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

async function main() {
    const nativeWorks = await testUrl(nativeAPIUrl, 'ContentDM Native API');
    console.log();
    const iiifWorks = await testUrl(iiifUrl, 'IIIF URL (current method)');
    
    console.log('\n🎯 RESULTS:');
    console.log(`   Native API works: ${nativeWorks ? '✅ YES' : '❌ NO'}`);
    console.log(`   IIIF URL works:   ${iiifWorks ? '✅ YES' : '❌ NO'}`);
    
    if (nativeWorks && !iiifWorks) {
        console.log('\n🚨 CONCLUSION: Native API works, IIIF fails!');
        console.log('   This explains the systematic download failures.');
        console.log('   Need to use ContentDM native API pattern instead of IIIF.');
    } else if (nativeWorks && iiifWorks) {
        console.log('\n✅ BOTH WORK: Should use Native API for consistency.');
    } else {
        console.log('\n❓ Need to investigate further...');
    }
}

main();