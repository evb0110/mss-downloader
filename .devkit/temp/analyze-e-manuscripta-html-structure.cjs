#!/usr/bin/env node

/**
 * Deep HTML Structure Analysis for E-Manuscripta Pages
 * 
 * Downloads and analyzes the actual HTML content from the test URLs
 * to understand why dropdown parsing is failing and what the real
 * page discovery potential is.
 */

const https = require('https');
const fs = require('fs').promises;

const TEST_URLS = [
    {
        url: 'https://www.e-manuscripta.ch/bau/content/titleinfo/5157222',
        type: 'titleinfo',
        id: '5157222'
    },
    {
        url: 'https://www.e-manuscripta.ch/bau/content/thumbview/5157616',
        type: 'thumbview', 
        id: '5157616'
    },
    {
        url: 'https://www.e-manuscripta.ch/bau/content/thumbview/5157228',
        type: 'thumbview',
        id: '5157228'
    },
    {
        url: 'https://www.e-manuscripta.ch/bau/content/thumbview/5157615',
        type: 'thumbview',
        id: '5157615'
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

async function analyzeHTMLStructure(url, html, type, id) {
    console.log(`\n🔍 ANALYZING HTML STRUCTURE: ${url}`);
    console.log(`   Type: ${type}, ID: ${id}`);
    console.log(`   HTML Length: ${html.length} characters`);
    
    const analysis = {
        url,
        type,
        id,
        htmlLength: html.length,
        foundElements: {},
        potentialPageData: [],
        navigationElements: [],
        scripts: [],
        pageDiscoveryMethods: {}
    };
    
    // 1. Check for goToPage dropdown
    console.log(`\n   🔍 Checking for goToPage dropdown...`);
    const selectStart = html.indexOf('<select id="goToPage"');
    const selectEnd = html.indexOf('</select>', selectStart);
    
    if (selectStart !== -1 && selectEnd !== -1) {
        const selectElement = html.substring(selectStart, selectEnd + 9);
        console.log(`     ✅ Found goToPage select (${selectElement.length} chars)`);
        
        // Extract options with multiple patterns
        const patterns = [
            /<option\s+value="(\d+)"\s*>\s*\[(\d+)\]\s*/g,
            /<option\s+value="(\d+)"\s*>\s*\[(\d+)\]\s*[^<]*/g,
            /<option[^>]*value=["'](\d+)["'][^>]*>\s*\[(\d+)\]/g,
        ];
        
        let optionMatches = [];
        for (const pattern of patterns) {
            optionMatches = Array.from(selectElement.matchAll(pattern));
            if (optionMatches.length > 0) {
                console.log(`     ✅ Pattern matched: ${pattern.toString()}`);
                break;
            }
        }
        
        analysis.foundElements.goToPageDropdown = true;
        analysis.potentialPageData = optionMatches.map(match => ({
            pageId: match[1],
            pageNumber: parseInt(match[2], 10)
        }));
        
        console.log(`     📄 Extracted ${analysis.potentialPageData.length} pages from dropdown`);
        if (analysis.potentialPageData.length > 0) {
            console.log(`     📄 Page range: ${analysis.potentialPageData[0].pageNumber} to ${analysis.potentialPageData[analysis.potentialPageData.length - 1].pageNumber}`);
            console.log(`     📄 Sample page IDs: ${analysis.potentialPageData.slice(0, 3).map(p => p.pageId).join(', ')}`);
        }
        
        // Save sample select element for inspection
        analysis.foundElements.selectElementSample = selectElement.substring(0, 500);
        
    } else {
        console.log(`     ❌ No goToPage dropdown found`);
        analysis.foundElements.goToPageDropdown = false;
        
        // Check for alternative select elements
        const selectMatches = html.match(/<select[^>]*id="[^"]*"[^>]*>/g);
        if (selectMatches) {
            console.log(`     🔍 Found ${selectMatches.length} other select elements:`);
            selectMatches.forEach(match => console.log(`       - ${match}`));
            analysis.foundElements.otherSelects = selectMatches;
        }
    }
    
    // 2. Check for navigation links
    console.log(`\n   🔍 Checking for navigation links...`);
    const navPatterns = [
        /href="[^"]*\/zoom\/(\d+)"[^>]*>.*?\[(\d+)\]/g,
        /href="[^"]*\/thumbview\/(\d+)"[^>]*>/g,
        /data-page[^=]*="(\d+)"/g,
        /"pageId":\s*"?(\d+)"?/g,
    ];
    
    navPatterns.forEach((pattern, index) => {
        const matches = Array.from(html.matchAll(pattern));
        if (matches.length > 0) {
            console.log(`     ✅ Navigation pattern ${index + 1}: ${matches.length} matches`);
            analysis.navigationElements.push({
                pattern: pattern.toString(),
                matches: matches.slice(0, 5).map(m => m[0].substring(0, 100)) // First 5 matches, truncated
            });
        }
    });
    
    // 3. Check for JavaScript configuration
    console.log(`\n   🔍 Checking for JavaScript configuration...`);
    const jsPatterns = [
        /var\s+pageData\s*=\s*(\{[^}]+\})/,
        /window\.pageConfig\s*=\s*(\{[^}]+\})/,
        /"pages"\s*:\s*\[([^\]]+)\]/,
        /pageIds\s*:\s*\[([^\]]+)\]/,
        /currentPage\s*[:=]\s*(\d+)/,
        /totalPages\s*[:=]\s*(\d+)/,
        /"pageCount"\s*:\s*(\d+)/,
        /"numPages"\s*:\s*(\d+)/,
    ];
    
    jsPatterns.forEach((pattern, index) => {
        const match = html.match(pattern);
        if (match) {
            console.log(`     ✅ JS config pattern ${index + 1}: ${match[1]?.substring(0, 100)}...`);
            analysis.scripts.push({
                pattern: pattern.toString(),
                match: match[1]?.substring(0, 200) // First 200 chars
            });
        }
    });
    
    // 4. Extract all numeric IDs that could be page identifiers
    console.log(`\n   🔍 Extracting potential page IDs...`);
    const idPatterns = [
        /(\d{7,})/g, // 7+ digit numbers (typical page IDs)
        /"id":\s*"?(\d+)"?/g,
        /value="(\d+)"/g,
        /data-[^=]*="(\d+)"/g,
    ];
    
    const allFoundIds = new Set();
    idPatterns.forEach(pattern => {
        const matches = Array.from(html.matchAll(pattern));
        matches.forEach(match => allFoundIds.add(match[1]));
    });
    
    const uniqueIds = Array.from(allFoundIds).filter(id => id.length >= 6).sort();
    console.log(`     📄 Found ${uniqueIds.length} potential page IDs (6+ digits)`);
    console.log(`     📄 Sample IDs: ${uniqueIds.slice(0, 10).join(', ')}`);
    analysis.foundElements.potentialPageIds = uniqueIds.slice(0, 20); // First 20
    
    // 5. Check document title and metadata
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
        console.log(`     📖 Title: ${titleMatch[1].trim()}`);
        analysis.foundElements.title = titleMatch[1].trim();
    }
    
    // 6. Check for IIIF-related content
    console.log(`\n   🔍 Checking for IIIF references...`);
    const iiifPatterns = [
        /iiif/gi,
        /manifest/gi,
        /canvas/gi,
        /sequence/gi,
    ];
    
    iiifPatterns.forEach((pattern, index) => {
        const matches = html.match(pattern);
        if (matches) {
            console.log(`     ✅ IIIF pattern ${index + 1}: ${matches.length} occurrences`);
            analysis.foundElements[`iiif_${index + 1}`] = matches.length;
        }
    });
    
    // 7. Check for image URLs and patterns
    console.log(`\n   🔍 Checking for image URL patterns...`);
    const imagePatterns = [
        /\/download\/webcache\/[^"'\s]+/g,
        /\.jpg[^"'\s]*/g,
        /\.jpeg[^"'\s]*/g,
        /\.png[^"'\s]*/g,
        /\/\d+\/\d+\/\d+/g, // Numeric path segments
    ];
    
    imagePatterns.forEach((pattern, index) => {
        const matches = Array.from(html.matchAll(pattern));
        if (matches.length > 0) {
            console.log(`     ✅ Image pattern ${index + 1}: ${matches.length} matches`);
            console.log(`       Sample: ${matches[0][0]}`);
            analysis.foundElements[`images_${index + 1}`] = matches.slice(0, 3).map(m => m[0]);
        }
    });
    
    return analysis;
}

async function runComprehensiveAnalysis() {
    console.log('🔬 E-MANUSCRIPTA HTML STRUCTURE ANALYSIS');
    console.log('=========================================\n');
    
    const allAnalyses = [];
    
    for (const testUrl of TEST_URLS) {
        try {
            console.log(`📥 Fetching: ${testUrl.url}`);
            const response = await fetchUrl(testUrl.url);
            
            if (response.status !== 200) {
                console.log(`   ❌ HTTP Error: ${response.status}`);
                continue;
            }
            
            const analysis = await analyzeHTMLStructure(testUrl.url, response.data, testUrl.type, testUrl.id);
            allAnalyses.push(analysis);
            
            // Save HTML content for inspection
            await fs.writeFile(
                `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/temp/html-content-${testUrl.id}.html`,
                response.data
            );
            console.log(`     💾 Saved HTML content to: .devkit/temp/html-content-${testUrl.id}.html`);
            
        } catch (error) {
            console.log(`   ❌ Error fetching ${testUrl.url}: ${error.message}`);
        }
    }
    
    // Generate summary report
    console.log('\n\n📊 SUMMARY ANALYSIS');
    console.log('===================');
    
    const summary = {
        totalUrls: TEST_URLS.length,
        successfulFetches: allAnalyses.length,
        dropdownSuccess: allAnalyses.filter(a => a.foundElements.goToPageDropdown).length,
        totalPagesDiscovered: allAnalyses.reduce((sum, a) => sum + a.potentialPageData.length, 0),
        iiifReferences: allAnalyses.filter(a => Object.keys(a.foundElements).some(k => k.startsWith('iiif_'))).length,
        alternativeNavigationMethods: allAnalyses.filter(a => a.navigationElements.length > 0).length,
        jsConfigMethods: allAnalyses.filter(a => a.scripts.length > 0).length,
    };
    
    console.log(`✅ Successfully analyzed ${summary.successfulFetches}/${summary.totalUrls} URLs`);
    console.log(`✅ GoToPage dropdown found in ${summary.dropdownSuccess} URLs`);
    console.log(`📄 Total pages discovered: ${summary.totalPagesDiscovered}`);
    console.log(`🔍 Alternative navigation methods found in ${summary.alternativeNavigationMethods} URLs`);
    console.log(`⚙️  JavaScript configuration found in ${summary.jsConfigMethods} URLs`);
    console.log(`🎨 IIIF references found in ${summary.iiifReferences} URLs`);
    
    // Detailed breakdown by URL
    console.log('\n📋 DETAILED BREAKDOWN BY URL:');
    allAnalyses.forEach(analysis => {
        console.log(`\n  📄 ${analysis.type.toUpperCase()} ${analysis.id}:`);
        console.log(`     Pages discovered: ${analysis.potentialPageData.length}`);
        console.log(`     Dropdown available: ${analysis.foundElements.goToPageDropdown ? '✅' : '❌'}`);
        console.log(`     Navigation methods: ${analysis.navigationElements.length}`);
        console.log(`     JS config methods: ${analysis.scripts.length}`);
        console.log(`     Potential page IDs: ${analysis.foundElements.potentialPageIds?.length || 0}`);
    });
    
    // Problem diagnosis
    console.log('\n🔧 PROBLEM DIAGNOSIS:');
    if (summary.dropdownSuccess === 0) {
        console.log('❌ CRITICAL: No goToPage dropdowns found in any URL');
        console.log('   This explains why the current implementation falls back to URL pattern discovery');
        console.log('   The dropdown parsing method is not working for these specific URLs');
    }
    
    if (summary.totalPagesDiscovered === 0) {
        console.log('❌ CRITICAL: No pages discovered by any method');
        console.log('   This indicates the HTML structure may be different than expected');
        console.log('   Or the content is dynamically loaded via JavaScript');
    }
    
    if (summary.alternativeNavigationMethods > 0) {
        console.log('✅ POSITIVE: Alternative navigation methods found');
        console.log('   These could be exploited for better page discovery');
    }
    
    if (summary.iiifReferences > 0) {
        console.log('✅ POSITIVE: IIIF references found in HTML');
        console.log('   This suggests IIIF manifests might be available');
    }
    
    // Save comprehensive results
    await fs.writeFile(
        '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/e-manuscripta-html-analysis-results.json',
        JSON.stringify({ summary, allAnalyses }, null, 2)
    );
    
    console.log('\n📁 Detailed results saved to: .devkit/reports/e-manuscripta-html-analysis-results.json');
    
    return { summary, allAnalyses };
}

// Run the analysis
runComprehensiveAnalysis().catch(console.error);