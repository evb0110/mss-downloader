#!/usr/bin/env bun

/**
 * Gallica Edge Case Testing Framework
 * 
 * Tests various Gallica manuscript patterns to identify edge cases
 * that may still fail despite the main GallicaLoader implementation.
 */

interface GallicaTestCase {
    name: string;
    url: string;
    expectedContentType: 'manuscript' | 'book' | 'periodical' | 'image' | 'map' | 'serial';
    expectedArkPrefix: string;
    notes?: string;
    expectedIssues?: string[];
}

// Test cases covering various Gallica patterns
const TEST_CASES: GallicaTestCase[] = [
    // Medieval Manuscripts (btv1b prefix)
    {
        name: "Medieval Manuscript - Standard btv1b",
        url: "https://gallica.bnf.fr/ark:/12148/btv1b8449691v/f1.highres",
        expectedContentType: "manuscript",
        expectedArkPrefix: "btv1b",
        notes: "Standard medieval manuscript format from CLAUDE.md example"
    },
    {
        name: "Medieval Manuscript - Viewer URL format",
        url: "https://gallica.bnf.fr/ark:/12148/btv1b105072169/f1.image",
        expectedContentType: "manuscript", 
        expectedArkPrefix: "btv1b",
        notes: "Alternative viewer URL format"
    },
    {
        name: "Medieval Manuscript - Direct ARK format",
        url: "ark:/12148/btv1b105072169",
        expectedContentType: "manuscript",
        expectedArkPrefix: "btv1b",
        notes: "Raw ARK identifier format"
    },
    
    // Printed Books (bpt6k prefix)
    {
        name: "Printed Book - bpt6k prefix",
        url: "https://gallica.bnf.fr/ark:/12148/bpt6k123456/f1.item",
        expectedContentType: "book",
        expectedArkPrefix: "bpt6k",
        notes: "Printed books typically require IIIF Image API"
    },
    
    // Periodicals (cb32/cb prefix)
    {
        name: "Periodical - cb32 prefix",
        url: "https://gallica.bnf.fr/ark:/12148/cb32123456/f1.item",
        expectedContentType: "serial",
        expectedArkPrefix: "cb32",
        notes: "Periodical with cb32 prefix"
    },
    {
        name: "Periodical - cb prefix",
        url: "https://gallica.bnf.fr/ark:/12148/cb123456/f1.item",
        expectedContentType: "serial", 
        expectedArkPrefix: "cb",
        notes: "Periodical with shorter cb prefix"
    },
    
    // Images and Prints (btv1c prefix)
    {
        name: "Image - btv1c prefix",
        url: "https://gallica.bnf.fr/ark:/12148/btv1c123456/f1.item",
        expectedContentType: "image",
        expectedArkPrefix: "btv1c",
        notes: "Images and prints collection"
    },
    
    // Maps (btv1m prefix)
    {
        name: "Map - btv1m prefix",
        url: "https://gallica.bnf.fr/ark:/12148/btv1m123456/f1.item",
        expectedContentType: "map",
        expectedArkPrefix: "btv1m",
        notes: "Maps typically require IIIF for high resolution"
    },
    
    // Edge Cases - Unknown prefixes
    {
        name: "Unknown Prefix - Should default to manuscript",
        url: "https://gallica.bnf.fr/ark:/12148/xyz123456/f1.item",
        expectedContentType: "manuscript",
        expectedArkPrefix: "xyz12",
        notes: "Unknown prefix should fall back to manuscript handling",
        expectedIssues: ["Unknown prefix may not have optimal format preferences"]
    },
    
    // Large Manuscripts (potential timeout issues)
    {
        name: "Large Manuscript - Many pages",
        url: "https://gallica.bnf.fr/ark:/12148/btv1b8470088t/f1.highres", 
        expectedContentType: "manuscript",
        expectedArkPrefix: "btv1b",
        notes: "Large manuscript - test page count discovery performance",
        expectedIssues: ["Binary search timeout for very large manuscripts", "Page count discovery may hit rate limits"]
    },
    
    // IIIF Manifest URLs directly
    {
        name: "Direct IIIF Manifest URL",
        url: "https://gallica.bnf.fr/iiif/ark:/12148/btv1b8449691v/manifest.json",
        expectedContentType: "manuscript",
        expectedArkPrefix: "btv1b", 
        notes: "Direct IIIF manifest access",
        expectedIssues: ["May not extract ARK ID correctly from manifest URL"]
    },
    
    // Different image format combinations
    {
        name: "Manuscript with .zoom format",
        url: "https://gallica.bnf.fr/ark:/12148/btv1b105072169/f1.zoom",
        expectedContentType: "manuscript",
        expectedArkPrefix: "btv1b",
        notes: "Test .zoom image format handling"
    },
    
    // Potential restricted access manuscripts
    {
        name: "Potentially Restricted Manuscript",
        url: "https://gallica.bnf.fr/ark:/12148/btv1b84496920/f1.highres",
        expectedContentType: "manuscript", 
        expectedArkPrefix: "btv1b",
        notes: "Some Gallica content may have access restrictions",
        expectedIssues: ["Authentication requirements", "Geographic restrictions", "Special collection access"]
    }
];

// Import the actual GallicaLoader for testing
import { GallicaLoader } from '../../src/main/services/library-loaders/GallicaLoader';
import type { LoaderDependencies } from '../../src/main/services/library-loaders/types';

// Mock dependencies for testing
const mockDeps: LoaderDependencies = {
    fetchDirect: async (url: string, options?: RequestInit) => {
        // Mock fetch that simulates network requests
        console.log(`[MOCK FETCH] ${url}`);
        
        // Simulate IIIF manifest responses
        if (url.includes('manifest.json')) {
            return {
                ok: true,
                json: async () => ({
                    "@context": "http://iiif.io/api/presentation/2/context.json",
                    "@id": url,
                    "@type": "sc:Manifest",
                    "label": "Mock Manuscript",
                    "sequences": [{
                        "@type": "sc:Sequence",
                        "canvases": [
                            {
                                "@id": "canvas1",
                                "@type": "sc:Canvas",
                                "images": [{
                                    "@type": "oa:Annotation",
                                    "resource": {
                                        "@type": "dctypes:Image",
                                        "service": {
                                            "@id": "https://gallica.bnf.fr/iiif/ark:/12148/btv1b8449691v/f1"
                                        }
                                    }
                                }]
                            },
                            {
                                "@id": "canvas2", 
                                "@type": "sc:Canvas",
                                "images": [{
                                    "@type": "oa:Annotation",
                                    "resource": {
                                        "@type": "dctypes:Image",
                                        "service": {
                                            "@id": "https://gallica.bnf.fr/iiif/ark:/12148/btv1b8449691v/f2"
                                        }
                                    }
                                }]
                            }
                        ]
                    }]
                })
            } as Response;
        }
        
        // Simulate image requests for page count discovery
        if (url.includes('/f')) {
            const pageMatch = url.match(/\/f(\d+)/);
            const pageNum = pageMatch ? parseInt(pageMatch[1]) : 1;
            
            // Simulate that first 10 pages exist, then 404
            if (pageNum <= 10) {
                return { ok: true, status: 200 } as Response;
            } else {
                return { ok: false, status: 404 } as Response;
            }
        }
        
        return { ok: false, status: 404 } as Response;
    },
    
    manifestCache: {
        get: async () => null,
        set: async () => {},
        clear: async () => {}
    },
    
    logger: {
        log: (entry: any) => {
            console.log(`[LOGGER] ${entry.level}: ${entry.message}`, entry.details || '');
        }
    }
};

async function testGallicaEdgeCases(): Promise<void> {
    console.log('🔍 GALLICA EDGE CASE TESTING FRAMEWORK');
    console.log('=====================================\n');
    
    const gallicaLoader = new GallicaLoader(mockDeps);
    let totalTests = 0;
    let passedTests = 0;
    let edgeCasesFound = 0;
    
    for (const testCase of TEST_CASES) {
        totalTests++;
        console.log(`\n📋 Test ${totalTests}: ${testCase.name}`);
        console.log(`   URL: ${testCase.url}`);
        console.log(`   Expected: ${testCase.expectedContentType} (${testCase.expectedArkPrefix})`);
        
        try {
            const manifest = await gallicaLoader.loadManifest(testCase.url);
            
            console.log(`   ✅ SUCCESS: ${manifest.totalPages} pages found`);
            console.log(`   📄 Title: ${manifest.displayName}`);
            console.log(`   🏛️  Library: ${manifest.library}`);
            
            // Basic validation
            if (manifest.totalPages > 0 && manifest.pageLinks.length > 0) {
                passedTests++;
                console.log(`   🎯 PASS: Manifest loaded successfully`);
            } else {
                console.log(`   ⚠️  ISSUE: Manifest loaded but no pages found`);
                edgeCasesFound++;
            }
            
        } catch (error) {
            console.log(`   ❌ FAILURE: ${error instanceof Error ? error.message : String(error)}`);
            
            // Analyze failure type
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (errorMsg.includes('ARK ID')) {
                console.log(`   🔍 EDGE CASE: ARK ID extraction failed - URL format issue`);
                edgeCasesFound++;
            } else if (errorMsg.includes('loading strategies failed')) {
                console.log(`   🔍 EDGE CASE: All loading strategies failed - content access issue`);
                edgeCasesFound++;
            } else if (errorMsg.includes('not available')) {
                console.log(`   🔍 EDGE CASE: Loader not available - registration issue`);
                edgeCasesFound++;
            } else {
                console.log(`   🔍 EDGE CASE: Unexpected failure - ${errorMsg}`);
                edgeCasesFound++;
            }
        }
        
        if (testCase.expectedIssues) {
            console.log(`   📝 Known Issues: ${testCase.expectedIssues.join(', ')}`);
        }
        if (testCase.notes) {
            console.log(`   💡 Notes: ${testCase.notes}`);
        }
    }
    
    console.log('\n📊 EDGE CASE TESTING RESULTS');
    console.log('============================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Edge Cases Found: ${edgeCasesFound}`);
    
    if (edgeCasesFound > 0) {
        console.log(`\n🚨 EDGE CASES DETECTED: ${edgeCasesFound} potential issues found`);
        console.log('Further investigation needed for failing patterns.');
    } else {
        console.log(`\n✅ ALL TESTS PASSED: No edge cases detected in current test patterns`);
    }
}

async function testRealGallicaUrls(): Promise<void> {
    console.log('\n🌐 REAL GALLICA URL TESTING');
    console.log('===========================');
    
    // Test with real network requests (if available)
    const realTestUrls = [
        "https://gallica.bnf.fr/ark:/12148/btv1b8449691v/f1.highres",
        "https://gallica.bnf.fr/iiif/ark:/12148/btv1b8449691v/manifest.json"
    ];
    
    for (const url of realTestUrls) {
        console.log(`\n🔗 Testing real URL: ${url}`);
        try {
            const response = await fetch(url);
            console.log(`   Status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                console.log(`   Content-Type: ${contentType}`);
                
                if (contentType?.includes('json')) {
                    try {
                        const data = await response.json();
                        console.log(`   ✅ JSON Response: ${Object.keys(data).length} keys`);
                    } catch {
                        console.log(`   ⚠️  Failed to parse JSON response`);
                    }
                } else {
                    console.log(`   ✅ Non-JSON response received`);
                }
            } else {
                console.log(`   ❌ Request failed`);
            }
        } catch (error) {
            console.log(`   ❌ Network error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

// Run the tests
if (import.meta.main) {
    console.log('Starting Gallica Edge Case Analysis...\n');
    
    try {
        await testGallicaEdgeCases();
        await testRealGallicaUrls();
        
        console.log('\n🏁 Gallica edge case testing completed!');
        console.log('\n💡 Next steps:');
        console.log('   1. Analyze failing patterns for root causes');
        console.log('   2. Test with real Gallica manuscripts'); 
        console.log('   3. Check IIIF API version compatibility');
        console.log('   4. Investigate authentication requirements');
        console.log('   5. Test large manuscript performance');
        
    } catch (error) {
        console.error('❌ Testing framework error:', error);
        process.exit(1);
    }
}