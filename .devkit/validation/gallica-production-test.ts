#!/usr/bin/env bun

/**
 * Gallica Production Edge Case Testing
 * 
 * Tests real Gallica manuscripts using the production GallicaLoader
 * to identify actual edge cases that fail in real-world usage.
 */

// Import actual production modules
import { GallicaLoader } from '../../src/main/services/library-loaders/GallicaLoader';
import type { LoaderDependencies } from '../../src/main/services/library-loaders/types';

interface RealGallicaTest {
    name: string;
    url: string;
    description: string;
    expectedIssues?: string[];
    minExpectedPages?: number;
    maxExpectedPages?: number;
}

// Real Gallica manuscripts for testing edge cases
const REAL_TEST_CASES: RealGallicaTest[] = [
    {
        name: "Standard Medieval Manuscript",
        url: "https://gallica.bnf.fr/ark:/12148/btv1b8449691v/f1.highres",
        description: "Well-known manuscript from CLAUDE.md - should work perfectly",
        minExpectedPages: 50,
        maxExpectedPages: 500
    },
    {
        name: "Large Medieval Manuscript", 
        url: "https://gallica.bnf.fr/ark:/12148/btv1b105072169/f1.highres",
        description: "Large manuscript to test page count discovery performance",
        minExpectedPages: 100, 
        maxExpectedPages: 1000,
        expectedIssues: ["Long page count discovery", "Potential timeout issues"]
    },
    {
        name: "Book with bpt6k prefix",
        url: "https://gallica.bnf.fr/ark:/12148/bpt6k1515663w/f1.item",
        description: "Printed book that should use IIIF API",
        minExpectedPages: 20,
        maxExpectedPages: 800
    },
    {
        name: "Manuscript with viewer URL", 
        url: "https://gallica.bnf.fr/ark:/12148/btv1b84408315/f1.image",
        description: "Manuscript accessed through viewer format URL",
        minExpectedPages: 10,
        maxExpectedPages: 500
    },
    {
        name: "Direct IIIF Manifest",
        url: "https://gallica.bnf.fr/iiif/ark:/12148/btv1b8449691v/manifest.json",
        description: "Direct IIIF manifest access - test ARK extraction from manifest URL",
        minExpectedPages: 50,
        maxExpectedPages: 500,
        expectedIssues: ["ARK ID extraction from manifest URL might fail"]
    },
    {
        name: "Periodical (cb prefix)",
        url: "https://gallica.bnf.fr/ark:/12148/cb32842905g/f1.item", 
        description: "Periodical with cb prefix - different content type handling",
        minExpectedPages: 5,
        maxExpectedPages: 100
    },
    {
        name: "Map Collection",
        url: "https://gallica.bnf.fr/ark:/12148/btv1b53012710q/f1.item",
        description: "Map from btv1m collection - should require IIIF for full resolution",
        minExpectedPages: 1,
        maxExpectedPages: 10
    },
    {
        name: "Image/Print Collection", 
        url: "https://gallica.bnf.fr/ark:/12148/btv1c5903065k/f1.item",
        description: "Single image from btv1c collection",
        minExpectedPages: 1,
        maxExpectedPages: 5
    }
];

// Production-like dependencies
const createProductionDeps = (): LoaderDependencies => ({
    fetchDirect: async (url: string, options: RequestInit = {}) => {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ManuscriptDownloader/1.0)',
                    ...options.headers
                }
            });
            return response;
        } catch (error) {
            throw new Error(`Network request failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    },
    
    manifestCache: {
        get: async () => null, // No caching for testing
        set: async () => {},
        clear: async () => {}
    },
    
    logger: {
        log: (entry: any) => {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`);
            if (entry.details) {
                console.log(`   Details:`, entry.details);
            }
        }
    }
});

async function testRealGallicaManuscripts(): Promise<void> {
    console.log('🌐 GALLICA PRODUCTION EDGE CASE TESTING');
    console.log('======================================\n');
    
    const productionDeps = createProductionDeps();
    const gallicaLoader = new GallicaLoader(productionDeps);
    
    let totalTests = 0;
    let passedTests = 0;
    let edgeCasesFound = 0;
    const failurePatterns: string[] = [];
    const successResults: Array<{name: string, pages: number, title: string}> = [];
    
    for (const testCase of REAL_TEST_CASES) {
        totalTests++;
        console.log(`\n📋 Test ${totalTests}: ${testCase.name}`);
        console.log(`   URL: ${testCase.url}`);
        console.log(`   Description: ${testCase.description}`);
        
        const startTime = Date.now();
        
        try {
            const manifest = await gallicaLoader.loadManifest(testCase.url);
            const duration = Date.now() - startTime;
            
            console.log(`   ✅ SUCCESS: ${manifest.totalPages} pages loaded in ${duration}ms`);
            console.log(`   📄 Title: ${manifest.displayName}`);
            console.log(`   🔗 First page: ${manifest.pageLinks[0]?.substring(0, 80)}...`);
            
            // Validate page count expectations
            if (testCase.minExpectedPages && manifest.totalPages < testCase.minExpectedPages) {
                console.log(`   ⚠️  WARNING: Expected at least ${testCase.minExpectedPages} pages, got ${manifest.totalPages}`);
                edgeCasesFound++;
            } else if (testCase.maxExpectedPages && manifest.totalPages > testCase.maxExpectedPages) {
                console.log(`   ⚠️  WARNING: Expected at most ${testCase.maxExpectedPages} pages, got ${manifest.totalPages}`);
                edgeCasesFound++;
            } else if (manifest.totalPages === 0) {
                console.log(`   ❌ CRITICAL: No pages found in manifest`);
                edgeCasesFound++;
            } else {
                passedTests++;
                successResults.push({
                    name: testCase.name,
                    pages: manifest.totalPages,
                    title: manifest.displayName
                });
            }
            
            // Performance warnings
            if (duration > 10000) {
                console.log(`   ⏱️  PERFORMANCE WARNING: Load took ${duration}ms (>10s)`);
                edgeCasesFound++;
            }
            
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMsg = error instanceof Error ? error.message : String(error);
            
            console.log(`   ❌ FAILURE: ${errorMsg}`);
            console.log(`   ⏱️  Failed after ${duration}ms`);
            
            // Categorize failure types
            if (errorMsg.includes('ARK ID')) {
                failurePatterns.push('ARK_EXTRACTION_FAILED');
                console.log(`   🔍 EDGE CASE: ARK ID extraction issue`);
            } else if (errorMsg.includes('404')) {
                failurePatterns.push('MANIFEST_NOT_FOUND');
                console.log(`   🔍 EDGE CASE: IIIF manifest not accessible`);
            } else if (errorMsg.includes('loading strategies failed')) {
                failurePatterns.push('ALL_STRATEGIES_FAILED');
                console.log(`   🔍 EDGE CASE: All loading strategies exhausted`);
            } else if (errorMsg.includes('timeout') || errorMsg.includes('TIMEOUT')) {
                failurePatterns.push('TIMEOUT_ERROR');
                console.log(`   🔍 EDGE CASE: Request timeout`);
            } else if (errorMsg.includes('Network')) {
                failurePatterns.push('NETWORK_ERROR');
                console.log(`   🔍 EDGE CASE: Network connectivity issue`);
            } else {
                failurePatterns.push('UNKNOWN_ERROR');
                console.log(`   🔍 EDGE CASE: Unknown failure pattern`);
            }
            
            edgeCasesFound++;
        }
        
        if (testCase.expectedIssues) {
            console.log(`   📝 Known potential issues: ${testCase.expectedIssues.join(', ')}`);
        }
        
        // Small delay between tests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n📊 PRODUCTION TESTING RESULTS');
    console.log('=============================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Edge Cases Found: ${edgeCasesFound}`);
    
    if (successResults.length > 0) {
        console.log('\n✅ SUCCESSFUL MANUSCRIPTS:');
        successResults.forEach(result => {
            console.log(`   • ${result.name}: ${result.pages} pages - "${result.title}"`);
        });
    }
    
    if (failurePatterns.length > 0) {
        console.log('\n❌ FAILURE PATTERNS DETECTED:');
        const patternCounts = failurePatterns.reduce((acc, pattern) => {
            acc[pattern] = (acc[pattern] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        Object.entries(patternCounts).forEach(([pattern, count]) => {
            console.log(`   • ${pattern}: ${count} occurrences`);
        });
    }
    
    return edgeCasesFound > 0 ? Promise.reject(new Error(`${edgeCasesFound} edge cases found`)) : Promise.resolve();
}

async function analyzeGallicaIIIFVersions(): Promise<void> {
    console.log('\n🔍 GALLICA IIIF VERSION ANALYSIS');
    console.log('=================================');
    
    const manifestUrls = [
        "https://gallica.bnf.fr/iiif/ark:/12148/btv1b8449691v/manifest.json",
        "https://gallica.bnf.fr/iiif/ark:/12148/btv1b105072169/manifest.json", 
        "https://gallica.bnf.fr/iiif/ark:/12148/bpt6k1515663w/manifest.json"
    ];
    
    for (const url of manifestUrls) {
        console.log(`\n🔗 Analyzing: ${url}`);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
                continue;
            }
            
            const manifest = await response.json();
            
            console.log(`   📋 Manifest type: ${manifest['@type'] || manifest.type || 'Unknown'}`);
            console.log(`   🎯 IIIF Context: ${manifest['@context'] || 'Not specified'}`);
            console.log(`   📄 Label: ${manifest.label || 'No label'}`);
            
            // Analyze structure
            if (manifest.sequences) {
                console.log(`   📚 IIIF v2 structure: ${manifest.sequences.length} sequences`);
                const totalCanvases = manifest.sequences.reduce((sum: number, seq: any) => 
                    sum + (seq.canvases?.length || 0), 0);
                console.log(`   📝 Total canvases: ${totalCanvases}`);
            } else if (manifest.items) {
                console.log(`   📚 IIIF v3 structure: ${manifest.items.length} items`);
            }
            
            // Check service info
            if (manifest.service) {
                const services = Array.isArray(manifest.service) ? manifest.service : [manifest.service];
                console.log(`   🔧 Services: ${services.length} available`);
                services.forEach((service: any, i: number) => {
                    console.log(`      ${i+1}. ${service['@type'] || service.type} - ${service['@id'] || service.id}`);
                });
            }
            
        } catch (error) {
            console.log(`   ❌ Parse error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

// Main execution
if (import.meta.main) {
    console.log('🚀 Starting Gallica Production Edge Case Analysis...\n');
    
    try {
        await testRealGallicaManuscripts();
        await analyzeGallicaIIIFVersions();
        
        console.log('\n🎉 Production testing completed successfully!');
        console.log('\n📋 ANALYSIS SUMMARY:');
        console.log('• Current GallicaLoader implementation appears robust');
        console.log('• IIIF manifest parsing works correctly');
        console.log('• Multiple content types handled properly');
        console.log('• Performance is acceptable for standard manuscripts');
        
    } catch (error) {
        console.error('\n❌ CRITICAL: Edge cases detected in production testing');
        console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        console.log('\n🔧 NEXT ACTIONS REQUIRED:');
        console.log('• Investigate specific failure patterns');
        console.log('• Implement fixes for edge cases');
        console.log('• Add additional error handling');
        console.log('• Test with more diverse manuscript types');
        process.exit(1);
    }
}