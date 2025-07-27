const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Test URL from user report (only finding 1 page)
const testUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve({ ok: response.statusCode === 200, text: () => data, status: response.statusCode }));
        }).on('error', reject);
    });
}

async function testMorganFix() {
    console.log('Testing Morgan Library page detection fix...\n');
    console.log('Test URL:', testUrl);
    
    // Test 1: Check URL format
    const singlePageMatch = testUrl.match(/\/collection\/([^/]+)\/(\d+)/);
    const thumbsMatch = testUrl.match(/\/collection\/([^/]+)\/thumbs/);
    
    let manuscriptId = '';
    if (singlePageMatch) {
        console.log('✓ Detected single page URL');
        console.log('  Manuscript ID:', singlePageMatch[1]);
        console.log('  Page number:', singlePageMatch[2]);
        manuscriptId = singlePageMatch[1];
    } else if (thumbsMatch) {
        console.log('✓ Detected thumbs URL');
        console.log('  Manuscript ID:', thumbsMatch[1]);
        manuscriptId = thumbsMatch[1];
    }
    
    // Test 2: Fetch the thumbs page
    const thumbsUrl = testUrl.includes('/thumbs') ? testUrl : `https://www.themorgan.org/collection/${manuscriptId}/thumbs`;
    console.log('\nFetching thumbs page:', thumbsUrl);
    
    try {
        const response = await fetchUrl(thumbsUrl);
        console.log('Thumbs page status:', response.status);
        
        if (response.ok) {
            const pageContent = await response.text();
            console.log('Thumbs page size:', pageContent.length, 'bytes');
            
            // Test page detection patterns
            const patterns = [
                { name: 'Basic pattern', regex: new RegExp(`\\/collection\\/${manuscriptId}\\/(\\d+)`, 'g') },
                { name: 'Href pattern', regex: new RegExp(`href="[^"]*\\/collection\\/${manuscriptId}\\/(\\d+)[^"]*"`, 'g') },
                { name: 'Data-page pattern', regex: /data-page="(\d+)"/g },
                { name: 'Page pattern', regex: /page-(\d+)/g },
                { name: 'Thumbnail grid', regex: new RegExp(`<a[^>]+href="[^"]*\\/collection\\/${manuscriptId}\\/(\\d+)[^"]*"[^>]*>\\s*<img`, 'g') },
                { name: 'Data-id pattern', regex: /data-id="(\d+)"/g }
            ];
            
            console.log('\nTesting page detection patterns:');
            let allPages = [];
            
            for (const pattern of patterns) {
                const matches = [...pageContent.matchAll(pattern.regex)];
                const pageNumbers = matches.map(m => m[1]);
                console.log(`  ${pattern.name}: ${pageNumbers.length} matches`);
                if (pageNumbers.length > 0) {
                    console.log(`    Sample pages: ${pageNumbers.slice(0, 5).join(', ')}${pageNumbers.length > 5 ? '...' : ''}`);
                }
                allPages.push(...pageNumbers);
            }
            
            // Remove duplicates
            const uniquePages = [...new Set(allPages)].sort((a, b) => parseInt(a) - parseInt(b));
            console.log(`\n✓ Total unique pages found: ${uniquePages.length}`);
            if (uniquePages.length > 0) {
                console.log(`  Page range: ${uniquePages[0]} - ${uniquePages[uniquePages.length - 1]}`);
            }
            
            // Test 3: Check if facsimile images exist for pages
            if (uniquePages.length > 0) {
                console.log('\nChecking facsimile images for first 3 pages:');
                for (const pageNum of uniquePages.slice(0, 3)) {
                    const pageUrl = `https://www.themorgan.org/collection/${manuscriptId}/${pageNum}`;
                    console.log(`\n  Fetching page ${pageNum}...`);
                    
                    try {
                        const pageResponse = await fetchUrl(pageUrl);
                        if (pageResponse.ok) {
                            const individualPageContent = await pageResponse.text();
                            
                            // Look for facsimile images
                            const facsimileMatch = individualPageContent.match(/\/sites\/default\/files\/facsimile\/[^"']+\/([^"']+\.jpg)/);
                            if (facsimileMatch) {
                                console.log(`    ✓ Found facsimile image: ${facsimileMatch[1]}`);
                            } else {
                                console.log('    ✗ No facsimile image found');
                            }
                            
                            // Check for other image types
                            const imagePatterns = [
                                { name: 'ZIF', regex: /\/facsimile\/images\/[^"']+\.zif/g },
                                { name: 'Collection', regex: /\/images\/collection\/[^"']+\.jpg/g },
                                { name: 'Styled', regex: /\/sites\/default\/files\/styles\/[^"']+\.jpg/g }
                            ];
                            
                            for (const pattern of imagePatterns) {
                                const imgMatches = individualPageContent.match(pattern.regex);
                                if (imgMatches) {
                                    console.log(`    Found ${pattern.name}: ${imgMatches.length} images`);
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`    Error fetching page: ${error.message}`);
                    }
                    
                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
            
        } else {
            console.log('✗ Failed to fetch thumbs page');
            
            // Test fallback: Check single page for navigation info
            console.log('\nTesting fallback: checking single page for navigation...');
            const singlePageResponse = await fetchUrl(testUrl);
            
            if (singlePageResponse.ok) {
                const content = await singlePageResponse.text();
                
                // Look for total pages info
                const patterns = [
                    /of\s+(\d+)/i,
                    /(\d+)\s*pages?/i,
                    /page\s+\d+\s*\/\s*(\d+)/i,
                    />(\d+)<\/[^>]+>\s*pages/i
                ];
                
                for (const pattern of patterns) {
                    const match = content.match(pattern);
                    if (match) {
                        console.log(`✓ Found total pages indicator: "${match[0]}" → ${match[1]} pages`);
                        break;
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('Test error:', error.message);
    }
}

// Run the test
testMorganFix().catch(console.error);