#!/usr/bin/env bun

/**
 * ULTRATHINK DEEP ANALYSIS for Issue #6 - Bordeaux Library
 * 
 * MISSION: Find the REAL root cause that has evaded 10+ "fixes"
 * USER PROBLEM: Only sees 195 of 278 pages + Can't download + RangeError: Invalid array length
 * LATEST ERROR: Canvas.createCanvas() line 273 in DirectTileProcessor.ts
 * 
 * This script will:
 * 1. Test actual Bordeaux implementation step by step
 * 2. Identify where page counting fails (why 195 not 278?)
 * 3. Find the Canvas memory allocation issue
 * 4. Provide exact code locations for fixes
 */

import { promises as fs } from 'fs';
import https from 'https';

console.log('🔥 ULTRATHINK DEEP ANALYSIS - Issue #6 Bordeaux Library');
console.log('========================================================');
console.log('USER URL: https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778');
console.log('USER REPORTS: Only 195/278 pages visible + Cannot download + RangeError');
console.log('LATEST ERROR: Canvas.createCanvas() memory allocation failure');
console.log('PREVIOUS FIXES: 10+ attempts failed - need to find REAL root cause');
console.log('');

interface AnalysisResult {
    step: string;
    success: boolean;
    details: string;
    issues?: string[];
    recommendations?: string[];
}

const results: AnalysisResult[] = [];

/**
 * Utility to make HTTP requests
 */
function fetchUrl(url: string, timeout = 10000): Promise<{ ok: boolean; status: number; text?: string; error?: string }> {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const req = https.request({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'HEAD', // Use HEAD to test existence without downloading content
            timeout: timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            resolve({
                ok: res.statusCode === 200,
                status: res.statusCode || 0
            });
        });
        
        req.on('error', (error) => {
            resolve({
                ok: false,
                status: 0,
                error: error.message
            });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({
                ok: false,
                status: 0,
                error: 'Request timeout'
            });
        });
        
        req.end();
    });
}

/**
 * STEP 1: Test URL Pattern Matching
 */
async function step1_testUrlPatternMatching(): Promise<AnalysisResult> {
    console.log('STEP 1: Testing URL Pattern Matching...');
    
    const userUrl = 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778';
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Test Bordeaux detection from EnhancedManuscriptDownloaderService.ts line 983
    const bordeauxDetected = userUrl.includes('manuscrits.bordeaux.fr') || userUrl.includes('selene.bordeaux.fr');
    console.log(`  Bordeaux detection: ${bordeauxDetected ? '✅ PASS' : '❌ FAIL'}`);
    
    if (!bordeauxDetected) {
        issues.push('URL pattern matching failed in detectLibrary()');
        recommendations.push('Fix URL detection in EnhancedManuscriptDownloaderService.ts line 983');
    }
    
    // Test ARK pattern from getBordeauxManifest
    const publicMatch = userUrl.match(/ark:\/\d+\/([^/]+)(?:\/f(\d+))?\/?/);
    if (publicMatch) {
        console.log(`  ARK pattern match: ✅ PASS`);
        console.log(`    - Public ID: ${publicMatch[1]}`);
        console.log(`    - Page: ${publicMatch[2] || 'not specified'}`);
    } else {
        console.log(`  ARK pattern match: ❌ FAIL`);
        issues.push('ARK pattern matching failed in getBordeauxManifest()');
        recommendations.push('Fix regex in SharedManifestLoaders.ts line 3624');
    }
    
    return {
        step: 'URL Pattern Matching',
        success: bordeauxDetected && publicMatch !== null,
        details: `Bordeaux detection: ${bordeauxDetected}, ARK pattern: ${publicMatch !== null}`,
        issues,
        recommendations
    };
}

/**
 * STEP 2: Test Page Discovery Algorithm
 * This is WHERE THE 195 vs 278 PAGE PROBLEM LIKELY EXISTS
 */
async function step2_testPageDiscovery(): Promise<AnalysisResult> {
    console.log('\nSTEP 2: Testing Page Discovery Algorithm...');
    console.log('This is likely where the 195 vs 278 page discrepancy occurs!');
    
    const baseId = '330636101_MS0778'; // From known mappings in SharedManifestLoaders.ts
    const baseUrl = 'https://selene.bordeaux.fr/in/dz';
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Test the discovery algorithm from discoverBordeauxPageRange()
    console.log(`  Testing with baseId: ${baseId}`);
    
    // Quick scan pages (from SharedManifestLoaders.ts line 3515)
    const quickScanPages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 50, 75, 100, 150, 200, 250, 278];
    let foundPages: number[] = [];
    let minFound: number | null = null;
    let maxFound: number | null = null;
    
    console.log('  Quick scan for page availability...');
    for (const page of quickScanPages) {
        const pageId = `${baseId}_${String(page).padStart(4, '0')}`;
        const testUrl = `${baseUrl}/${pageId}_files/0/0_0.jpg`;
        
        try {
            const result = await fetchUrl(testUrl);
            if (result.ok) {
                foundPages.push(page);
                if (minFound === null || page < minFound) minFound = page;
                if (maxFound === null || page > maxFound) maxFound = page;
                console.log(`    ✅ Page ${page}: Available`);
            } else {
                console.log(`    ❌ Page ${page}: Not available (${result.status})`);
            }
        } catch (error) {
            console.log(`    ❌ Page ${page}: Error - ${error}`);
        }
        
        // Small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`  Quick scan results: ${foundPages.length} pages found`);
    console.log(`  Page range: ${minFound} to ${maxFound}`);
    console.log(`  Found pages: [${foundPages.join(', ')}]`);
    
    // Check if we're hitting the maxTestPages limit (line 3511)
    const maxTestPages = 200; // From SharedManifestLoaders.ts
    if (maxFound && maxFound >= maxTestPages) {
        issues.push(`Page discovery limited to ${maxTestPages} pages, but manuscript may have 278 pages`);
        recommendations.push(`Increase maxTestPages in SharedManifestLoaders.ts line 3511 from 200 to at least 300`);
        console.log(`  🚨 CRITICAL: Max test limit (${maxTestPages}) reached! This explains why only 195 pages found instead of 278!`);
    }
    
    // Test if page 278 specifically exists
    console.log('\n  Testing specific high page numbers...');
    const highPages = [195, 200, 250, 278];
    for (const page of highPages) {
        const pageId = `${baseId}_${String(page).padStart(4, '0')}`;
        const testUrl = `${baseUrl}/${pageId}_files/0/0_0.jpg`;
        
        try {
            const result = await fetchUrl(testUrl);
            console.log(`    Page ${page}: ${result.ok ? '✅ Available' : '❌ Not available'} (${result.status})`);
            if (result.ok && page === 278) {
                issues.push('Page 278 exists but discovery algorithm stops at 200');
                recommendations.push('Page discovery algorithm needs to be extended beyond 200 pages');
            }
        } catch (error) {
            console.log(`    Page ${page}: ❌ Error - ${error}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return {
        step: 'Page Discovery Algorithm',
        success: foundPages.length > 0,
        details: `Found ${foundPages.length} pages (range: ${minFound}-${maxFound})`,
        issues,
        recommendations
    };
}

/**
 * STEP 3: Test Canvas Memory Allocation Issue
 */
async function step3_testCanvasMemoryIssue(): Promise<AnalysisResult> {
    console.log('\nSTEP 3: Testing Canvas Memory Allocation Issue...');
    console.log('Analyzing the RangeError: Invalid array length in DirectTileProcessor.ts');
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Simulate the problematic dimensions that would cause RangeError
    // Based on DZI high-resolution tiles
    const problematicScenarios = [
        { width: 20000, height: 30000, level: 13, description: 'Typical Bordeaux high-res DZI' },
        { width: 25600, height: 38400, level: 14, description: 'Maximum resolution DZI' },
        { width: 16384, height: 16384, level: 12, description: 'Edge case square' }
    ];
    
    for (const scenario of problematicScenarios) {
        console.log(`  Testing scenario: ${scenario.description}`);
        console.log(`    Dimensions: ${scenario.width}x${scenario.height}`);
        
        // Calculate memory requirements
        const pixelCount = scenario.width * scenario.height;
        const estimatedMemory = pixelCount * 4; // 4 bytes per RGBA pixel
        const memoryGB = estimatedMemory / (1024 * 1024 * 1024);
        
        console.log(`    Pixel count: ${pixelCount.toLocaleString()}`);
        console.log(`    Memory needed: ${memoryGB.toFixed(2)} GB`);
        
        // JavaScript array size limit is approximately 1GB
        const MAX_SAFE_MEMORY = 1024 * 1024 * 1024; // 1GB
        if (estimatedMemory > MAX_SAFE_MEMORY) {
            console.log(`    🚨 CRITICAL: Exceeds 1GB limit! This WILL cause RangeError: Invalid array length`);
            issues.push(`Canvas ${scenario.width}x${scenario.height} requires ${memoryGB.toFixed(2)}GB > 1GB JavaScript limit`);
        } else {
            console.log(`    ✅ Within safe memory limits`);
        }
        
        // Test the current fix from DirectTileProcessor.ts lines 273-282
        const MAX_CANVAS_SIZE = 16384; // Current fix value
        const safeWidth = Math.min(scenario.width, MAX_CANVAS_SIZE);
        const safeHeight = Math.min(scenario.height, MAX_CANVAS_SIZE);
        
        console.log(`    Current fix result: ${safeWidth}x${safeHeight}`);
        
        if (safeWidth !== scenario.width || safeHeight !== scenario.height) {
            console.log(`    ✅ Current fix prevents RangeError`);
            console.log(`    ⚠️  But image quality reduced from ${scenario.width}x${scenario.height} to ${safeWidth}x${safeHeight}`);
        }
    }
    
    // Check if the issue exists in the current code
    try {
        const processorCode = await fs.readFile('/home/evb/WebstormProjects/mss-downloader/src/main/services/DirectTileProcessor.ts', 'utf8');
        
        if (processorCode.includes('MAX_CANVAS_SIZE') && processorCode.includes('prevent RangeError')) {
            console.log('  ✅ Canvas safety fix is present in current code');
        } else {
            console.log('  ❌ Canvas safety fix is missing');
            issues.push('Canvas safety fix not implemented in DirectTileProcessor.ts');
            recommendations.push('Add MAX_CANVAS_SIZE limit in DirectTileProcessor.ts line 273');
        }
        
        if (processorCode.includes('MAX_SAFE_MEMORY') && processorCode.includes('memory validation')) {
            console.log('  ✅ Memory validation is present');
        } else {
            console.log('  ❌ Memory validation is missing');
            issues.push('Memory validation missing during dimension calculation');
            recommendations.push('Add memory validation in DirectTileProcessor.ts lines 152-162');
        }
    } catch (error) {
        issues.push(`Cannot read DirectTileProcessor.ts: ${error}`);
    }
    
    return {
        step: 'Canvas Memory Allocation',
        success: issues.length === 0,
        details: 'Memory allocation and canvas size limits analysis',
        issues,
        recommendations
    };
}

/**
 * STEP 4: Test Integration Between Components
 */
async function step4_testIntegration(): Promise<AnalysisResult> {
    console.log('\nSTEP 4: Testing Integration Between Components...');
    console.log('Analyzing how getBordeauxManifest() integrates with DirectTileProcessor');
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Test the data flow:
    // 1. URL detection -> 2. getBordeauxManifest() -> 3. DirectTileProcessor.processPage()
    
    console.log('  1. EnhancedManuscriptDownloaderService.ts line 983: Bordeaux detection');
    console.log('  2. EnhancedManuscriptDownloaderService.ts line 1934: getBordeauxManifest() call');
    console.log('  3. SharedManifestLoaders.ts line 3614: getBordeauxManifest() implementation');
    console.log('  4. EnhancedManuscriptDownloaderService.ts line 2795: DirectTileProcessor usage');
    
    // Check if tileConfig is properly passed
    console.log('  Checking tileConfig integration...');
    
    try {
        const enhancedServiceCode = await fs.readFile('/home/evb/WebstormProjects/mss-downloader/src/main/services/EnhancedManuscriptDownloaderService.ts', 'utf8');
        
        // Check line 2591: Bordeaux tileConfig validation
        if (enhancedServiceCode.includes('Bordeaux manuscript requires tileConfig but none provided')) {
            console.log('    ✅ TileConfig validation present');
        } else {
            console.log('    ❌ TileConfig validation missing');
            issues.push('TileConfig validation missing for Bordeaux manuscripts');
        }
        
        // Check line 2799: DirectTileProcessor integration
        if (enhancedServiceCode.includes('[Bordeaux] Processing page') && enhancedServiceCode.includes('DirectTileProcessor')) {
            console.log('    ✅ DirectTileProcessor integration present');
        } else {
            console.log('    ❌ DirectTileProcessor integration missing');
            issues.push('DirectTileProcessor not properly integrated for Bordeaux');
        }
        
        // Check if baseId is passed correctly
        if (enhancedServiceCode.includes("tileConfig['baseId']")) {
            console.log('    ✅ BaseId extraction present');
        } else {
            console.log('    ❌ BaseId extraction missing');
            issues.push('BaseId not properly extracted from tileConfig');
            recommendations.push('Fix baseId extraction in EnhancedManuscriptDownloaderService.ts line 2831');
        }
        
    } catch (error) {
        issues.push(`Cannot read EnhancedManuscriptDownloaderService.ts: ${error}`);
    }
    
    return {
        step: 'Component Integration',
        success: issues.length === 0,
        details: 'Integration between getBordeauxManifest and DirectTileProcessor',
        issues,
        recommendations
    };
}

/**
 * STEP 5: Generate Final Analysis Report
 */
function step5_generateReport(): void {
    console.log('\n🎯 ULTRATHINK ANALYSIS COMPLETE');
    console.log('================================');
    
    console.log('\n📊 SUMMARY OF FINDINGS:');
    results.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.step}: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   ${result.details}`);
        
        if (result.issues && result.issues.length > 0) {
            console.log('   🚨 ISSUES FOUND:');
            result.issues.forEach(issue => console.log(`     - ${issue}`));
        }
        
        if (result.recommendations && result.recommendations.length > 0) {
            console.log('   💡 RECOMMENDATIONS:');
            result.recommendations.forEach(rec => console.log(`     - ${rec}`));
        }
    });
    
    // Critical findings analysis
    const allIssues = results.flatMap(r => r.issues || []);
    const allRecommendations = results.flatMap(r => r.recommendations || []);
    
    console.log('\n🔥 CRITICAL ROOT CAUSES IDENTIFIED:');
    if (allIssues.length === 0) {
        console.log('  ✅ No critical issues found - previous fixes may have worked');
    } else {
        allIssues.forEach((issue, index) => {
            console.log(`  ${index + 1}. ${issue}`);
        });
    }
    
    console.log('\n🛠️  EXACT FIXES NEEDED:');
    if (allRecommendations.length === 0) {
        console.log('  ✅ No fixes needed based on analysis');
    } else {
        allRecommendations.forEach((rec, index) => {
            console.log(`  ${index + 1}. ${rec}`);
        });
    }
    
    console.log('\n🎯 FINAL VERDICT:');
    const failedSteps = results.filter(r => !r.success).length;
    if (failedSteps === 0) {
        console.log('  ✅ ALL SYSTEMS WORKING - Issue may be resolved in current codebase');
        console.log('  ❓ User may need to update to latest version or clear cache');
    } else {
        console.log(`  ❌ ${failedSteps} CRITICAL ISSUES FOUND`);
        console.log('  🎯 These are the REAL root causes that need fixing');
    }
}

/**
 * Main execution
 */
async function main() {
    try {
        results.push(await step1_testUrlPatternMatching());
        results.push(await step2_testPageDiscovery());
        results.push(await step3_testCanvasMemoryIssue());
        results.push(await step4_testIntegration());
        
        step5_generateReport();
        
        // Save results to file for detailed analysis
        const reportFile = '/home/evb/WebstormProjects/mss-downloader/.devkit/ultra-priority/issue-6/ultrathink-analysis-results.json';
        await fs.writeFile(reportFile, JSON.stringify({
            timestamp: new Date().toISOString(),
            userUrl: 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778',
            userIssue: 'Only 195/278 pages + Cannot download + RangeError: Invalid array length',
            analysisResults: results,
            allIssues: results.flatMap(r => r.issues || []),
            allRecommendations: results.flatMap(r => r.recommendations || [])
        }, null, 2));
        
        console.log(`\n📄 Detailed analysis saved to: ${reportFile}`);
        
    } catch (error) {
        console.error('❌ Analysis failed:', error);
        process.exit(1);
    }
}

// Run the analysis
main();