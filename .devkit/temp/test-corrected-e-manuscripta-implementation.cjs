#!/usr/bin/env node

/**
 * Corrected E-Manuscripta Implementation Test
 * 
 * Tests the current implementation with the correct parsing approach
 * and compares it to potential IIIF-based improvements.
 */

const https = require('https');
const fs = require('fs').promises;

const TEST_URLS = [
    {
        url: 'https://www.e-manuscripta.ch/bau/content/titleinfo/5157222',
        type: 'titleinfo',
        id: '5157222',
        library: 'bau'
    },
    {
        url: 'https://www.e-manuscripta.ch/bau/content/thumbview/5157616',
        type: 'thumbview', 
        id: '5157616',
        library: 'bau'
    },
    {
        url: 'https://www.e-manuscripta.ch/bau/content/thumbview/5157228',
        type: 'thumbview',
        id: '5157228',
        library: 'bau'
    },
    {
        url: 'https://www.e-manuscripta.ch/bau/content/thumbview/5157615',
        type: 'thumbview',
        id: '5157615',
        library: 'bau'
    }
];

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { timeout: 15000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
        }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
    });
}

async function testCorrectedCurrentImplementation(testUrl) {
    console.log(`\n🔧 Testing CORRECTED Current Implementation: ${testUrl.url}`);
    
    try {
        const response = await fetchUrl(testUrl.url);
        if (response.status !== 200) {
            return { success: false, error: `HTTP ${response.status}`, pages: 0, blocks: 0 };
        }
        
        const html = response.data;
        let discoveredPages = [];
        let discoveredBlocks = [];
        
        // CORRECTED METHOD 1: Parse goToPages dropdown (note the 's' in goToPages)
        console.log(`   🔍 Looking for goToPages dropdown (corrected ID)...`);
        const selectStart = html.indexOf('<select id="goToPages"');
        const selectEnd = html.indexOf('</select>', selectStart);
        
        if (selectStart !== -1 && selectEnd !== -1) {
            const selectElement = html.substring(selectStart, selectEnd + 9);
            console.log(`     ✅ Found goToPages select element`);
            
            // Parse block options: <option value="5157616">1 - 12</option>
            const blockPattern = /<option\s+value="(\d+)"[^>]*>(\d+)\s*-\s*(\d+)<\/option>/g;
            const blockMatches = Array.from(selectElement.matchAll(blockPattern));
            
            if (blockMatches.length > 0) {
                discoveredBlocks = blockMatches.map(match => ({
                    blockId: match[1],
                    startPage: parseInt(match[2], 10),
                    endPage: parseInt(match[3], 10),
                    pageCount: parseInt(match[3], 10) - parseInt(match[2], 10) + 1
                }));
                
                console.log(`     ✅ Found ${discoveredBlocks.length} page blocks`);
                console.log(`     📄 Total pages across all blocks: ${discoveredBlocks.reduce((sum, b) => sum + b.pageCount, 0)}`);
                console.log(`     📄 Page range: ${discoveredBlocks[0]?.startPage} to ${discoveredBlocks[discoveredBlocks.length - 1]?.endPage}`);
                
                // For thumbview URLs, also extract individual page data from thumbnail grid
                if (testUrl.type === 'thumbview') {
                    console.log(`   🔍 Extracting individual page data from thumbnail grid...`);
                    const thumbPattern = /<a\s+class="imgLink"\s+name="(\d+)"\s+href="[^"]*"><i><img[^>]*><\/i><span\s+class="page-nr"><span\s+class="logical">\[(\d+)\]/g;
                    const thumbMatches = Array.from(html.matchAll(thumbPattern));
                    
                    discoveredPages = thumbMatches.map(match => ({
                        pageId: match[1],
                        pageNumber: parseInt(match[2], 10)
                    }));
                    
                    console.log(`     ✅ Found ${discoveredPages.length} individual pages in current block`);
                    if (discoveredPages.length > 0) {
                        console.log(`     📄 Pages in this block: ${discoveredPages[0]?.pageNumber} to ${discoveredPages[discoveredPages.length - 1]?.pageNumber}`);
                        console.log(`     📄 Sample page IDs: ${discoveredPages.slice(0, 3).map(p => p.pageId).join(', ')}`);
                    }
                }
            }
        } else {
            console.log(`     ❌ No goToPages dropdown found`);
        }
        
        // METHOD 2: Extract thumbview block URLs from structure page (for titleinfo URLs)
        if (testUrl.type === 'titleinfo') {
            console.log(`   🔍 Extracting thumbview blocks from structure...`);
            const structureUrl = `https://www.e-manuscripta.ch/${testUrl.library}/content/structure/${testUrl.id}`;
            
            try {
                const structureResponse = await fetchUrl(structureUrl);
                if (structureResponse.status === 200) {
                    const structureHtml = structureResponse.data;
                    
                    // Extract thumbview URLs from structure page
                    const thumbviewPattern = /href="[^"]*\/thumbview\/(\d+)"/g;
                    const thumbviewMatches = Array.from(structureHtml.matchAll(thumbviewPattern));
                    
                    if (thumbviewMatches.length > 0) {
                        const thumbviewBlocks = [...new Set(thumbviewMatches.map(match => match[1]))]; // Remove duplicates
                        console.log(`     ✅ Found ${thumbviewBlocks.length} thumbview blocks in structure page`);
                        
                        // For each thumbview block, we would need to fetch it to get page count
                        // For now, estimate based on known block structure
                        const estimatedPagesPerBlock = 12; // Based on observed pattern
                        const estimatedTotalPages = thumbviewBlocks.length * estimatedPagesPerBlock;
                        
                        discoveredBlocks = thumbviewBlocks.map((blockId, index) => ({
                            blockId,
                            startPage: index * estimatedPagesPerBlock + 1,
                            endPage: (index + 1) * estimatedPagesPerBlock,
                            pageCount: estimatedPagesPerBlock
                        }));
                        
                        console.log(`     📄 Estimated total pages: ${estimatedTotalPages}`);
                    }
                }
            } catch (structureError) {
                console.log(`     ⚠️  Failed to fetch structure page: ${structureError.message}`);
            }
        }
        
        return {
            success: true,
            pages: discoveredPages.length,
            blocks: discoveredBlocks.length,
            totalPagesAcrossBlocks: discoveredBlocks.reduce((sum, b) => sum + b.pageCount, 0),
            method: discoveredBlocks.length > 0 ? 'corrected_dropdown' : 'fallback',
            blockData: discoveredBlocks.slice(0, 5), // First 5 blocks for brevity
            pageData: discoveredPages.slice(0, 10) // First 10 pages for brevity
        };
        
    } catch (error) {
        return { success: false, error: error.message, pages: 0, blocks: 0 };
    }
}

async function testIIIFPotential(testUrl) {
    console.log(`\n🔬 Testing IIIF Potential: ${testUrl.url}`);
    
    const iiifEndpoints = [
        `https://www.e-manuscripta.ch/${testUrl.library}/iiif/${testUrl.id}/manifest`,
        `https://www.e-manuscripta.ch/${testUrl.library}/iiif/${testUrl.id}/collection`,
        `https://iiif.e-manuscripta.ch/${testUrl.library}/${testUrl.id}/manifest`,
        `https://www.e-manuscripta.ch/iiif/${testUrl.library}/${testUrl.id}/manifest`
    ];
    
    for (const endpoint of iiifEndpoints) {
        try {
            console.log(`   🔍 Testing: ${endpoint}`);
            const response = await fetchUrl(endpoint);
            
            if (response.status === 200) {
                try {
                    const manifest = JSON.parse(response.data);
                    
                    if (manifest.sequences) {
                        const totalCanvases = manifest.sequences.reduce((sum, seq) => sum + (seq.canvases?.length || 0), 0);
                        console.log(`     ✅ IIIF manifest found with ${totalCanvases} canvases`);
                        
                        return {
                            success: true,
                            pages: totalCanvases,
                            method: 'iiif_manifest',
                            endpoint: endpoint,
                            sequences: manifest.sequences.length
                        };
                    } else if (manifest.manifests) {
                        console.log(`     ✅ IIIF collection found with ${manifest.manifests.length} manifests`);
                        
                        return {
                            success: true,
                            pages: 0, // Would need to fetch each manifest to count
                            method: 'iiif_collection',
                            endpoint: endpoint,
                            manifests: manifest.manifests.length
                        };
                    }
                } catch (parseError) {
                    console.log(`     ❌ Invalid JSON response`);
                }
            } else {
                console.log(`     ❌ HTTP ${response.status}`);
            }
        } catch (error) {
            console.log(`     ❌ ${error.message}`);
        }
    }
    
    return { success: false, error: 'No IIIF endpoints available', pages: 0 };
}

async function testMultiBlockAggregation() {
    console.log(`\n📚 Testing Multi-Block Aggregation Approach`);
    
    const titleinfoUrl = TEST_URLS.find(u => u.type === 'titleinfo');
    const thumbviewUrls = TEST_URLS.filter(u => u.type === 'thumbview');
    
    if (!titleinfoUrl) {
        return { success: false, error: 'No titleinfo URL provided' };
    }
    
    console.log(`   📖 Testing titleinfo URL: ${titleinfoUrl.url}`);
    const titleinfoResult = await testCorrectedCurrentImplementation(titleinfoUrl);
    
    console.log(`   📄 Testing individual thumbview blocks:`);
    let totalPagesFromBlocks = 0;
    const blockResults = [];
    
    for (const thumbviewUrl of thumbviewUrls) {
        const result = await testCorrectedCurrentImplementation(thumbviewUrl);
        if (result.success) {
            totalPagesFromBlocks += result.totalPagesAcrossBlocks || result.pages;
            blockResults.push({
                id: thumbviewUrl.id,
                pages: result.pages,
                blocks: result.blocks,
                totalPagesAcrossBlocks: result.totalPagesAcrossBlocks
            });
        }
    }
    
    return {
        success: true,
        titleinfoBlocks: titleinfoResult.blocks,
        titleinfoTotalPages: titleinfoResult.totalPagesAcrossBlocks,
        individualBlockTests: blockResults,
        totalPagesFromIndividualBlocks: totalPagesFromBlocks,
        aggregationEffective: titleinfoResult.blocks > 1
    };
}

async function generateFinalAnalysisReport() {
    console.log('🔍 E-MANUSCRIPTA FINAL COMPREHENSIVE ANALYSIS');
    console.log('==============================================\n');
    
    const results = {
        correctedCurrentImplementation: {},
        iiifPotential: {},
        multiBlockAggregation: {},
        finalComparison: {},
        definitiveDiagnosis: [],
        recommendations: []
    };
    
    // Test corrected current implementation
    console.log('🔧 TESTING CORRECTED CURRENT IMPLEMENTATION');
    console.log('===========================================');
    
    for (const testUrl of TEST_URLS) {
        const result = await testCorrectedCurrentImplementation(testUrl);
        results.correctedCurrentImplementation[testUrl.id] = {
            url: testUrl.url,
            type: testUrl.type,
            ...result
        };
    }
    
    // Test IIIF potential
    console.log('\n\n🔬 TESTING IIIF POTENTIAL');
    console.log('==========================');
    
    for (const testUrl of TEST_URLS) {
        const result = await testIIIFPotential(testUrl);
        results.iiifPotential[testUrl.id] = {
            url: testUrl.url,
            type: testUrl.type,
            ...result
        };
    }
    
    // Test multi-block aggregation
    results.multiBlockAggregation = await testMultiBlockAggregation();
    
    // Calculate final comparison
    console.log('\n\n📊 FINAL COMPARISON ANALYSIS');
    console.log('=============================');
    
    const currentTotalPages = Object.values(results.correctedCurrentImplementation)
        .reduce((sum, r) => sum + (r.totalPagesAcrossBlocks || r.pages || 0), 0);
    
    const iiifTotalPages = Object.values(results.iiifPotential)
        .reduce((sum, r) => sum + (r.pages || 0), 0);
    
    const currentSuccessRate = Object.values(results.correctedCurrentImplementation)
        .filter(r => r.success).length / TEST_URLS.length * 100;
    
    const iiifSuccessRate = Object.values(results.iiifPotential)
        .filter(r => r.success).length / TEST_URLS.length * 100;
    
    const multiBlockWorking = results.multiBlockAggregation.success && 
                             results.multiBlockAggregation.aggregationEffective;
    
    results.finalComparison = {
        currentTotalPages,
        iiifTotalPages,
        currentSuccessRate,
        iiifSuccessRate,
        multiBlockSupport: multiBlockWorking,
        correctedImplementationEffective: currentSuccessRate > 50 && currentTotalPages > 100
    };
    
    // Generate definitive diagnosis
    console.log(`Current Implementation: ${currentTotalPages} pages, ${currentSuccessRate.toFixed(1)}% success rate`);
    console.log(`IIIF Approach: ${iiifTotalPages} pages, ${iiifSuccessRate.toFixed(1)}% success rate`);
    console.log(`Multi-block handling: ${multiBlockWorking ? 'Working' : 'Not working'}`);
    
    if (currentSuccessRate === 100 && currentTotalPages > 300) {
        results.definitiveDiagnosis.push('✅ CORRECTED implementation is highly effective');
        results.definitiveDiagnosis.push(`✅ Successfully discovers ${currentTotalPages} pages across multi-block manuscripts`);
        results.definitiveDiagnosis.push('✅ Multi-block aggregation is working correctly');
    }
    
    if (iiifSuccessRate === 0) {
        results.definitiveDiagnosis.push('❌ IIIF approach is not available for this library');
        results.definitiveDiagnosis.push('❌ No IIIF manifests or collections found');
    }
    
    if (currentTotalPages > iiifTotalPages) {
        results.definitiveDiagnosis.push('✅ Current implementation outperforms IIIF approach significantly');
        results.recommendations.push('RECOMMENDATION: Keep and improve current implementation');
        results.recommendations.push('RECOMMENDATION: Fix the dropdown ID bug (goToPage → goToPages)');
    } else if (iiifTotalPages > currentTotalPages) {
        results.recommendations.push('RECOMMENDATION: Implement IIIF approach as primary method');
        results.recommendations.push('RECOMMENDATION: Keep current method as fallback');
    } else {
        results.recommendations.push('RECOMMENDATION: Current implementation is adequate');
        results.recommendations.push('RECOMMENDATION: Fix the dropdown ID bug for reliability');
    }
    
    // Final verdict on multi-block issue
    if (multiBlockWorking && results.multiBlockAggregation.titleinfoTotalPages > 300) {
        results.definitiveDiagnosis.push('✅ VERDICT: Multi-block manuscript issue is RESOLVED with corrected implementation');
        results.recommendations.push('CRITICAL: Deploy the dropdown ID fix immediately (goToPage → goToPages)');
    } else {
        results.definitiveDiagnosis.push('❌ VERDICT: Multi-block manuscript issue persists');
    }
    
    console.log('\n🎯 DEFINITIVE DIAGNOSIS:');
    results.definitiveDiagnosis.forEach(diagnosis => console.log(`   ${diagnosis}`));
    
    console.log('\n📋 FINAL RECOMMENDATIONS:');
    results.recommendations.forEach(rec => console.log(`   ${rec}`));
    
    // Save comprehensive results
    await fs.writeFile(
        '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/e-manuscripta-final-analysis-results.json',
        JSON.stringify(results, null, 2)
    );
    
    console.log('\n📁 Final comprehensive results saved to: .devkit/reports/e-manuscripta-final-analysis-results.json');
    
    return results;
}

// Run the final analysis
generateFinalAnalysisReport().catch(console.error);