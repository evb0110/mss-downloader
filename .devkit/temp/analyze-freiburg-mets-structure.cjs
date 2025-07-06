const https = require('https');
const fs = require('fs');

async function fetchMetsXml(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function extractPageIdentifiers(xmlContent) {
    console.log('\n=== METS XML Structure Analysis ===\n');
    
    // Use regex to extract file information from XML
    const fileGrpRegex = /<mets:fileGrp[^>]*USE="([^"]*)"[^>]*>(.*?)<\/mets:fileGrp>/gs;
    const fileRegex = /<mets:file[^>]*ID="([^"]*)"[^>]*MIMETYPE="([^"]*)"[^>]*>.*?<mets:FLocat[^>]*xlink:href="([^"]*)"[^>]*\/?>.*?<\/mets:file>/gs;
    
    const allPages = [];
    const pagePatterns = new Set();
    let fileGrpMatch;
    let groupCount = 0;
    
    while ((fileGrpMatch = fileGrpRegex.exec(xmlContent)) !== null) {
        groupCount++;
        const use = fileGrpMatch[1];
        const grpContent = fileGrpMatch[2];
        
        console.log(`File Group ${groupCount}: USE="${use}"`);
        
        let fileMatch;
        let fileCount = 0;
        fileRegex.lastIndex = 0; // Reset regex
        
        while ((fileMatch = fileRegex.exec(grpContent)) !== null) {
            fileCount++;
            const id = fileMatch[1];
            const mimetype = fileMatch[2];
            const href = fileMatch[3];
            
            // Extract page identifier from filename
            const filename = href.split('/').pop();
            const pageId = filename.replace(/\.(jpg|jpeg|tif|tiff)$/i, '');
            
            allPages.push({
                id,
                use,
                filename,
                pageId,
                mimetype,
                href
            });
            
            // Track patterns
            if (pageId.match(/^\d+[rv]$/)) {
                pagePatterns.add('standard_recto_verso');
            } else if (pageId.match(/^x_/)) {
                pagePatterns.add('special_x_prefix');
            } else if (pageId.match(/^z_/)) {
                pagePatterns.add('special_z_suffix');
            } else if (pageId.includes('Vorderdeckel') || pageId.includes('Rueckdeckel')) {
                pagePatterns.add('covers');
            } else {
                pagePatterns.add('other');
            }
        }
        
        console.log(`  - Contains ${fileCount} files`);
        console.log('');
    }
    
    return { allPages, pagePatterns };
}

function analyzePageStructure(pages) {
    console.log('=== Page Structure Analysis ===\n');
    
    // Group by USE attribute
    const pagesByUse = {};
    pages.forEach(page => {
        if (!pagesByUse[page.use]) pagesByUse[page.use] = [];
        pagesByUse[page.use].push(page);
    });
    
    Object.keys(pagesByUse).forEach(use => {
        console.log(`${use}: ${pagesByUse[use].length} pages`);
    });
    console.log('');
    
    // Analyze page naming patterns
    console.log('=== Page Naming Patterns ===\n');
    
    const standardPages = pages.filter(p => p.pageId.match(/^\d+[rv]$/));
    const specialPages = pages.filter(p => !p.pageId.match(/^\d+[rv]$/));
    
    console.log(`Standard pages (###r/v): ${standardPages.length}`);
    console.log(`Special pages: ${specialPages.length}`);
    
    if (standardPages.length > 0) {
        const firstStandard = standardPages[0];
        const lastStandard = standardPages[standardPages.length - 1];
        console.log(`Range: ${firstStandard.pageId} to ${lastStandard.pageId}`);
    }
    
    console.log('\nSpecial pages sample:');
    specialPages.slice(0, 10).forEach(page => {
        console.log(`  - ${page.pageId} (${page.use})`);
    });
    
    return { pagesByUse, standardPages, specialPages };
}

function generateImageUrls(pages, baseUrl) {
    console.log('\n=== Image URL Generation ===\n');
    
    const imageUrls = [];
    
    // Focus on the main image group (usually 'DEFAULT' or similar)
    const mainGroup = pages.filter(p => p.use === 'DEFAULT' || p.use === 'default');
    
    if (mainGroup.length === 0) {
        console.log('No DEFAULT group found, using first available group');
        const firstUse = [...new Set(pages.map(p => p.use))][0];
        mainGroup.push(...pages.filter(p => p.use === firstUse));
    }
    
    console.log(`Using ${mainGroup.length} pages from group: ${mainGroup[0]?.use}`);
    
    mainGroup.forEach(page => {
        // Construct full URL based on the href pattern
        let fullUrl;
        if (page.href.startsWith('http')) {
            fullUrl = page.href;
        } else {
            fullUrl = baseUrl + page.href;
        }
        
        imageUrls.push({
            pageId: page.pageId,
            filename: page.filename,
            url: fullUrl,
            isStandard: page.pageId.match(/^\d+[rv]$/) !== null
        });
    });
    
    return imageUrls;
}

async function testImageUrls(urls, maxTest = 5) {
    console.log(`\n=== Testing Image URLs (${Math.min(maxTest, urls.length)} samples) ===\n`);
    
    const testUrls = urls.slice(0, maxTest);
    const results = [];
    
    for (const urlInfo of testUrls) {
        try {
            await new Promise((resolve, reject) => {
                const req = https.request(urlInfo.url, { method: 'HEAD' }, (res) => {
                    const result = {
                        pageId: urlInfo.pageId,
                        url: urlInfo.url,
                        status: res.statusCode,
                        contentType: res.headers['content-type'],
                        contentLength: res.headers['content-length'],
                        success: res.statusCode === 200
                    };
                    results.push(result);
                    console.log(`${urlInfo.pageId}: ${res.statusCode} (${res.headers['content-length']} bytes)`);
                    resolve();
                });
                
                req.on('error', (err) => {
                    results.push({
                        pageId: urlInfo.pageId,
                        url: urlInfo.url,
                        error: err.message,
                        success: false
                    });
                    console.log(`${urlInfo.pageId}: ERROR - ${err.message}`);
                    resolve();
                });
                
                req.setTimeout(10000, () => {
                    req.destroy();
                    results.push({
                        pageId: urlInfo.pageId,
                        url: urlInfo.url,
                        error: 'Timeout',
                        success: false
                    });
                    console.log(`${urlInfo.pageId}: TIMEOUT`);
                    resolve();
                });
                
                req.end();
            });
        } catch (err) {
            console.log(`${urlInfo.pageId}: EXCEPTION - ${err.message}`);
        }
    }
    
    return results;
}

async function main() {
    try {
        console.log('Fetching METS XML...\n');
        const xmlContent = await fetchMetsXml('https://dl.ub.uni-freiburg.de/diglitData/mets/hs360a.xml');
        
        const { allPages, pagePatterns } = extractPageIdentifiers(xmlContent);
        
        console.log(`Total pages found: ${allPages.length}`);
        console.log(`Page patterns: ${Array.from(pagePatterns).join(', ')}\n`);
        
        const analysis = analyzePageStructure(allPages);
        
        // Generate image URLs
        const baseUrl = 'https://dl.ub.uni-freiburg.de/diglitData/image/hs360a/';
        const imageUrls = generateImageUrls(allPages, baseUrl);
        
        // Test sample URLs
        const testResults = await testImageUrls(imageUrls, 10);
        
        console.log('\n=== Summary ===\n');
        console.log(`Total pages in METS: ${allPages.length}`);
        console.log(`Standard manuscript pages: ${analysis.standardPages.length}`);
        console.log(`Special pages: ${analysis.specialPages.length}`);
        console.log(`Image URLs generated: ${imageUrls.length}`);
        console.log(`Successful URL tests: ${testResults.filter(r => r.success).length}/${testResults.length}`);
        
        // Save detailed results
        const detailedResults = {
            totalPages: allPages.length,
            pagePatterns: Array.from(pagePatterns),
            pagesByUse: Object.keys(analysis.pagesByUse).map(use => ({
                use,
                count: analysis.pagesByUse[use].length
            })),
            standardPages: analysis.standardPages.length,
            specialPages: analysis.specialPages.length,
            sampleUrls: imageUrls.slice(0, 20),
            testResults,
            recommendedApproach: generateRecommendations(analysis, testResults)
        };
        
        console.log('\n=== Recommended Implementation Approach ===\n');
        detailedResults.recommendedApproach.forEach(rec => console.log(`- ${rec}`));
        
        return detailedResults;
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

function generateRecommendations(analysis, testResults) {
    const recommendations = [];
    
    // Success rate analysis
    const successRate = testResults.filter(r => r.success).length / testResults.length;
    
    if (successRate >= 0.8) {
        recommendations.push('METS XML parsing approach is viable - high success rate for image URLs');
    } else {
        recommendations.push('METS XML parsing may have issues - investigate URL construction');
    }
    
    // Page structure recommendations
    if (analysis.standardPages.length > 0) {
        recommendations.push('Use standard page pattern (###r/v) for main manuscript content');
    }
    
    if (analysis.specialPages.length > 0) {
        recommendations.push('Handle special pages separately (covers, endpapers, etc.)');
    }
    
    // File group recommendations
    const useTypes = Object.keys(analysis.pagesByUse);
    if (useTypes.includes('DEFAULT')) {
        recommendations.push('Prioritize DEFAULT file group for main images');
    } else {
        recommendations.push(`Use primary file group: ${useTypes[0]}`);
    }
    
    recommendations.push('Parse METS XML to extract all page identifiers systematically');
    recommendations.push('Construct image URLs using base URL + relative href from METS');
    recommendations.push('Implement fallback for missing or invalid pages');
    
    return recommendations;
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main, extractPageIdentifiers, analyzePageStructure };