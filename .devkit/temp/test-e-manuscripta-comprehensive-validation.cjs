#!/usr/bin/env node

/**
 * E-Manuscripta Comprehensive Implementation Analysis
 * 
 * Tests specific URLs from the todo list to compare:
 * 1. Current implementation effectiveness 
 * 2. Proposed IIIF solution effectiveness
 * 3. Multi-block handling improvements
 * 4. Exact improvement percentages
 */

const https = require('https');
const fs = require('fs').promises;

// Test URLs from the todo list
const TEST_URLS = [
    {
        url: 'https://www.e-manuscripta.ch/bau/content/titleinfo/5157222',
        type: 'titleinfo',
        description: 'Main issue URL - multi-block manuscript',
        library: 'bau',
        id: '5157222'
    },
    {
        url: 'https://www.e-manuscripta.ch/bau/content/thumbview/5157616',
        type: 'thumbview', 
        description: 'Block 1',
        library: 'bau',
        id: '5157616'
    },
    {
        url: 'https://www.e-manuscripta.ch/bau/content/thumbview/5157228',
        type: 'thumbview',
        description: 'Block 2', 
        library: 'bau',
        id: '5157228'
    },
    {
        url: 'https://www.e-manuscripta.ch/bau/content/thumbview/5157615',
        type: 'thumbview',
        description: 'Block 3',
        library: 'bau', 
        id: '5157615'
    }
];

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
        }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
    });
}

async function testCurrentImplementationApproach(testUrl) {
    console.log(`\n🔍 Testing Current Implementation: ${testUrl.url}`);
    
    try {
        const response = await fetchUrl(testUrl.url);
        if (response.status !== 200) {
            return { success: false, error: `HTTP ${response.status}`, pages: 0 };
        }
        
        const html = response.data;
        let discoveredPages = [];
        
        // METHOD 1: goToPage dropdown parsing (current primary method)
        const selectStart = html.indexOf('<select id="goToPage"');
        const selectEnd = html.indexOf('</select>', selectStart);
        
        if (selectStart !== -1 && selectEnd !== -1) {
            const selectElement = html.substring(selectStart, selectEnd + 9);
            const optionMatches = Array.from(selectElement.matchAll(/<option\s+value="(\d+)"\s*>\s*\[(\d+)\]\s*/g));
            discoveredPages = optionMatches.map(match => ({
                pageId: match[1],
                pageNumber: parseInt(match[2], 10)
            }));
            console.log(`   ✅ Dropdown method found ${discoveredPages.length} pages`);
        }
        
        // METHOD 2: JavaScript config parsing (fallback)
        if (discoveredPages.length === 0) {
            const jsPatterns = [
                /var\s+pageData\s*=\s*(\{[^}]+\})/,
                /window\.pageConfig\s*=\s*(\{[^}]+\})/,
                /"pages"\s*:\s*\[([^\]]+)\]/,
                /pageIds\s*:\s*\[([^\]]+)\]/,
            ];
            
            for (const pattern of jsPatterns) {
                const match = html.match(pattern);
                if (match) {
                    console.log(`   ⚠️  JS config found, but parsing not implemented`);
                    break;
                }
            }
        }
        
        // METHOD 3: URL pattern discovery
        if (discoveredPages.length === 0) {
            console.log(`   ⚠️  Falling back to URL pattern discovery (limited effectiveness)`);
            // This method typically only finds 1-2 pages by testing sequential IDs
            discoveredPages = [{ pageId: testUrl.id, pageNumber: 1 }];
        }
        
        return {
            success: true,
            pages: discoveredPages.length,
            method: discoveredPages.length > 1 ? 'dropdown' : 'url_pattern',
            pageIds: discoveredPages.map(p => p.pageId).slice(0, 5), // First 5 for brevity
        };
        
    } catch (error) {
        return { success: false, error: error.message, pages: 0 };
    }
}

async function testIIIFApproach(testUrl) {
    console.log(`\n🔬 Testing IIIF Approach: ${testUrl.url}`);
    
    try {
        // Test 1: Check for IIIF manifest availability
        const iiifManifestUrl = `https://www.e-manuscripta.ch/${testUrl.library}/iiif/${testUrl.id}/manifest`;
        
        try {
            const manifestResponse = await fetchUrl(iiifManifestUrl);
            if (manifestResponse.status === 200) {
                const manifest = JSON.parse(manifestResponse.data);
                
                // Count sequences and canvases
                let totalCanvases = 0;
                if (manifest.sequences && manifest.sequences.length > 0) {
                    totalCanvases = manifest.sequences.reduce((sum, seq) => sum + (seq.canvases?.length || 0), 0);
                }
                
                console.log(`   ✅ IIIF manifest found with ${totalCanvases} canvases`);
                
                return {
                    success: true,
                    pages: totalCanvases,
                    method: 'iiif_manifest',
                    manifestUrl: iiifManifestUrl,
                    sequences: manifest.sequences?.length || 0
                };
            }
        } catch (iiifError) {
            console.log(`   ❌ IIIF manifest not available: ${iiifError.message}`);
        }
        
        // Test 2: Check for IIIF Collection (for multi-block manuscripts)
        const iiifCollectionUrl = `https://www.e-manuscripta.ch/${testUrl.library}/iiif/${testUrl.id}/collection`;
        
        try {
            const collectionResponse = await fetchUrl(iiifCollectionUrl);
            if (collectionResponse.status === 200) {
                const collection = JSON.parse(collectionResponse.data);
                
                let totalPages = 0;
                let manifestCount = 0;
                
                if (collection.manifests) {
                    manifestCount = collection.manifests.length;
                    
                    // For each manifest in collection, count pages
                    for (const manifestRef of collection.manifests.slice(0, 3)) { // Test first 3 for speed
                        try {
                            const subManifestResponse = await fetchUrl(manifestRef['@id']);
                            if (subManifestResponse.status === 200) {
                                const subManifest = JSON.parse(subManifestResponse.data);
                                if (subManifest.sequences) {
                                    const pages = subManifest.sequences.reduce((sum, seq) => sum + (seq.canvases?.length || 0), 0);
                                    totalPages += pages;
                                }
                            }
                        } catch (e) {
                            console.log(`   ⚠️  Failed to fetch sub-manifest: ${e.message}`);
                        }
                    }
                }
                
                console.log(`   ✅ IIIF collection found with ${manifestCount} manifests, estimated ${totalPages}+ pages`);
                
                return {
                    success: true,
                    pages: totalPages,
                    method: 'iiif_collection', 
                    collectionUrl: iiifCollectionUrl,
                    manifests: manifestCount,
                    estimatedTotalPages: totalPages * (manifestCount / Math.min(manifestCount, 3)) // Extrapolate from sample
                };
            }
        } catch (collectionError) {
            console.log(`   ❌ IIIF collection not available: ${collectionError.message}`);
        }
        
        // Test 3: Alternative IIIF endpoints
        const alternativeEndpoints = [
            `https://www.e-manuscripta.ch/iiif/${testUrl.library}/${testUrl.id}/manifest`,
            `https://iiif.e-manuscripta.ch/${testUrl.library}/${testUrl.id}/manifest`,
            `https://www.e-manuscripta.ch/iiif/presentation/2/${testUrl.library}/${testUrl.id}/manifest`
        ];
        
        for (const endpoint of alternativeEndpoints) {
            try {
                const response = await fetchUrl(endpoint);
                if (response.status === 200) {
                    const manifest = JSON.parse(response.data);
                    const pages = manifest.sequences?.reduce((sum, seq) => sum + (seq.canvases?.length || 0), 0) || 0;
                    
                    console.log(`   ✅ Alternative IIIF endpoint found: ${endpoint} (${pages} pages)`);
                    
                    return {
                        success: true,
                        pages: pages,
                        method: 'iiif_alternative',
                        manifestUrl: endpoint
                    };
                }
            } catch (e) {
                // Continue testing other endpoints
            }
        }
        
        return { success: false, error: 'No IIIF endpoints available', pages: 0 };
        
    } catch (error) {
        return { success: false, error: error.message, pages: 0 };
    }
}

async function testMultiBlockHandling(testUrls) {
    console.log(`\n📚 Testing Multi-Block Manuscript Handling`);
    
    const titleinfoUrl = testUrls.find(u => u.type === 'titleinfo');
    const thumbviewUrls = testUrls.filter(u => u.type === 'thumbview');
    
    if (!titleinfoUrl) {
        console.log(`   ❌ No titleinfo URL provided for multi-block testing`);
        return { success: false, error: 'No titleinfo URL' };
    }
    
    console.log(`   📖 Testing titleinfo aggregation: ${titleinfoUrl.url}`);
    console.log(`   📄 Testing ${thumbviewUrls.length} individual thumbview blocks`);
    
    try {
        // Test current implementation's structure page discovery
        const structureUrl = `https://www.e-manuscripta.ch/${titleinfoUrl.library}/content/structure/${titleinfoUrl.id}`;
        const structureResponse = await fetchUrl(structureUrl);
        
        let discoveredBlocks = [];
        let totalPagesCurrentMethod = 0;
        
        if (structureResponse.status === 200) {
            const structureHtml = structureResponse.data;
            
            // Extract thumbview block URLs from structure page
            const thumbviewPattern = /href="[^"]*\/thumbview\/(\d+)"/g;
            const thumbviewMatches = Array.from(structureHtml.matchAll(thumbviewPattern));
            discoveredBlocks = thumbviewMatches.map(match => match[1]);
            
            console.log(`   ✅ Structure page found ${discoveredBlocks.length} blocks: ${discoveredBlocks.join(', ')}`);
            
            // Test each discovered block
            for (const blockId of discoveredBlocks.slice(0, 3)) { // Test first 3 for speed
                const blockUrl = `https://www.e-manuscripta.ch/${titleinfoUrl.library}/content/thumbview/${blockId}`;
                const blockResult = await testCurrentImplementationApproach({ 
                    url: blockUrl, 
                    type: 'thumbview', 
                    library: titleinfoUrl.library, 
                    id: blockId 
                });
                
                if (blockResult.success) {
                    totalPagesCurrentMethod += blockResult.pages;
                    console.log(`     📄 Block ${blockId}: ${blockResult.pages} pages`);
                }
            }
        } else {
            console.log(`   ❌ Structure page not accessible: HTTP ${structureResponse.status}`);
        }
        
        // Test individual thumbview URLs provided
        let totalPagesIndividualTest = 0;
        for (const thumbviewUrl of thumbviewUrls) {
            const result = await testCurrentImplementationApproach(thumbviewUrl);
            if (result.success) {
                totalPagesIndividualTest += result.pages;
                console.log(`   📄 Individual test ${thumbviewUrl.id}: ${result.pages} pages`);
            }
        }
        
        return {
            success: true,
            structurePageBlocks: discoveredBlocks.length,
            totalPagesFromStructure: totalPagesCurrentMethod,
            totalPagesFromIndividualTests: totalPagesIndividualTest,
            providedThumbviewUrls: thumbviewUrls.length,
            discoveredVsProvided: discoveredBlocks.length >= thumbviewUrls.length ? 'complete' : 'partial'
        };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function generateComprehensiveReport() {
    console.log('🔍 E-MANUSCRIPTA COMPREHENSIVE IMPLEMENTATION ANALYSIS');
    console.log('=====================================================\n');
    
    const results = {
        currentImplementation: {},
        iiifApproach: {},
        multiBlockHandling: {},
        comparison: {},
        recommendations: []
    };
    
    // Test current implementation for each URL
    console.log('📊 TESTING CURRENT IMPLEMENTATION APPROACH');
    console.log('===========================================');
    
    for (const testUrl of TEST_URLS) {
        const result = await testCurrentImplementationApproach(testUrl);
        results.currentImplementation[testUrl.id] = {
            url: testUrl.url,
            type: testUrl.type,
            description: testUrl.description,
            ...result
        };
    }
    
    // Test IIIF approach for each URL
    console.log('\n\n🔬 TESTING IIIF APPROACH');
    console.log('=========================');
    
    for (const testUrl of TEST_URLS) {
        const result = await testIIIFApproach(testUrl);
        results.iiifApproach[testUrl.id] = {
            url: testUrl.url,
            type: testUrl.type,
            description: testUrl.description,
            ...result
        };
    }
    
    // Test multi-block handling
    results.multiBlockHandling = await testMultiBlockHandling(TEST_URLS);
    
    // Calculate comparison metrics
    console.log('\n\n📈 GENERATING COMPARISON ANALYSIS');
    console.log('=================================');
    
    const currentTotalPages = Object.values(results.currentImplementation)
        .reduce((sum, r) => sum + (r.pages || 0), 0);
    
    const iiifTotalPages = Object.values(results.iiifApproach)
        .reduce((sum, r) => sum + (r.pages || 0), 0);
    
    const currentSuccessRate = Object.values(results.currentImplementation)
        .filter(r => r.success).length / TEST_URLS.length * 100;
    
    const iiifSuccessRate = Object.values(results.iiifApproach)
        .filter(r => r.success).length / TEST_URLS.length * 100;
    
    const improvementPercentage = iiifTotalPages > 0 && currentTotalPages > 0 
        ? ((iiifTotalPages - currentTotalPages) / currentTotalPages * 100)
        : 0;
    
    results.comparison = {
        currentTotalPages,
        iiifTotalPages,
        currentSuccessRate,
        iiifSuccessRate,
        improvementPercentage,
        pageDiscoveryImprovement: iiifTotalPages - currentTotalPages,
        methodComparison: {
            current: 'HTML parsing + URL pattern discovery',
            iiif: 'IIIF manifest + collection API',
            reliability: iiifSuccessRate > currentSuccessRate ? 'IIIF more reliable' : 'Current method more reliable'
        }
    };
    
    // Generate recommendations
    if (iiifSuccessRate > 50 && iiifTotalPages > currentTotalPages) {
        results.recommendations.push('✅ IIIF implementation should be prioritized - significantly more pages discoverable');
    }
    
    if (results.multiBlockHandling.success && results.multiBlockHandling.structurePageBlocks > 1) {
        results.recommendations.push('✅ Multi-block handling is working correctly');
    } else {
        results.recommendations.push('❌ Multi-block handling needs improvement');
    }
    
    if (improvementPercentage > 50) {
        results.recommendations.push(`🚀 IIIF approach provides ${improvementPercentage.toFixed(1)}% more pages - major improvement`);
    } else if (improvementPercentage > 10) {
        results.recommendations.push(`📈 IIIF approach provides ${improvementPercentage.toFixed(1)}% more pages - moderate improvement`);
    } else if (improvementPercentage < -10) {
        results.recommendations.push(`⚠️  Current approach actually performs better than IIIF`);
    } else {
        results.recommendations.push(`➡️  Both approaches perform similarly`);
    }
    
    // Print summary
    console.log('\n📋 FINAL COMPARISON SUMMARY');
    console.log('============================');
    console.log(`Current Implementation: ${currentTotalPages} pages, ${currentSuccessRate.toFixed(1)}% success rate`);
    console.log(`IIIF Approach: ${iiifTotalPages} pages, ${iiifSuccessRate.toFixed(1)}% success rate`);
    console.log(`Improvement: ${improvementPercentage > 0 ? '+' : ''}${improvementPercentage.toFixed(1)}% pages`);
    console.log(`\nMulti-block handling: ${results.multiBlockHandling.success ? 'Working' : 'Failed'}`);
    if (results.multiBlockHandling.success) {
        console.log(`  - Discovered ${results.multiBlockHandling.structurePageBlocks} blocks from structure page`);
        console.log(`  - Total pages from structure: ${results.multiBlockHandling.totalPagesFromStructure}`);
        console.log(`  - Total pages from individual tests: ${results.multiBlockHandling.totalPagesFromIndividualTests}`);
    }
    
    console.log('\n🎯 RECOMMENDATIONS:');
    results.recommendations.forEach(rec => console.log(`   ${rec}`));
    
    // Save detailed results
    await fs.writeFile(
        '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/e-manuscripta-comprehensive-analysis-results.json',
        JSON.stringify(results, null, 2)
    );
    
    console.log('\n📁 Detailed results saved to: .devkit/reports/e-manuscripta-comprehensive-analysis-results.json');
    
    return results;
}

// Run the analysis
generateComprehensiveReport().catch(console.error);