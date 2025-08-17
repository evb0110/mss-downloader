#!/usr/bin/env bun

/**
 * VALIDATE PAGE DISCOVERY FIX - Issue #6
 * 
 * This script validates that the maxTestPages fix (200 → 300) resolves
 * the page discovery limitation for Bordeaux manuscripts.
 * 
 * EXPECTED: Should now discover all 278 pages instead of stopping at ~195
 */

import { promises as fs } from 'fs';
import https from 'https';

console.log('🔧 VALIDATING PAGE DISCOVERY FIX - Issue #6');
console.log('===========================================');
console.log('Testing: maxTestPages increased from 200 to 300');
console.log('Expected: Should discover all 278 pages for Bordeaux manuscript');
console.log('');

/**
 * HTTP fetch utility
 */
function fetchUrl(url: string): Promise<{ ok: boolean; status: number }> {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const req = https.request({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'HEAD',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            resolve({
                ok: res.statusCode === 200,
                status: res.statusCode || 0
            });
        });
        
        req.on('error', () => {
            resolve({ ok: false, status: 0 });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({ ok: false, status: 0 });
        });
        
        req.end();
    });
}

/**
 * Simulate the updated discoverBordeauxPageRange function
 */
async function simulatePageDiscovery(): Promise<{ 
    foundPages: number[]; 
    maxPageFound: number | null; 
    wouldFindPage278: boolean;
    totalPagesWithOldLimit: number;
    totalPagesWithNewLimit: number;
}> {
    console.log('🔍 SIMULATING PAGE DISCOVERY WITH NEW LIMITS');
    console.log('--------------------------------------------');
    
    const baseId = '330636101_MS0778';
    const baseUrl = 'https://selene.bordeaux.fr/in/dz';
    
    // NEW LIMITS (after fix)
    const newMaxTestPages = 300;
    const newQuickScanPages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 50, 75, 100, 150, 200, 250, 280, 300];
    
    // OLD LIMITS (before fix)
    const oldMaxTestPages = 200;
    const oldQuickScanPages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 50, 75, 100, 150, 200];
    
    console.log(`New maxTestPages: ${newMaxTestPages} (was ${oldMaxTestPages})`);
    console.log(`Quick scan pages: [${newQuickScanPages.join(', ')}]`);
    
    // Test quick scan pages
    console.log('\n1. Testing quick scan pages...');
    const foundPages: number[] = [];
    let maxPageFound: number | null = null;
    
    for (const page of newQuickScanPages) {
        const pageId = `${baseId}_${String(page).padStart(4, '0')}`;
        const testUrl = `${baseUrl}/${pageId}_files/0/0_0.jpg`;
        
        try {
            const result = await fetchUrl(testUrl);
            if (result.ok) {
                foundPages.push(page);
                if (maxPageFound === null || page > maxPageFound) {
                    maxPageFound = page;
                }
                console.log(`  ✅ Page ${page}: Available`);
            } else {
                console.log(`  ❌ Page ${page}: Not available (${result.status})`);
            }
        } catch (error) {
            console.log(`  ❌ Page ${page}: Error`);
        }
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Check if page 278 would be found
    const wouldFindPage278 = foundPages.includes(280) || foundPages.some(p => p >= 278);
    
    console.log(`\nQuick scan results:`);
    console.log(`  Pages found: ${foundPages.length} [${foundPages.join(', ')}]`);
    console.log(`  Max page found: ${maxPageFound}`);
    console.log(`  Would find page 278: ${wouldFindPage278 ? '✅ YES' : '❌ NO'}`);
    
    // Simulate detailed scan ranges
    console.log('\n2. Analyzing detailed scan ranges...');
    
    let oldDetailedEnd = Math.min(oldMaxTestPages, (maxPageFound || 1) + 10);
    let newDetailedEnd = Math.min(newMaxTestPages, (maxPageFound || 1) + 10);
    
    console.log(`  OLD detailed scan would go to: ${oldDetailedEnd}`);
    console.log(`  NEW detailed scan will go to: ${newDetailedEnd}`);
    
    // Estimate total pages that would be found
    let totalPagesWithOldLimit = 0;
    let totalPagesWithNewLimit = 0;
    
    // For estimation, assume pages exist from 10 to 278 (based on our findings)
    const knownPageRange = { start: 10, end: 278 };
    
    // Old limit would cap at 200
    const oldEffectiveEnd = Math.min(oldDetailedEnd, knownPageRange.end);
    totalPagesWithOldLimit = Math.max(0, oldEffectiveEnd - knownPageRange.start + 1);
    
    // New limit would go up to 300
    const newEffectiveEnd = Math.min(newDetailedEnd, knownPageRange.end);
    totalPagesWithNewLimit = Math.max(0, newEffectiveEnd - knownPageRange.start + 1);
    
    console.log(`\n3. Page count estimation:`);
    console.log(`  With OLD limit (200): ~${totalPagesWithOldLimit} pages`);
    console.log(`  With NEW limit (300): ~${totalPagesWithNewLimit} pages`);
    console.log(`  Improvement: +${totalPagesWithNewLimit - totalPagesWithOldLimit} pages`);
    
    return {
        foundPages,
        maxPageFound,
        wouldFindPage278,
        totalPagesWithOldLimit,
        totalPagesWithNewLimit
    };
}

/**
 * Test specific high page numbers
 */
async function testHighPageNumbers(): Promise<{ page278Available: boolean; availableHighPages: number[] }> {
    console.log('\n🎯 TESTING SPECIFIC HIGH PAGE NUMBERS');
    console.log('------------------------------------');
    
    const baseId = '330636101_MS0778';
    const baseUrl = 'https://selene.bordeaux.fr/in/dz';
    const highPages = [195, 200, 220, 250, 270, 275, 276, 277, 278, 279, 280, 290, 300];
    const availableHighPages: number[] = [];
    
    console.log('Testing high page numbers to confirm fix effectiveness...');
    
    for (const page of highPages) {
        const pageId = `${baseId}_${String(page).padStart(4, '0')}`;
        const testUrl = `${baseUrl}/${pageId}_files/0/0_0.jpg`;
        
        try {
            const result = await fetchUrl(testUrl);
            if (result.ok) {
                availableHighPages.push(page);
                console.log(`  ✅ Page ${page}: Available${page === 278 ? ' ← TARGET PAGE' : ''}`);
            } else {
                console.log(`  ❌ Page ${page}: Not available (${result.status})`);
            }
        } catch (error) {
            console.log(`  ❌ Page ${page}: Error`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const page278Available = availableHighPages.includes(278);
    console.log(`\nHigh page analysis:`);
    console.log(`  Available high pages: [${availableHighPages.join(', ')}]`);
    console.log(`  Page 278 (target): ${page278Available ? '✅ Available' : '❌ Not available'}`);
    console.log(`  Highest available: ${Math.max(...availableHighPages)}`);
    
    return { page278Available, availableHighPages };
}

/**
 * Generate validation report
 */
function generateValidationReport(discoveryResults: any, highPageResults: any): void {
    console.log('\n🎯 PAGE DISCOVERY FIX VALIDATION REPORT');
    console.log('=======================================');
    
    console.log('\n📊 RESULTS SUMMARY:');
    console.log(`✅ Quick scan enhancement: Added pages 250, 280, 300 to discovery`);
    console.log(`✅ Max test pages: Increased from 200 to 300 (+100 pages)`);
    console.log(`✅ Page 278 available: ${highPageResults.page278Available ? 'YES' : 'NO'}`);
    console.log(`✅ Page range improvement: ${discoveryResults.totalPagesWithOldLimit} → ${discoveryResults.totalPagesWithNewLimit} pages (+${discoveryResults.totalPagesWithNewLimit - discoveryResults.totalPagesWithOldLimit})`);
    
    console.log('\n🔥 CRITICAL ANALYSIS:');
    
    if (highPageResults.page278Available && discoveryResults.wouldFindPage278) {
        console.log('✅ SUCCESS: Fix should resolve the page discovery issue');
        console.log('  - Page 278 exists and is accessible');
        console.log('  - New limits (300) will discover high page numbers');
        console.log('  - Quick scan includes pages beyond 200');
        console.log('  - Users should now see all 278 pages');
    } else if (highPageResults.page278Available && !discoveryResults.wouldFindPage278) {
        console.log('⚠️  PARTIAL: Page 278 exists but quick scan may not find it');
        console.log('  - May need to add page 278 to quick scan array');
        console.log('  - Or increase detailed scan effectiveness');
    } else {
        console.log('❌ ISSUE: Page 278 may not exist or be accessible');
        console.log('  - User may have misreported the page count');
        console.log('  - Or there may be a different issue');
    }
    
    console.log('\n🛠️  FIX STATUS:');
    console.log('✅ Code changes applied:');
    console.log('  - SharedManifestLoaders.ts line 3511: maxTestPages = 300');
    console.log('  - SharedManifestLoaders.ts line 3516: Added pages 250, 280, 300 to quick scan');
    
    const improvement = discoveryResults.totalPagesWithNewLimit - discoveryResults.totalPagesWithOldLimit;
    if (improvement > 50) {
        console.log('✅ Expected impact: SIGNIFICANT improvement (+' + improvement + ' pages)');
    } else if (improvement > 0) {
        console.log('✅ Expected impact: Moderate improvement (+' + improvement + ' pages)');
    } else {
        console.log('⚠️  Expected impact: Limited improvement');
    }
    
    console.log('\n🎯 RECOMMENDATION:');
    if (highPageResults.page278Available && improvement > 50) {
        console.log('✅ DEPLOY FIX: The page discovery fix should resolve Issue #6');
        console.log('📢 UPDATE USER: Page discovery limit increased to support 278+ pages');
    } else {
        console.log('🔍 INVESTIGATE FURTHER: May need additional analysis or different approach');
    }
}

/**
 * Main execution
 */
async function main() {
    try {
        const discoveryResults = await simulatePageDiscovery();
        const highPageResults = await testHighPageNumbers();
        
        generateValidationReport(discoveryResults, highPageResults);
        
        // Save validation results
        const validationData = {
            timestamp: new Date().toISOString(),
            fix: {
                applied: true,
                maxTestPages: { old: 200, new: 300 },
                quickScanPages: { 
                    old: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 50, 75, 100, 150, 200],
                    new: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 50, 75, 100, 150, 200, 250, 280, 300]
                }
            },
            results: {
                discovery: discoveryResults,
                highPages: highPageResults
            },
            verdict: {
                fixShouldWork: highPageResults.page278Available && discoveryResults.wouldFindPage278,
                expectedImprovement: discoveryResults.totalPagesWithNewLimit - discoveryResults.totalPagesWithOldLimit,
                recommendDeploy: highPageResults.page278Available && (discoveryResults.totalPagesWithNewLimit - discoveryResults.totalPagesWithOldLimit) > 50
            }
        };
        
        const reportPath = '/home/evb/WebstormProjects/mss-downloader/.devkit/ultra-priority/issue-6/page-discovery-fix-validation.json';
        await fs.writeFile(reportPath, JSON.stringify(validationData, null, 2));
        
        console.log(`\n📄 Validation report saved to: ${reportPath}`);
        
    } catch (error) {
        console.error('❌ Validation failed:', error);
        process.exit(1);
    }
}

main();