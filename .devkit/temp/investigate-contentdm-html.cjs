const fs = require('fs');
const path = require('path');

/**
 * Investigate HTML responses from CONTENTdm to find actual image URLs
 * Focus on parsing the HTML to extract direct image links
 */

async function investigateHtmlResponses() {
    console.log('Investigating CONTENTdm HTML responses for image URLs...\n');
    
    const testUrls = [
        {
            name: 'Utils GetThumbnail',
            url: 'https://mdc.csuc.cat/utils/getthumbnail/collection/butlletins/id/1',
            description: 'Standard CONTENTdm thumbnail endpoint'
        },
        {
            name: 'Direct Server Access', 
            url: 'https://mdc.csuc.cat/digital/collection/butlletins/id/1/file',
            description: 'Direct server file access'
        },
        {
            name: 'CDM Bridge',
            url: 'https://mdc.csuc.cat/cdm/ref/collection/butlletins/id/1',
            description: 'CONTENTdm reference bridge'
        },
        {
            name: 'Alternative IIIF Thumbnail',
            url: 'https://mdc.csuc.cat/digital/iiif/butlletins/1/thumbnail',
            description: 'Alternative IIIF thumbnail endpoint'
        },
        {
            name: 'Collection Item Page',
            url: 'https://mdc.csuc.cat/digital/collection/butlletins/id/1',
            description: 'Main collection item page'
        }
    ];
    
    const results = [];
    
    for (const test of testUrls) {
        console.log(`\n=== ${test.name} ===`);
        console.log(`URL: ${test.url}`);
        console.log(`Description: ${test.description}`);
        
        try {
            const response = await fetch(test.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            console.log(`Status: ${response.status} ${response.statusText}`);
            console.log(`Content-Type: ${response.headers.get('content-type')}`);
            
            if (!response.ok) {
                console.log(`❌ Failed to fetch`);
                continue;
            }
            
            const html = await response.text();
            console.log(`Content Length: ${html.length} chars`);
            
            // Extract various image URL patterns
            const imagePatterns = [
                // Standard image tags
                {
                    name: 'IMG src attributes',
                    regex: /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
                    extract: (match) => match[1]
                },
                // Background images
                {
                    name: 'Background images',
                    regex: /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
                    extract: (match) => match[1]
                },
                // IIIF image URLs
                {
                    name: 'IIIF image URLs',
                    regex: /https?:\/\/[^"'\s]+\/iiif\/[^"'\s]+\.(jpg|jpeg|png|gif|webp)/gi,
                    extract: (match) => match[0]
                },
                // Utils image URLs
                {
                    name: 'Utils image URLs',
                    regex: /https?:\/\/[^"'\s]+\/utils\/[^"'\s]+/gi,
                    extract: (match) => match[0]
                },
                // CDM image URLs
                {
                    name: 'CDM image URLs',
                    regex: /https?:\/\/[^"'\s]+\/cdm\/[^"'\s]+/gi,
                    extract: (match) => match[0]
                },
                // Direct image URLs
                {
                    name: 'Direct image URLs',
                    regex: /https?:\/\/[^"'\s]+\.(jpg|jpeg|png|gif|webp|tiff|tif)/gi,
                    extract: (match) => match[0]
                },
                // Data URLs
                {
                    name: 'Data URLs',
                    regex: /data:image\/[^;]+;base64,[^"'\s]+/gi,
                    extract: (match) => match[0].substring(0, 50) + '...'
                }
            ];
            
            const extractedUrls = [];
            
            for (const pattern of imagePatterns) {
                const matches = [];
                let match;
                
                while ((match = pattern.regex.exec(html)) !== null) {
                    const url = pattern.extract(match);
                    if (url && !matches.includes(url)) {
                        matches.push(url);
                    }
                }
                
                if (matches.length > 0) {
                    console.log(`\n📸 ${pattern.name}: ${matches.length} found`);
                    matches.forEach((url, index) => {
                        console.log(`  ${index + 1}. ${url}`);
                    });
                    extractedUrls.push(...matches);
                }
            }
            
            // Look for specific CONTENTdm patterns in the HTML
            const contentdmPatterns = [
                {
                    name: 'CONTENTdm viewer URLs',
                    regex: /cdm[^"'\s]*\/[^"'\s]+/gi
                },
                {
                    name: 'Collection references',
                    regex: /collection\/[^"'\s]+\/id\/\d+/gi
                },
                {
                    name: 'IIIF references',
                    regex: /iiif\/[^"'\s]+/gi
                },
                {
                    name: 'Utils references',
                    regex: /utils\/[^"'\s]+/gi
                }
            ];
            
            console.log('\n🔍 CONTENTdm Pattern Analysis:');
            for (const pattern of contentdmPatterns) {
                const matches = [];
                let match;
                
                while ((match = pattern.regex.exec(html)) !== null) {
                    const url = match[0];
                    if (!matches.includes(url)) {
                        matches.push(url);
                    }
                }
                
                if (matches.length > 0) {
                    console.log(`\n  ${pattern.name}: ${matches.length} found`);
                    matches.slice(0, 5).forEach((url, index) => {
                        console.log(`    ${index + 1}. ${url}`);
                    });
                    if (matches.length > 5) {
                        console.log(`    ... and ${matches.length - 5} more`);
                    }
                }
            }
            
            // Look for JavaScript variables that might contain image URLs
            const jsPatterns = [
                {
                    name: 'JavaScript image variables',
                    regex: /var\s+\w*[Ii]mage\w*\s*=\s*["']([^"']+)["']/gi
                },
                {
                    name: 'JavaScript URL variables',
                    regex: /var\s+\w*[Uu]rl\w*\s*=\s*["']([^"']+)["']/gi
                },
                {
                    name: 'JavaScript source variables',
                    regex: /var\s+\w*[Ss]rc\w*\s*=\s*["']([^"']+)["']/gi
                }
            ];
            
            console.log('\n⚙️ JavaScript Variable Analysis:');
            for (const pattern of jsPatterns) {
                const matches = [];
                let match;
                
                while ((match = pattern.regex.exec(html)) !== null) {
                    const url = match[1];
                    if (!matches.includes(url)) {
                        matches.push(url);
                    }
                }
                
                if (matches.length > 0) {
                    console.log(`\n  ${pattern.name}: ${matches.length} found`);
                    matches.slice(0, 3).forEach((url, index) => {
                        console.log(`    ${index + 1}. ${url}`);
                    });
                }
            }
            
            // Save HTML sample for manual inspection
            const htmlSample = html.length > 2000 ? html.substring(0, 2000) + '...' : html;
            
            results.push({
                name: test.name,
                url: test.url,
                status: response.status,
                contentType: response.headers.get('content-type'),
                contentLength: html.length,
                extractedUrls: extractedUrls,
                htmlSample: htmlSample
            });
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            results.push({
                name: test.name,
                url: test.url,
                error: error.message
            });
        }
    }
    
    // Save comprehensive results
    const reportPath = path.join(__dirname, '../reports/contentdm-html-analysis.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n\n📊 Comprehensive analysis saved to: ${reportPath}`);
    
    // Summary
    console.log('\n\n=== SUMMARY ===');
    const totalUrls = results.reduce((sum, result) => sum + (result.extractedUrls?.length || 0), 0);
    console.log(`Total image URLs extracted: ${totalUrls}`);
    
    const uniqueUrls = new Set();
    results.forEach(result => {
        if (result.extractedUrls) {
            result.extractedUrls.forEach(url => uniqueUrls.add(url));
        }
    });
    
    console.log(`Unique image URLs: ${uniqueUrls.size}`);
    
    if (uniqueUrls.size > 0) {
        console.log('\n🎯 Top unique image URLs:');
        Array.from(uniqueUrls).slice(0, 10).forEach((url, index) => {
            console.log(`  ${index + 1}. ${url}`);
        });
    }
    
    return results;
}

// Run if called directly
if (require.main === module) {
    investigateHtmlResponses().catch(console.error);
}

module.exports = { investigateHtmlResponses };