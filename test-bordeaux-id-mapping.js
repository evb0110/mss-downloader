/**
 * Test script to discover Bordeaux ID mapping
 * The public URLs use one ID format, but tiles use another
 */

const https = require('https');
const fs = require('fs').promises;

async function fetchPage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        }, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                fetchPage(response.headers.location).then(resolve).catch(reject);
                return;
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }
            
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
                resolve(Buffer.concat(chunks).toString());
            });
            response.on('error', reject);
        }).on('error', reject);
    });
}

async function discoverBordeauxIdMapping() {
    console.log('🔍 Discovering Bordeaux ID mapping...\n');
    
    const testUrls = [
        {
            public: 'https://manuscrits.bordeaux.fr/ark:/26678/btv1b52509616g/f13.item.zoom',
            expected: '330636101_MS0778' // From our earlier test
        },
        {
            public: 'https://manuscrits.bordeaux.fr/ark:/26678/btv1b10509613h/f1.item.zoom',
            expected: 'Unknown'
        }
    ];
    
    for (const test of testUrls) {
        console.log(`\n📚 Testing: ${test.public}`);
        console.log(`   Expected tile ID: ${test.expected}`);
        
        try {
            // Fetch the main page
            const html = await fetchPage(test.public);
            
            // Look for various ID patterns in the HTML
            const patterns = [
                // Look for direct tile URLs
                /selene\.bordeaux\.fr\/in\/dz\/([^"'\/\s]+)_files/gi,
                /selene\.bordeaux\.fr\/in\/dz\/([^"'\/\s]+)\.dzi/gi,
                // Look for viewer initialization
                /viewerId['"]\s*:\s*['"]([^'"]+)/gi,
                /manuscriptId['"]\s*:\s*['"]([^'"]+)/gi,
                // Look for data attributes
                /data-manuscript-id=['"]([^'"]+)/gi,
                /data-tile-id=['"]([^'"]+)/gi,
                // Look for JavaScript variables
                /var\s+tileId\s*=\s*['"]([^'"]+)/gi,
                /tileSource['"]\s*:\s*['"]([^'"]+)/gi,
                // Look for iframe sources
                /iframe[^>]+src=['"]([^'"]*selene[^'"]+)/gi,
                // Look for any reference to MS numbers
                /(\d{9}_MS\d+)/gi,
                // Look for Mirador viewer config
                /data-config=['"]([^'"]+)/gi,
                /miradorConfig[^{]*{[^}]*id['"]\s*:\s*['"]([^'"]+)/gi
            ];
            
            const foundIds = new Set();
            
            for (const pattern of patterns) {
                let match;
                while ((match = pattern.exec(html)) !== null) {
                    if (match[1]) {
                        foundIds.add(match[1]);
                    }
                }
            }
            
            console.log(`   Found IDs/patterns: ${foundIds.size > 0 ? Array.from(foundIds).join(', ') : 'None'}`);
            
            // Look specifically for iframe viewer URL
            const iframeMatch = html.match(/<iframe[^>]+src=['"]([^'"]+)/i);
            if (iframeMatch) {
                console.log(`   Iframe URL: ${iframeMatch[1]}`);
                
                // If iframe URL is relative or from selene domain, fetch it
                if (iframeMatch[1].includes('selene') || !iframeMatch[1].startsWith('http')) {
                    const iframeUrl = iframeMatch[1].startsWith('http') 
                        ? iframeMatch[1] 
                        : `https://selene.bordeaux.fr${iframeMatch[1].startsWith('/') ? '' : '/'}${iframeMatch[1]}`;
                    
                    try {
                        console.log(`   Fetching iframe content from: ${iframeUrl}`);
                        const iframeHtml = await fetchPage(iframeUrl);
                        
                        // Look for OpenSeadragon config in iframe
                        const osdConfigMatch = iframeHtml.match(/tileSources['"]\s*:\s*\[([^\]]+)\]/);
                        if (osdConfigMatch) {
                            console.log(`   Found OpenSeadragon config`);
                            
                            // Extract tile source
                            const tileSourceMatch = osdConfigMatch[1].match(/['"]([^'"]+\.dzi)['"]/);
                            if (tileSourceMatch) {
                                console.log(`   Tile source: ${tileSourceMatch[1]}`);
                                
                                // Extract ID from tile source
                                const idMatch = tileSourceMatch[1].match(/\/([^\/]+)\.dzi$/);
                                if (idMatch) {
                                    console.log(`   ✅ Extracted tile ID: ${idMatch[1]}`);
                                }
                            }
                        }
                        
                        // Also look for direct DZI references
                        const dziMatches = iframeHtml.match(/\/in\/dz\/([^"'\/\s]+)\.dzi/gi);
                        if (dziMatches) {
                            console.log(`   Found DZI references: ${dziMatches.length}`);
                            dziMatches.forEach(dzi => {
                                const id = dzi.match(/\/([^\/]+)\.dzi$/);
                                if (id) console.log(`   ✅ DZI ID: ${id[1]}`);
                            });
                        }
                        
                    } catch (iframeError) {
                        console.log(`   Could not fetch iframe: ${iframeError.message}`);
                    }
                }
            }
            
            // Save HTML for manual inspection
            const filename = test.public.includes('btv1b52509616g') ? 'page1.html' : 'page2.html';
            await fs.writeFile(filename, html);
            console.log(`   Saved HTML to ${filename} for inspection`);
            
        } catch (error) {
            console.error(`   Error: ${error.message}`);
        }
    }
    
    console.log('\n\n📝 Summary:');
    console.log('Bordeaux appears to use an iframe-based viewer that loads tiles from selene.bordeaux.fr');
    console.log('The mapping between public IDs and tile IDs needs to be extracted from the iframe content');
}

// Run the discovery
discoverBordeauxIdMapping().catch(console.error);