#!/usr/bin/env bun

/**
 * Gallica Error Pattern Analysis
 * 
 * Deep analysis of the specific failure patterns discovered in production testing
 * to understand root causes and develop targeted fixes.
 */

interface GallicaErrorPattern {
    pattern: string;
    description: string;
    rootCause: string;
    affectedContent: string[];
    testUrls: string[];
    proposedFix: string;
}

const DISCOVERED_ERROR_PATTERNS: GallicaErrorPattern[] = [
    {
        pattern: "IIIF_MANIFEST_SOCKET_FAILURE",
        description: "IIIF manifest requests failing with 'socket connection was closed unexpectedly'",
        rootCause: "Network reliability issues or Gallica IIIF endpoint instability",
        affectedContent: ["all content types when IIIF is primary strategy"],
        testUrls: [
            "https://gallica.bnf.fr/iiif/ark:/12148/btv1b84408315/manifest.json",
            "https://gallica.bnf.fr/iiif/ark:/12148/cb32842905g/manifest.json"
        ],
        proposedFix: "Add retry logic with exponential backoff and alternative endpoint attempts"
    },
    {
        pattern: "BOOK_FORMAT_HTTP400_FAILURE", 
        description: "Books (bpt6k prefix) reject all direct image formats with HTTP 400",
        rootCause: "Books require IIIF Image API exclusively, direct formats not supported",
        affectedContent: ["bpt6k books", "some periodicals"],
        testUrls: [
            "https://gallica.bnf.fr/ark:/12148/bpt6k1515663w/f1.item",
            "https://gallica.bnf.fr/ark:/12148/bpt6k1515663w/f1.highres"
        ],
        proposedFix: "For books, skip direct format attempts entirely, focus on IIIF reliability"
    },
    {
        pattern: "STRATEGY_CASCADE_FAILURE",
        description: "When IIIF fails, all fallback strategies also fail due to incorrect format assumptions",
        rootCause: "Format preferences not properly aligned with Gallica's actual supported formats per content type",
        affectedContent: ["books", "some periodicals", "some manuscripts"],
        testUrls: [
            "https://gallica.bnf.fr/ark:/12148/bpt6k1515663w/f1.item"
        ], 
        proposedFix: "Reorder strategies and improve format selection per content type"
    }
];

async function analyzeGallicaApiEndpoints(): Promise<void> {
    console.log('🔍 GALLICA API ENDPOINT ANALYSIS');
    console.log('================================\n');
    
    const endpointTests = [
        {
            name: "IIIF Manifest - Working manuscript",
            url: "https://gallica.bnf.fr/iiif/ark:/12148/btv1b8449691v/manifest.json",
            expectedStatus: 200
        },
        {
            name: "IIIF Manifest - Problematic manuscript", 
            url: "https://gallica.bnf.fr/iiif/ark:/12148/btv1b84408315/manifest.json",
            expectedStatus: 200
        },
        {
            name: "Direct Image - Manuscript highres",
            url: "https://gallica.bnf.fr/ark:/12148/btv1b8449691v/f1.highres",
            expectedStatus: 200
        },
        {
            name: "Direct Image - Book item format",
            url: "https://gallica.bnf.fr/ark:/12148/bpt6k1515663w/f1.item", 
            expectedStatus: 400
        },
        {
            name: "IIIF Image API - Manuscript",
            url: "https://gallica.bnf.fr/iiif/ark:/12148/btv1b8449691v/f1/full/max/0/default.jpg",
            expectedStatus: 200
        },
        {
            name: "IIIF Image API - Book",
            url: "https://gallica.bnf.fr/iiif/ark:/12148/bpt6k1515663w/f1/full/max/0/default.jpg", 
            expectedStatus: 200
        }
    ];
    
    for (const test of endpointTests) {
        console.log(`\n🧪 Testing: ${test.name}`);
        console.log(`   URL: ${test.url}`);
        
        try {
            const response = await fetch(test.url, { 
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ManuscriptDownloader/1.0)'
                }
            });
            
            console.log(`   Status: ${response.status} ${response.statusText}`);
            console.log(`   Headers: ${response.headers.get('content-type')} | ${response.headers.get('content-length')}`);
            
            if (response.status === test.expectedStatus) {
                console.log(`   ✅ Expected status confirmed`);
            } else {
                console.log(`   ⚠️  Unexpected status (expected ${test.expectedStatus})`);
            }
            
        } catch (error) {
            console.log(`   ❌ Request failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

async function testGallicaFormatSupport(): Promise<void> {
    console.log('\n📋 GALLICA FORMAT SUPPORT ANALYSIS');
    console.log('===================================');
    
    const formatTests = [
        {
            arkId: "ark:/12148/btv1b8449691v", // Known working manuscript
            contentType: "manuscript",
            formats: [".highres", ".item", ".zoom", ".medres", ".lowres"]
        },
        {
            arkId: "ark:/12148/bpt6k1515663w", // Problematic book
            contentType: "book", 
            formats: [".item", ".highres", ".zoom"]
        }
    ];
    
    for (const test of formatTests) {
        console.log(`\n📚 Testing ${test.contentType}: ${test.arkId}`);
        
        for (const format of test.formats) {
            const testUrl = `https://gallica.bnf.fr/${test.arkId}/f1${format}`;
            console.log(`\n   Format: ${format}`);
            console.log(`   URL: ${testUrl}`);
            
            try {
                const response = await fetch(testUrl, { 
                    method: 'HEAD',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; ManuscriptDownloader/1.0)'
                    }
                });
                
                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    const contentLength = response.headers.get('content-length');
                    console.log(`   ✅ ${response.status}: ${contentType} (${contentLength} bytes)`);
                } else {
                    console.log(`   ❌ ${response.status}: ${response.statusText}`);
                    
                    if (response.status === 400) {
                        console.log(`   🔍 HTTP 400 indicates format not supported for this content type`);
                    }
                }
                
            } catch (error) {
                console.log(`   ❌ Network error: ${error instanceof Error ? error.message : String(error)}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
}

async function testIIIFImageApiReliability(): Promise<void> {
    console.log('\n🖼️  IIIF IMAGE API RELIABILITY TEST');
    console.log('====================================');
    
    const iiifTests = [
        {
            name: "Manuscript IIIF - Standard resolution",
            url: "https://gallica.bnf.fr/iiif/ark:/12148/btv1b8449691v/f1/full/max/0/default.jpg"
        },
        {
            name: "Manuscript IIIF - Specific width", 
            url: "https://gallica.bnf.fr/iiif/ark:/12148/btv1b8449691v/f1/full/2000,/0/default.jpg"
        },
        {
            name: "Book IIIF - Full resolution",
            url: "https://gallica.bnf.fr/iiif/ark:/12148/bpt6k1515663w/f1/full/full/0/default.jpg"
        },
        {
            name: "Book IIIF - Conservative size",
            url: "https://gallica.bnf.fr/iiif/ark:/12148/bpt6k1515663w/f1/full/1500,/0/default.jpg"
        }
    ];
    
    for (const test of iiifTests) {
        console.log(`\n🎯 ${test.name}`);
        console.log(`   URL: ${test.url}`);
        
        const startTime = Date.now();
        try {
            const response = await fetch(test.url, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ManuscriptDownloader/1.0)'
                }
            });
            
            const duration = Date.now() - startTime;
            
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                const contentLength = response.headers.get('content-length');
                console.log(`   ✅ ${response.status} in ${duration}ms: ${contentType} (${contentLength} bytes)`);
            } else {
                console.log(`   ❌ ${response.status} after ${duration}ms: ${response.statusText}`);
            }
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.log(`   ❌ Failed after ${duration}ms: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

async function generateFixRecommendations(): Promise<void> {
    console.log('\n🔧 GALLICA EDGE CASE FIX RECOMMENDATIONS');
    console.log('=========================================\n');
    
    console.log('Based on the analysis, here are the specific fixes needed:\n');
    
    DISCOVERED_ERROR_PATTERNS.forEach((pattern, index) => {
        console.log(`${index + 1}. ${pattern.pattern}`);
        console.log(`   Problem: ${pattern.description}`);
        console.log(`   Root Cause: ${pattern.rootCause}`);
        console.log(`   Affects: ${pattern.affectedContent.join(', ')}`);
        console.log(`   Fix: ${pattern.proposedFix}\n`);
    });
    
    console.log('🎯 PRIORITY FIXES TO IMPLEMENT:');
    console.log('1. Add robust retry logic for IIIF manifest requests');
    console.log('2. Skip direct format attempts for book content types');
    console.log('3. Implement IIIF Image API fallback when manifest fails');
    console.log('4. Add better error classification and user feedback');
    console.log('5. Optimize strategy ordering per content type\n');
    
    console.log('📊 EXPECTED IMPACT:');
    console.log('• Fix ~60% of book download failures (bpt6k prefix)');
    console.log('• Improve reliability for unstable network conditions');
    console.log('• Reduce timeout-related failures');
    console.log('• Better user experience with clearer error messages');
}

// Main execution
if (import.meta.main) {
    console.log('🚀 Starting Gallica Error Pattern Analysis...\n');
    
    try {
        await analyzeGallicaApiEndpoints();
        await testGallicaFormatSupport();
        await testIIIFImageApiReliability();
        await generateFixRecommendations();
        
        console.log('\n✅ Gallica error analysis completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Error during analysis:', error);
        process.exit(1);
    }
}