#!/usr/bin/env node

/**
 * Roman Archive Debug Script - Test the parsing logic step by step
 * Target URL: https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=995-882
 */

const fs = require('fs');

// Read the actual HTML we downloaded
const html = fs.readFileSync('/Users/evb/WebstormProjects/mss-downloader/.devkit/ultra-priority/issue-35/test-page.html', 'utf8');

console.log('🔬 ROMAN ARCHIVE DEBUG ANALYSIS');
console.log('================================');
console.log();

// Step 1: Extract manuscript ID 
const url = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=995-882';
const idMatch = url.match(/r=(\d+-\d+)/);
if (idMatch) {
    const manuscriptId = idMatch[1];
    console.log(`✅ Step 1: Manuscript ID extracted: ${manuscriptId}`);
    
    // Step 2: Extract manuscript number for path matching
    const urlManuscriptNum = manuscriptId.split('-')[0];
    console.log(`✅ Step 2: Manuscript number for matching: ${urlManuscriptNum}`);
    
    // Step 3: Look for Path= patterns in HTML
    console.log('\n🔍 Step 3: Looking for Path= patterns...');
    const allPaths = html.match(/Path=([^&"'\s]+)/g) || [];
    console.log(`Found ${allPaths.length} Path patterns:`);
    allPaths.forEach((path, index) => {
        const cleanPath = path.replace('Path=', '');
        const matches = cleanPath.includes(`/${urlManuscriptNum}_`);
        console.log(`  ${index + 1}. ${cleanPath} ${matches ? '✅ MATCHES' : '❌ no match'}`);
    });
    
    // Step 4: Find the matching path
    let manuscriptPath = undefined;
    for (const pathStr of allPaths) {
        const cleanPath = pathStr.replace('Path=', '');
        if (cleanPath.includes(`/${urlManuscriptNum}_`)) {
            manuscriptPath = cleanPath;
            break;
        }
    }
    
    if (manuscriptPath) {
        console.log(`\n✅ Step 4: Found matching path: ${manuscriptPath}`);
    } else {
        console.log(`\n❌ Step 4: NO MATCHING PATH FOUND!`);
        
        // Fallback: try image sources
        console.log('\n🔍 Fallback: Looking in image sources...');
        const imgMatches = html.match(/\/preziosi\/[^/]+\/[^/]+\/[^"'\s]+\.jp2/g) || [];
        console.log(`Found ${imgMatches.length} image references:`);
        imgMatches.forEach((img, index) => {
            const matches = img.includes(`/${urlManuscriptNum}_`);
            console.log(`  ${index + 1}. ${img} ${matches ? '✅ MATCHES' : '❌ no match'}`);
        });
        
        for (const imgPath of imgMatches) {
            if (imgPath.includes(`/${urlManuscriptNum}_`)) {
                const pathMatch = imgPath.match(/\/(preziosi\/[^/]+\/[^/]+)\//);
                if (pathMatch && pathMatch[1]) {
                    manuscriptPath = pathMatch[1];
                    console.log(`\n✅ Found path from image: ${manuscriptPath}`);
                    break;
                }
            }
        }
    }
    
    // Step 5: Extract page count from HTML
    console.log('\n🔍 Step 5: Looking for page count...');
    const pageCountMatch = html.match(/<td class="intestazione">\s*Carte\s*<\/td>\s*<td class="dati">[^<]*?(\d+)/);
    if (pageCountMatch && pageCountMatch[1]) {
        const totalPages = parseInt(pageCountMatch[1]);
        console.log(`✅ Found page count: ${totalPages} pages`);
        
        // Step 6: Extract first page name
        console.log('\n🔍 Step 6: Looking for first page name...');
        const firstPageMatch = html.match(/r1?=([^&"'\s]+\.jp2)/);
        if (firstPageMatch && firstPageMatch[1]) {
            const firstPageName = firstPageMatch[1];
            console.log(`✅ Found first page name: ${firstPageName}`);
            
            if (manuscriptPath) {
                // Step 7: Generate test URLs
                console.log('\n🔧 Step 7: Generated image URLs:');
                
                // First page (volume)
                const firstPageUrl = `https://imagoarchiviodistatoroma.cultura.gov.it/iipsrv/iipsrv.fcgi?FIF=/images/Patrimonio/Archivi/AS_Roma/Imago//${manuscriptPath}/${firstPageName}&WID=2000&QLT=95&CVT=jpeg`;
                console.log(`First page: ${firstPageUrl}`);
                
                // Test a few regular pages
                for (let i = 1; i <= 3; i++) {
                    const padded = String(i).padStart(3, '0');
                    const rectoUrl = `https://imagoarchiviodistatoroma.cultura.gov.it/iipsrv/iipsrv.fcgi?FIF=/images/Patrimonio/Archivi/AS_Roma/Imago//${manuscriptPath}/${padded}r.jp2&WID=2000&QLT=95&CVT=jpeg`;
                    const versoUrl = `https://imagoarchiviodistatoroma.cultura.gov.it/iipsrv/iipsrv.fcgi?FIF=/images/Patrimonio/Archivi/AS_Roma/Imago//${manuscriptPath}/${padded}v.jp2&WID=2000&QLT=95&CVT=jpeg`;
                    console.log(`Page ${i}r: ${rectoUrl}`);
                    console.log(`Page ${i}v: ${versoUrl}`);
                }
            } else {
                console.log(`\n❌ CRITICAL ERROR: No manuscript path found - cannot generate URLs`);
            }
        } else {
            console.log(`\n❌ Could not find first page name`);
        }
    } else {
        console.log(`\n❌ Could not find page count`);
        console.log('Available "Carte" fields in HTML:');
        const carteMatches = html.match(/<td class="intestazione">.*?Carte.*?<\/td>\s*<td class="dati">.*?<\/td>/g) || [];
        carteMatches.forEach((match, index) => {
            console.log(`  ${index + 1}. ${match}`);
        });
    }
    
} else {
    console.log(`❌ Could not extract manuscript ID from URL: ${url}`);
}

console.log('\n=== DEBUG COMPLETE ===');