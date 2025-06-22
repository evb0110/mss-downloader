// Test different ID patterns to find the right titleinfo ID
const pageviewId = '8224540';
const potentialTitleinfoIds = [
    pageviewId,                    // Same ID
    (parseInt(pageviewId) - 1).toString(),  // -1
    (parseInt(pageviewId) - 2).toString(),  // -2
    (parseInt(pageviewId) - 3).toString(),  // -3
    (parseInt(pageviewId) + 1).toString(),  // +1
    (parseInt(pageviewId) + 2).toString(),  // +2
];

console.log('Testing different titleinfo ID patterns for pageview ID:', pageviewId);

async function testTitleinfoId(id) {
    const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${id}/manifest`;
    
    try {
        const response = await fetch(manifestUrl, {
            headers: {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.ok) {
            const manifest = await response.json();
            const pageCount = manifest.sequences?.[0]?.canvases?.length || 0;
            const title = manifest.label || 'No title';
            console.log(`✅ ID ${id}: SUCCESS - ${pageCount} pages - ${JSON.stringify(title)}`);
            return { id, success: true, pageCount, title };
        } else {
            console.log(`❌ ID ${id}: FAILED - HTTP ${response.status}`);
            return { id, success: false, status: response.status };
        }
    } catch (error) {
        console.log(`❌ ID ${id}: ERROR - ${error.message}`);
        return { id, success: false, error: error.message };
    }
}

// Test all potential IDs
Promise.all(potentialTitleinfoIds.map(testTitleinfoId))
.then(results => {
    console.log('\n=== SUMMARY ===');
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful IDs: ${successful.length}`);
    successful.forEach(r => console.log(`  - ${r.id}: ${r.pageCount} pages`));
    
    console.log(`❌ Failed IDs: ${failed.length}`);
    failed.forEach(r => console.log(`  - ${r.id}: ${r.status || r.error}`));
    
    if (successful.length > 0) {
        const best = successful[0];
        const offset = parseInt(pageviewId) - parseInt(best.id);
        console.log(`\n🎯 PATTERN FOUND: pageview ID ${pageviewId} -> titleinfo ID ${best.id} (offset: ${offset})`);
    }
});