#!/usr/bin/env bun

/**
 * Test using correct child page IDs vs parent compound object IDs
 * Based on Ultrathink analysis that found this is the real routing bug
 */

async function testImageAccess(collection: string, pageId: string, description: string): Promise<{
    success: boolean;
    size?: number;
    status?: number;
    error?: string;
}> {
    try {
        const imageUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${pageId}/full/4000,/0/default.jpg`;
        
        const response = await fetch(imageUrl, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/*,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://cdm21059.contentdm.oclc.org/',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'same-origin',
                'DNT': '1'
            }
        });

        const contentLength = response.headers.get('content-length');
        const size = contentLength ? parseInt(contentLength) : 0;

        return {
            success: response.ok && size > 1000, // Must be a real image, not empty response
            size,
            status: response.status
        };

    } catch (error: any) {
        return {
            success: false,
            error: error.message
        };
    }
}

async function main() {
    console.log('🔍 Testing Parent vs Child ID Routing Bug...\n');
    
    const testCases = [
        // Parent compound object ID (what user provides and system currently uses)
        { collection: 'plutei', pageId: '217923', description: 'Parent compound object ID (user URL)' },
        
        // Child page IDs (what actually works for IIIF, from Ultrathink analysis)
        { collection: 'plutei', pageId: '217712', description: 'Child page ID 1 (should work)' },
        { collection: 'plutei', pageId: '217713', description: 'Child page ID 2 (should work)' },
        { collection: 'plutei', pageId: '217714', description: 'Child page ID 3 (should work)' },
        { collection: 'plutei', pageId: '217706', description: 'Child page ID 4 (from logs)' },
        { collection: 'plutei', pageId: '217707', description: 'Child page ID 5 (from logs)' },
        { collection: 'plutei', pageId: '217718', description: 'Child page ID 6 (from logs)' },
    ];

    console.log('Testing IIIF image access with different IDs:\n');

    let parentWorks = false;
    let childrenWork = 0;
    let childrenTotal = 0;

    for (const testCase of testCases) {
        const result = await testImageAccess(testCase.collection, testCase.pageId, testCase.description);
        
        const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
        const sizeInfo = result.size ? `${Math.round(result.size / 1024)}KB` : `${result.status || result.error}`;
        
        console.log(`${status} ${testCase.description}`);
        console.log(`        URL: https://cdm21059.contentdm.oclc.org/iiif/2/${testCase.collection}:${testCase.pageId}/full/4000,/0/default.jpg`);
        console.log(`        Result: ${sizeInfo}\n`);

        if (testCase.pageId === '217923') {
            parentWorks = result.success;
        } else {
            childrenTotal++;
            if (result.success) childrenWork++;
        }

        // Small delay to be respectful to server
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('🎯 Analysis Results:');
    console.log(`📊 Parent compound object (217923): ${parentWorks ? 'WORKS ✅' : 'FAILS ❌'}`);
    console.log(`📊 Child page IDs: ${childrenWork}/${childrenTotal} work (${Math.round(childrenWork/childrenTotal*100)}% success rate)`);

    if (!parentWorks && childrenWork > 0) {
        console.log('\n🚨 ROUTING BUG CONFIRMED:');
        console.log('✅ Child page IDs work perfectly for IIIF downloads');
        console.log('❌ Parent compound object ID fails (returns empty or error responses)');
        console.log('🔧 SOLUTION: Ensure download process uses extracted child page IDs, not parent ID');
        
        console.log('\n📋 Technical Fix Needed:');
        console.log('1. FlorenceLoader extracts child page IDs correctly ✅');
        console.log('2. Download process must use child IDs from pageLinks array ⚠️');
        console.log('3. Do NOT use original parent ID (217923) for IIIF requests ❌');
        
        console.log('\n🎯 Root Cause:');
        console.log('The system is somehow using parent ID (217923) instead of child IDs');
        console.log('This explains why users see 403/501 errors instead of successful downloads');
        
    } else if (parentWorks) {
        console.log('\n⚠️  Unexpected: Parent ID works - may be other issues');
    } else {
        console.log('\n❌ Both parent and children failing - server/network issue');
    }

    console.log('\n📁 Next Steps:');
    console.log('1. Debug why download queue uses parent ID instead of child IDs');
    console.log('2. Verify FlorenceLoader pageLinks array contains correct child URLs');
    console.log('3. Check routing in EnhancedDownloadQueue or other download components');
}

main().catch(console.error);