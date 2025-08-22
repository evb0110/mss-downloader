#!/usr/bin/env bun

/**
 * Quick test of Florence gap filtering on a small subset
 */

async function quickGapTest() {
    console.log('🔍 QUICK FLORENCE GAP FILTERING TEST');
    console.log('===================================\n');
    
    const testPages = [
        { id: '217706', title: 'Page 1' },
        { id: '217707', title: 'Page 2' },  // Known 403 error
        { id: '217708', title: 'Page 3' },
        { id: '217709', title: 'Page 4' },  // Known 403 error
        { id: '217710', title: 'Page 5' },
        { id: '217711', title: 'Page 6' },  // Known 403 error
        { id: '217712', title: 'Page 7' },
        { id: '217918', title: 'Page 8' },  // Known 501 error
        { id: '217919', title: 'Page 9' },  // Known 501 error
        { id: '217920', title: 'Page 10' }  // Known 501 error
    ];
    
    console.log(`Testing ${testPages.length} pages (mix of valid/403/501)...`);
    
    const validatedPages = [];
    
    for (const page of testPages) {
        try {
            const testUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${page.id}/info.json`;
            
            const response = await fetch(testUrl, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/json,*/*;q=0.8',
                    'Referer': 'https://cdm21059.contentdm.oclc.org/',
                }
            });
            
            if (response.ok) {
                validatedPages.push(page);
                console.log(`✅ Page ${page.id}: Valid (${response.status})`);
            } else {
                console.log(`❌ Page ${page.id}: Invalid (${response.status} ${response.statusText}) - FILTERED OUT`);
            }
        } catch (error) {
            console.log(`💥 Page ${page.id}: Error (${error instanceof Error ? error.message : String(error)}) - FILTERED OUT`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n📊 Gap filtering results:`);
    console.log(`Original pages: ${testPages.length}`);
    console.log(`Valid pages after filtering: ${validatedPages.length}`);
    console.log(`Filtered out: ${testPages.length - validatedPages.length}`);
    console.log(`Success rate: ${Math.round((validatedPages.length / testPages.length) * 100)}%`);
    
    console.log(`\n✅ Valid pages remaining:`);
    validatedPages.forEach(page => {
        console.log(`   - ${page.id}: ${page.title}`);
    });
    
    const expectedValid = 5; // Pages 217706, 217708, 217710, 217712, plus potentially others
    if (validatedPages.length >= expectedValid) {
        console.log(`\n🎉 Gap filtering working correctly!`);
        console.log(`Expected ~${expectedValid} valid pages, got ${validatedPages.length}`);
        return true;
    } else {
        console.log(`\n⚠️  Gap filtering may need adjustment`);
        console.log(`Expected ~${expectedValid} valid pages, got ${validatedPages.length}`);
        return false;
    }
}

quickGapTest().then(success => {
    if (success) {
        console.log('\n🚀 Gap filtering ready for production testing');
        process.exit(0);
    } else {
        console.log('\n🔧 Gap filtering needs further refinement');
        process.exit(1);
    }
});