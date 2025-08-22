#!/usr/bin/env bun

/**
 * Test Florence ContentDM ID gaps and implement gap-aware filtering
 * Some child page IDs return 501 "Not Implemented" - need to filter these out
 */

async function testFlorenceIdGaps() {
    console.log('🔍 Testing Florence ContentDM ID sequence gaps...\n');
    
    // Known manuscript: Plut.16.39 with IDs 217706-217922
    const baseUrl = 'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:';
    const startId = 217706;
    const endId = 217922;
    const totalRange = endId - startId + 1;
    
    console.log(`Testing ID range: ${startId} to ${endId} (${totalRange} IDs)`);
    
    let validIds: number[] = [];
    let invalidIds: number[] = [];
    let testCount = 0;
    const maxTests = 50; // Sample testing to avoid overwhelming server
    
    // Sample test every ~4-5 IDs across the range
    const step = Math.ceil(totalRange / maxTests);
    
    for (let i = 0; i < maxTests; i++) {
        const testId = startId + (i * step);
        if (testId > endId) break;
        
        testCount++;
        const testUrl = `${baseUrl}${testId}/info.json`;
        
        try {
            const response = await fetch(testUrl, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/json,*/*;q=0.8',
                    'Referer': 'https://cdm21059.contentdm.oclc.org/',
                }
            });
            
            if (response.ok) {
                validIds.push(testId);
                console.log(`✅ ID ${testId}: ${response.status} ${response.statusText}`);
            } else {
                invalidIds.push(testId);
                console.log(`❌ ID ${testId}: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            invalidIds.push(testId);
            console.log(`❌ ID ${testId}: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const validPercent = Math.round((validIds.length / testCount) * 100);
    const invalidPercent = Math.round((invalidIds.length / testCount) * 100);
    
    console.log(`\n📊 Test Results (${testCount} samples):`);
    console.log(`✅ Valid IDs: ${validIds.length} (${validPercent}%)`);
    console.log(`❌ Invalid IDs: ${invalidIds.length} (${invalidPercent}%)`);
    
    console.log(`\n🔍 Gap Pattern Analysis:`);
    console.log(`First 5 valid IDs: ${validIds.slice(0, 5).join(', ')}`);
    console.log(`Last 5 valid IDs: ${validIds.slice(-5).join(', ')}`);
    console.log(`First 5 invalid IDs: ${invalidIds.slice(0, 5).join(', ')}`);
    
    // Test specific problematic ID from logs
    console.log(`\n🎯 Testing specific problematic ID: 217918`);
    const problemId = 217918;
    const problemUrl = `${baseUrl}${problemId}/info.json`;
    
    try {
        const response = await fetch(problemUrl, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json,*/*;q=0.8',
                'Referer': 'https://cdm21059.contentdm.oclc.org/',
            }
        });
        
        console.log(`ID ${problemId} status: ${response.status} ${response.statusText}`);
        
        if (response.status === 501) {
            console.log(`✅ CONFIRMED: ID ${problemId} returns 501 Not Implemented (gap in sequence)`);
        }
    } catch (error) {
        console.log(`ID ${problemId} error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log(`\n💡 Solution Required:`);
    console.log(`1. Pre-validate child page IDs before including in pageLinks`);
    console.log(`2. Filter out IDs that return 501 "Not Implemented"`);
    console.log(`3. Keep only valid, accessible page IDs`);
    console.log(`4. This will prevent download failures on gap pages`);
    
    return {
        validPercent,
        invalidPercent,
        needsFiltering: invalidPercent > 10
    };
}

testFlorenceIdGaps().then(results => {
    if (results.needsFiltering) {
        console.log(`\n🚨 ACTION REQUIRED: ${results.invalidPercent}% invalid IDs need filtering`);
        console.log(`Implement pre-validation in FlorenceLoader to skip gap pages`);
        process.exit(1);
    } else {
        console.log(`\n✅ Gap percentage acceptable: ${results.invalidPercent}%`);
        process.exit(0);
    }
});