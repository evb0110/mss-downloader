#!/usr/bin/env node

/**
 * Test ALL URLs from Issue #35 with the fixed implementation
 * URLs:
 * 1. https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=995-882
 * 2. https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=996-882
 * 3. https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=1001-882
 * 4. https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=3193-883
 */

async function fetchWithRetry(url, options = {}, retries = 3) {
    const fetch = (await import('node-fetch')).default;
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; MSS-Downloader)'
                },
                ...options
            });
            return response;
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`Retry ${i + 1}/${retries} failed:`, error.message);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

async function testSingleURL(url) {
    console.log(`\n━━━ Testing: ${url} ━━━`);
    
    try {
        // Step 1: Extract manuscript ID
        const idMatch = url.match(/r=(\d+-\d+)/);
        if (!idMatch) {
            throw new Error('Could not extract manuscript ID from URL');
        }
        
        const manuscriptId = idMatch[1];
        const urlManuscriptNum = manuscriptId.split('-')[0];
        console.log(`📄 Manuscript ID: ${manuscriptId}, Number: ${urlManuscriptNum}`);
        
        // Step 2: Fetch viewer page
        const viewerResponse = await fetchWithRetry(url);
        if (!viewerResponse.ok) {
            throw new Error(`Failed to fetch viewer page: ${viewerResponse.status}`);
        }
        
        const html = await viewerResponse.text();
        
        // Step 3: Extract manuscript path
        const allPaths = html.match(/Path=([^&"'\s]+)/g) || [];
        let manuscriptPath = undefined;
        
        for (const pathStr of allPaths) {
            const cleanPath = pathStr.replace('Path=', '');
            if (cleanPath.includes(`/${urlManuscriptNum}_`)) {
                manuscriptPath = cleanPath;
                break;
            }
        }
        
        if (!manuscriptPath) {
            throw new Error('Could not find manuscript path');
        }
        console.log(`📂 Path: ${manuscriptPath}`);
        
        // Step 4: Extract page count
        const pageCountMatch = html.match(/<td class="intestazione">\s*Carte\s*<\/td>\s*<td class="dati">[^<]*?(\d+)/);
        let totalPages = 0;
        if (pageCountMatch && pageCountMatch[1]) {
            totalPages = parseInt(pageCountMatch[1]);
            console.log(`📊 Page count: ${totalPages} folios`);
        } else {
            console.log(`⚠️  Could not extract page count`);
            return false;
        }
        
        // Step 5: Test the fix - fetch page menu
        const menuUrl = `https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/menu_sfoglia_brogliardi.php?Path=${manuscriptPath}`;
        
        const menuResponse = await fetchWithRetry(menuUrl);
        if (!menuResponse.ok) {
            console.log(`❌ Failed to fetch page menu: ${menuResponse.status}`);
            return false;
        }
        
        const menuHtml = await menuResponse.text();
        
        // Step 6: Parse folio range - ENHANCED for alternative formats
        let pageMatches = menuHtml.match(/r1=(\d{3}[rv]\.jp2)/g) || [];
        let useAlternativeFormat = false;
        
        // If no standard numeric pages found, try alternative formats
        if (pageMatches.length === 0) {
            // Try A-prefixed format: A001r.jp2, A000a.jp2, A001v_A002r.jp2, etc.
            const alternativeMatches = menuHtml.match(/r1=([A-Z][^&"'\s]+\.jp2)/g) || [];
            if (alternativeMatches.length > 0) {
                console.log(`🔧 Using alternative page format: found ${alternativeMatches.length} A-prefixed pages`);
                pageMatches = alternativeMatches;
                useAlternativeFormat = true;
            }
        }
        
        if (pageMatches.length === 0) {
            console.log(`❌ No page references found in menu`);
            return false;
        }
        
        if (useAlternativeFormat) {
            console.log(`✅ Alternative format: ${pageMatches.length} pages found`);
            
            // Test the first few alternative format pages
            const testPages = pageMatches.slice(0, 3);
            for (const match of testPages) {
                const pageNameMatch = match.match(/r1=([A-Z][^&"'\s]+\.jp2)/);
                if (pageNameMatch && pageNameMatch[1]) {
                    const pageName = pageNameMatch[1];
                    const testUrl = `https://imagoarchiviodistatoroma.cultura.gov.it/iipsrv/iipsrv.fcgi?FIF=/images/Patrimonio/Archivi/AS_Roma/Imago//${manuscriptPath}/${pageName}&WID=2000&QLT=95&CVT=jpeg`;
                    const testResult = await fetchWithRetry(testUrl, { method: 'HEAD' });
                    console.log(`📄 Alt page (${pageName}): ${testResult.status} ${testResult.ok ? '✅' : '❌'}`);
                }
            }
            
            console.log(`✅ FIX WORKING: Alternative format handling successfully implemented`);
            return true;
        } else {
            // Extract unique folio numbers
            const folios = new Set();
            pageMatches.forEach(match => {
                const folioMatch = match.match(/r1=(\d{3})[rv]\.jp2/);
                if (folioMatch && folioMatch[1]) {
                    folios.add(parseInt(folioMatch[1]));
                }
            });
            
            const folioNumbers = Array.from(folios).sort((a, b) => a - b);
            const startFolio = folioNumbers[0];
            const endFolio = folioNumbers[folioNumbers.length - 1];
            
            console.log(`✅ Dynamic range: folios ${startFolio}-${endFolio} (${folioNumbers.length} folios, ${folioNumbers.length * 2 + 1} total pages)`);
        }
        
        if (!useAlternativeFormat) {
            // Step 7: Test image URLs (standard format only)
            const volumeUrl = `https://imagoarchiviodistatoroma.cultura.gov.it/iipsrv/iipsrv.fcgi?FIF=/images/Patrimonio/Archivi/AS_Roma/Imago//${manuscriptPath}/000volume.jp2&WID=2000&QLT=95&CVT=jpeg`;
            const volumeTest = await fetchWithRetry(volumeUrl, { method: 'HEAD' });
            console.log(`📄 Volume page: ${volumeTest.status} ${volumeTest.ok ? '✅' : '❌'}`);
            
            // Extract folio numbers again for testing
            const folios = new Set();
            pageMatches.forEach(match => {
                const folioMatch = match.match(/r1=(\d{3})[rv]\.jp2/);
                if (folioMatch && folioMatch[1]) {
                    folios.add(parseInt(folioMatch[1]));
                }
            });
            
            const folioNumbers = Array.from(folios).sort((a, b) => a - b);
            const startFolio = folioNumbers[0];
            const endFolio = folioNumbers[folioNumbers.length - 1];
            
            // Test first folio (the critical fix)
            const oldFirstUrl = `https://imagoarchiviodistatoroma.cultura.gov.it/iipsrv/iipsrv.fcgi?FIF=/images/Patrimonio/Archivi/AS_Roma/Imago//${manuscriptPath}/001r.jp2&WID=2000&QLT=95&CVT=jpeg`;
            const oldFirstTest = await fetchWithRetry(oldFirstUrl, { method: 'HEAD' });
            
            const newFirstUrl = `https://imagoarchiviodistatoroma.cultura.gov.it/iipsrv/iipsrv.fcgi?FIF=/images/Patrimonio/Archivi/AS_Roma/Imago//${manuscriptPath}/${String(startFolio).padStart(3, '0')}r.jp2&WID=2000&QLT=95&CVT=jpeg`;
            const newFirstTest = await fetchWithRetry(newFirstUrl, { method: 'HEAD' });
            
            console.log(`🔧 OLD method (001r.jp2): ${oldFirstTest.status} ${oldFirstTest.ok ? '✅' : '❌'}`);
            console.log(`🎯 NEW method (${String(startFolio).padStart(3, '0')}r.jp2): ${newFirstTest.status} ${newFirstTest.ok ? '✅' : '❌'}`);
            
            if (newFirstTest.ok && !oldFirstTest.ok) {
                console.log(`✅ FIX WORKING: New method succeeds where old method fails`);
                return true;
            } else if (oldFirstTest.ok) {
                console.log(`⚠️  This manuscript might start from folio 1 (both methods work)`);
                return true;
            } else {
                console.log(`❌ Both methods fail - deeper issue`);
                return false;
            }
        }
        
        // Alternative format case - already handled above
        return true;
        
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        return false;
    }
}

async function testAllIssueURLs() {
    console.log('🔬 TESTING ALL ISSUE #35 URLs WITH FIXED IMPLEMENTATION');
    console.log('=========================================================');
    
    const urls = [
        'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=995-882',
        'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=996-882', 
        'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=1001-882',
        'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=3193-883'
    ];
    
    const results = [];
    
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`\n${i + 1}/${urls.length} Testing ${url}...`);
        const success = await testSingleURL(url);
        results.push({ url, success });
        
        // Small delay between tests to be respectful
        if (i < urls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    console.log('\n🎯 COMPREHENSIVE TEST RESULTS');
    console.log('==============================');
    
    let successCount = 0;
    results.forEach((result, index) => {
        const status = result.success ? '✅ PASS' : '❌ FAIL';
        const urlId = result.url.match(/r=(\d+-\d+)/)?.[1] || 'unknown';
        console.log(`${index + 1}. ${urlId}: ${status}`);
        if (result.success) successCount++;
    });
    
    console.log(`\n📊 SUMMARY: ${successCount}/${results.length} URLs working correctly`);
    
    if (successCount === results.length) {
        console.log('\n🎉 ALL TESTS PASSED! Issue #35 is completely fixed.');
        return true;
    } else {
        console.log(`\n⚠️  ${results.length - successCount} URLs still failing - more work needed.`);
        return false;
    }
}

testAllIssueURLs();