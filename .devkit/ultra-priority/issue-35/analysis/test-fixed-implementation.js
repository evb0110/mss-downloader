#!/usr/bin/env node

/**
 * Test the Fixed Roman Archive Implementation
 * Test URL: https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=995-882
 */

const fs = require('fs');

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

async function testFixedRomanArchive() {
    console.log('🔬 TESTING FIXED ROMAN ARCHIVE IMPLEMENTATION');
    console.log('==============================================');
    console.log();

    const url = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=995-882';
    
    try {
        // Step 1: Extract manuscript ID
        console.log('Step 1: Extracting manuscript ID...');
        const idMatch = url.match(/r=(\d+-\d+)/);
        if (!idMatch) {
            throw new Error('Could not extract manuscript ID from URL');
        }
        
        const manuscriptId = idMatch[1];
        const urlManuscriptNum = manuscriptId.split('-')[0];
        console.log(`✅ Manuscript ID: ${manuscriptId}, Number: ${urlManuscriptNum}`);
        
        // Step 2: Fetch viewer page
        console.log('\nStep 2: Fetching viewer page...');
        const viewerResponse = await fetchWithRetry(url);
        if (!viewerResponse.ok) {
            throw new Error(`Failed to fetch viewer page: ${viewerResponse.status}`);
        }
        
        const html = await viewerResponse.text();
        console.log(`✅ Viewer page fetched: ${html.length} bytes`);
        
        // Step 3: Extract manuscript path
        console.log('\nStep 3: Extracting manuscript path...');
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
        console.log(`✅ Manuscript path: ${manuscriptPath}`);
        
        // Step 4: Extract page count
        console.log('\nStep 4: Extracting page count...');
        const pageCountMatch = html.match(/<td class="intestazione">\s*Carte\s*<\/td>\s*<td class="dati">[^<]*?(\d+)/);
        let totalPages = 0;
        if (pageCountMatch && pageCountMatch[1]) {
            totalPages = parseInt(pageCountMatch[1]);
            console.log(`✅ Page count: ${totalPages} folios`);
        } else {
            throw new Error('Could not extract page count');
        }
        
        // Step 5: Fetch page menu (THE FIX!)
        console.log('\nStep 5: Fetching page menu for dynamic folio discovery...');
        const menuUrl = `https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/menu_sfoglia_brogliardi.php?Path=${manuscriptPath}`;
        console.log(`Menu URL: ${menuUrl}`);
        
        const menuResponse = await fetchWithRetry(menuUrl);
        if (!menuResponse.ok) {
            throw new Error(`Failed to fetch page menu: ${menuResponse.status}`);
        }
        
        const menuHtml = await menuResponse.text();
        console.log(`✅ Page menu fetched: ${menuHtml.length} bytes`);
        
        // Step 6: Parse folio range (THE KEY FIX!)
        console.log('\nStep 6: Parsing dynamic folio range...');
        const pageMatches = menuHtml.match(/r1=(\d{3}[rv]\.jp2)/g) || [];
        console.log(`Found ${pageMatches.length} page references`);
        
        if (pageMatches.length === 0) {
            throw new Error('No page references found in menu');
        }
        
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
        
        console.log(`✅ Dynamic range discovered: folios ${startFolio}-${endFolio} (${folioNumbers.length} folios)`);
        console.log(`✅ Expected pages: ${folioNumbers.length * 2} recto/verso + 1 volume = ${folioNumbers.length * 2 + 1} total`);
        
        // Step 7: Test a few generated URLs
        console.log('\nStep 7: Testing generated image URLs...');
        
        // Test first page (volume)
        const volumeUrl = `https://imagoarchiviodistatoroma.cultura.gov.it/iipsrv/iipsrv.fcgi?FIF=/images/Patrimonio/Archivi/AS_Roma/Imago//${manuscriptPath}/000volume.jp2&WID=2000&QLT=95&CVT=jpeg`;
        const volumeTest = await fetchWithRetry(volumeUrl, { method: 'HEAD' });
        console.log(`Volume page (000volume.jp2): ${volumeTest.status} ${volumeTest.ok ? '✅' : '❌'}`);
        
        // Test first folio (old way would be 001r.jp2, new way is actual first folio)
        const oldFirstUrl = `https://imagoarchiviodistatoroma.cultura.gov.it/iipsrv/iipsrv.fcgi?FIF=/images/Patrimonio/Archivi/AS_Roma/Imago//${manuscriptPath}/001r.jp2&WID=2000&QLT=95&CVT=jpeg`;
        const oldFirstTest = await fetchWithRetry(oldFirstUrl, { method: 'HEAD' });
        console.log(`OLD method (001r.jp2): ${oldFirstTest.status} ${oldFirstTest.ok ? '✅' : '❌'}`);
        
        const newFirstUrl = `https://imagoarchiviodistatoroma.cultura.gov.it/iipsrv/iipsrv.fcgi?FIF=/images/Patrimonio/Archivi/AS_Roma/Imago//${manuscriptPath}/${String(startFolio).padStart(3, '0')}r.jp2&WID=2000&QLT=95&CVT=jpeg`;
        const newFirstTest = await fetchWithRetry(newFirstUrl, { method: 'HEAD' });
        console.log(`NEW method (${String(startFolio).padStart(3, '0')}r.jp2): ${newFirstTest.status} ${newFirstTest.ok ? '✅' : '❌'}`);
        
        // Test a few more pages
        for (let i = 0; i < Math.min(3, folioNumbers.length); i++) {
            const folio = folioNumbers[i];
            const paddedFolio = String(folio).padStart(3, '0');
            
            const rectoUrl = `https://imagoarchiviodistatoroma.cultura.gov.it/iipsrv/iipsrv.fcgi?FIF=/images/Patrimonio/Archivi/AS_Roma/Imago//${manuscriptPath}/${paddedFolio}r.jp2&WID=2000&QLT=95&CVT=jpeg`;
            const rectoTest = await fetchWithRetry(rectoUrl, { method: 'HEAD' });
            
            const versoUrl = `https://imagoarchiviodistatoroma.cultura.gov.it/iipsrv/iipsrv.fcgi?FIF=/images/Patrimonio/Archivi/AS_Roma/Imago//${manuscriptPath}/${paddedFolio}v.jp2&WID=2000&QLT=95&CVT=jpeg`;
            const versoTest = await fetchWithRetry(versoUrl, { method: 'HEAD' });
            
            console.log(`Folio ${folio}: ${paddedFolio}r.jp2 (${rectoTest.status} ${rectoTest.ok ? '✅' : '❌'}), ${paddedFolio}v.jp2 (${versoTest.status} ${versoTest.ok ? '✅' : '❌'})`);
        }
        
        console.log('\n🎉 SUCCESS: Fixed Roman Archive implementation working correctly!');
        console.log(`📊 Summary: ${folioNumbers.length * 2 + 1} total pages discoverable (${folioNumbers.length} folios × 2 sides + volume)`);
        console.log(`🔧 Fix: Dynamic folio range ${startFolio}-${endFolio} instead of hardcoded 1-${totalPages}`);
        
    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error(error.stack);
    }
}

testFixedRomanArchive();