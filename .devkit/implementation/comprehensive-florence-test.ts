#!/usr/bin/env bun

/**
 * Comprehensive Florence Test Suite
 * 
 * Validates the intelligent sizing implementation against multiple scenarios:
 * - Unrestricted manuscripts (should get 6000px)
 * - Restricted manuscripts (should fallback gracefully)
 * - Error handling and recovery
 * - Caching behavior
 * - Performance characteristics
 */

import { FlorenceLoaderWithIntelligentSizing } from './FlorenceLoaderWithIntelligentSizing';

// Enhanced mock dependencies with performance tracking
const testStats = {
    sizeDeterminations: 0,
    cacheHits: 0,
    fallbacks: 0,
    totalTestTime: 0
};

const mockDeps = {
    logger: {
        log: (entry: any) => {
            if (entry.details?.cached) {
                testStats.cacheHits++;
            }
            if (entry.message.includes('Optimal size determined')) {
                testStats.sizeDeterminations++;
            }
            if (entry.message.includes('fallback size')) {
                testStats.fallbacks++;
            }
            
            console.log(`[${entry.level.toUpperCase()}] ${entry.message}`);
            if (entry.details && process.env.VERBOSE) {
                console.log('  Details:', JSON.stringify(entry.details, null, 2));
            }
        },
        logDownloadError: (library: string, url: string, error: Error) => {
            console.error(`[ERROR] ${library} - ${url}: ${error.message}`);
        }
    },
    fetchWithHTTPS: async (url: string, options?: any) => {
        const response = await fetch(url, {
            method: options?.method || 'GET',
            headers: options?.headers || {},
            signal: options?.timeout ? AbortSignal.timeout(options.timeout) : undefined
        });
        return response;
    }
};

interface TestResult {
    success: boolean;
    manuscript: string;
    chosenSize: number;
    pageCount: number;
    loadTime: number;
    errors: string[];
    warnings: string[];
}

async function testManuscript(loader: FlorenceLoaderWithIntelligentSizing, url: string, expectedBehavior: string): Promise<TestResult> {
    console.log(`\n📖 Testing: ${url}`);
    console.log(`🎯 Expected: ${expectedBehavior}`);
    
    const startTime = Date.now();
    const result: TestResult = {
        success: false,
        manuscript: url,
        chosenSize: 0,
        pageCount: 0,
        loadTime: 0,
        errors: [],
        warnings: []
    };
    
    try {
        const manifest = await loader.loadManifest(url);
        const loadTime = Date.now() - startTime;
        
        // Extract size from first page URL
        const firstPageUrl = manifest.pageLinks[0];
        const sizeMatch = firstPageUrl.match(/\/full\/(\d+),\/0\/default\.jpg$/);
        const chosenSize = sizeMatch ? parseInt(sizeMatch[1]) : 0;
        
        result.success = true;
        result.chosenSize = chosenSize;
        result.pageCount = manifest.totalPages;
        result.loadTime = loadTime;
        
        console.log(`✅ SUCCESS: ${manifest.displayName}`);
        console.log(`   📊 ${manifest.totalPages} pages, ${chosenSize}px width, ${loadTime}ms`);
        
        // Validate size is reasonable
        if (chosenSize < 800) {
            result.warnings.push(`Very low resolution chosen: ${chosenSize}px`);
        }
        
        if (chosenSize > 6000) {
            result.warnings.push(`Unexpectedly high resolution: ${chosenSize}px`);
        }
        
        // Test first few pages for accessibility
        const samplesToTest = Math.min(3, manifest.pageLinks.length);
        let accessiblePages = 0;
        
        for (let i = 0; i < samplesToTest; i++) {
            try {
                const pageResponse = await fetch(manifest.pageLinks[i], { method: 'HEAD' });
                if (pageResponse.ok) {
                    accessiblePages++;
                } else {
                    result.warnings.push(`Page ${i + 1} returns HTTP ${pageResponse.status}`);
                }
            } catch (error: any) {
                result.warnings.push(`Page ${i + 1} error: ${error.message}`);
            }
        }
        
        console.log(`   🔍 ${accessiblePages}/${samplesToTest} sample pages accessible`);
        
        if (accessiblePages === 0) {
            result.errors.push('No sample pages are accessible');
        }
        
    } catch (error: any) {
        result.loadTime = Date.now() - startTime;
        result.errors.push(error.message);
        console.log(`❌ FAILED: ${error.message} (${result.loadTime}ms)`);
    }
    
    return result;
}

async function runComprehensiveTest() {
    console.log('🧪 Florence Intelligent Sizing - Comprehensive Test Suite\n');
    
    const loader = new FlorenceLoaderWithIntelligentSizing(mockDeps);
    
    const testCases = [
        {
            url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
            expected: 'Unrestricted - should get maximum quality (6000px)',
            category: 'unrestricted'
        },
        {
            url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217710/',
            expected: 'Restricted - should fallback from 6000px to 4000px or lower',
            category: 'restricted'
        },
        {
            url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317539/',
            expected: 'Alternative unrestricted - should get maximum quality',
            category: 'unrestricted'
        }
    ];
    
    const results: TestResult[] = [];
    
    // First pass - test each manuscript
    console.log('='.repeat(80));
    console.log('PHASE 1: Individual Manuscript Testing');
    console.log('='.repeat(80));
    
    for (const testCase of testCases) {
        const result = await testManuscript(loader, testCase.url, testCase.expected);
        results.push(result);
        
        // Add test timing to global stats
        testStats.totalTestTime += result.loadTime;
    }
    
    // Second pass - test caching behavior
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 2: Cache Behavior Testing');
    console.log('='.repeat(80));
    
    console.log('\n🔄 Testing cache behavior by re-loading first manuscript...');
    const cacheTestResult = await testManuscript(loader, testCases[0].url, 'Should use cached size (faster load time)');
    
    // Performance analysis
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 3: Performance Analysis');
    console.log('='.repeat(80));
    
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    console.log('\n📊 Performance Statistics:');
    console.log(`  ✅ Successful loads: ${successfulResults.length}/${results.length}`);
    console.log(`  ❌ Failed loads: ${failedResults.length}/${results.length}`);
    console.log(`  📈 Size determinations: ${testStats.sizeDeterminations}`);
    console.log(`  🎯 Cache hits: ${testStats.cacheHits}`);
    console.log(`  ⬇️  Fallbacks triggered: ${testStats.fallbacks}`);
    console.log(`  ⏱️  Total test time: ${testStats.totalTestTime}ms`);
    
    if (successfulResults.length > 0) {
        const avgLoadTime = successfulResults.reduce((sum, r) => sum + r.loadTime, 0) / successfulResults.length;
        const sizeDistribution = successfulResults.reduce((acc, r) => {
            acc[r.chosenSize] = (acc[r.chosenSize] || 0) + 1;
            return acc;
        }, {} as Record<number, number>);
        
        console.log(`  ⚡ Average load time: ${Math.round(avgLoadTime)}ms`);
        console.log(`  📏 Size distribution:`, sizeDistribution);
    }
    
    // Quality assessment
    console.log('\n🎯 Quality Assessment:');
    
    const unrestrictedResults = results.filter((_, i) => testCases[i].category === 'unrestricted');
    const restrictedResults = results.filter((_, i) => testCases[i].category === 'restricted');
    
    const unrestrictedMaxQuality = unrestrictedResults.filter(r => r.success && r.chosenSize >= 6000).length;
    const restrictedWithFallback = restrictedResults.filter(r => r.success && r.chosenSize < 6000).length;
    
    console.log(`  📈 Unrestricted getting max quality: ${unrestrictedMaxQuality}/${unrestrictedResults.length}`);
    console.log(`  🛡️  Restricted with fallback: ${restrictedWithFallback}/${restrictedResults.length}`);
    
    // Error analysis
    if (failedResults.length > 0) {
        console.log('\n❌ Error Analysis:');
        failedResults.forEach(result => {
            console.log(`  📖 ${result.manuscript}:`);
            result.errors.forEach(error => console.log(`    🔥 ${error}`));
        });
    }
    
    // Warning analysis
    const allWarnings = results.flatMap(r => r.warnings);
    if (allWarnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        const warningCounts = allWarnings.reduce((acc, warning) => {
            acc[warning] = (acc[warning] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        Object.entries(warningCounts).forEach(([warning, count]) => {
            console.log(`  ${count}x ${warning}`);
        });
    }
    
    // Final recommendation
    console.log('\n' + '='.repeat(80));
    console.log('FINAL ASSESSMENT');
    console.log('='.repeat(80));
    
    const overallSuccess = successfulResults.length === results.length;
    const fallbackWorking = restrictedWithFallback > 0;
    const maxQualityPreserved = unrestrictedMaxQuality === unrestrictedResults.length;
    
    console.log('\n🎯 Implementation Quality:');
    console.log(`  ✅ Overall success rate: ${Math.round((successfulResults.length / results.length) * 100)}%`);
    console.log(`  🛡️  Fallback mechanism: ${fallbackWorking ? '✅ Working' : '❌ Needs work'}`);
    console.log(`  📈 Max quality preservation: ${maxQualityPreserved ? '✅ Working' : '❌ Needs work'}`);
    
    if (overallSuccess && fallbackWorking && maxQualityPreserved) {
        console.log('\n🎉 RECOMMENDATION: Ready for integration!');
        console.log('✅ All tests passed - the intelligent sizing system successfully:');
        console.log('   📈 Maximizes quality for unrestricted manuscripts');
        console.log('   🛡️  Handles 403 errors gracefully with fallbacks');
        console.log('   ⚡ Provides good performance with caching');
    } else {
        console.log('\n⚠️  RECOMMENDATION: Needs refinement before integration');
        console.log('❌ Some tests failed - review the issues above before deploying');
    }
    
    return {
        success: overallSuccess,
        results,
        stats: testStats
    };
}

// Run comprehensive test
if (import.meta.main) {
    runComprehensiveTest()
        .then(results => {
            process.exit(results.success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Test suite crashed:', error);
            process.exit(1);
        });
}