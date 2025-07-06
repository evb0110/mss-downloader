const fs = require('fs');
const path = require('path');

/**
 * Examine actual HTML content from CONTENTdm responses
 */

async function examineHtmlContent() {
    console.log('Examining actual HTML content from CONTENTdm responses...\n');
    
    const testUrls = [
        'https://mdc.csuc.cat/utils/getthumbnail/collection/butlletins/id/1',
        'https://mdc.csuc.cat/digital/collection/butlletins/id/1/file',
        'https://mdc.csuc.cat/digital/collection/butlletins/id/1',
        'https://mdc.csuc.cat/digital/iiif/butlletins/1/thumbnail'
    ];
    
    for (const url of testUrls) {
        console.log(`\n=== ${url} ===`);
        
        try {
            const response = await fetch(url, {
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
            
            // Show first 500 chars of HTML
            console.log('\n📄 HTML Content (first 500 chars):');
            console.log(html.substring(0, 500));
            
            // Show last 500 chars if content is long
            if (html.length > 1000) {
                console.log('\n📄 HTML Content (last 500 chars):');
                console.log(html.substring(html.length - 500));
            }
            
            // Look for specific keywords
            const keywords = [
                'image', 'img', 'src', 'jpg', 'jpeg', 'png', 'gif', 'webp',
                'iiif', 'thumbnail', 'utils', 'getfile', 'getthumbnail',
                'collection', 'butlletins', 'contentdm', 'cdm'
            ];
            
            console.log('\n🔍 Keyword Analysis:');
            keywords.forEach(keyword => {
                const count = (html.toLowerCase().match(new RegExp(keyword, 'g')) || []).length;
                if (count > 0) {
                    console.log(`  ${keyword}: ${count} occurrences`);
                }
            });
            
            // Check if it's a redirect or error page
            if (html.includes('redirect') || html.includes('error') || html.includes('404') || html.includes('not found')) {
                console.log('\n⚠️  This appears to be an error or redirect page');
            }
            
            // Check for JavaScript redirects
            if (html.includes('window.location') || html.includes('document.location')) {
                console.log('\n🔄 JavaScript redirect detected');
            }
            
            // Save full HTML for manual inspection
            const filename = url.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_') + '.html';
            const htmlPath = path.join(__dirname, '../reports/', filename);
            fs.writeFileSync(htmlPath, html);
            console.log(`\n💾 Full HTML saved to: ${htmlPath}`);
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }
    
    // Now let's test a working manuscript URL from the current implementation
    console.log('\n\n=== Testing Working Manuscript URL ===');
    const workingUrl = 'https://mdc.csuc.cat/digital/collection/manuscritBC/id/1107';
    
    try {
        const response = await fetch(workingUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log(`Content-Type: ${response.headers.get('content-type')}`);
        
        if (response.ok) {
            const html = await response.text();
            console.log(`Content Length: ${html.length} chars`);
            
            // Save this HTML as well
            const workingHtmlPath = path.join(__dirname, '../reports/working_manuscript_page.html');
            fs.writeFileSync(workingHtmlPath, html);
            console.log(`💾 Working manuscript HTML saved to: ${workingHtmlPath}`);
            
            // Look for IIIF URLs specifically
            const iiifMatches = html.match(/iiif\/[^"'\s]+/gi) || [];
            console.log(`\n🎯 IIIF references found: ${iiifMatches.length}`);
            iiifMatches.slice(0, 10).forEach((match, index) => {
                console.log(`  ${index + 1}. ${match}`);
            });
        }
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

// Run if called directly
if (require.main === module) {
    examineHtmlContent().catch(console.error);
}

module.exports = { examineHtmlContent };