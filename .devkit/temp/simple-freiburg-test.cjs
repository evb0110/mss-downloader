const https = require('https');

async function testFreiburgMets() {
    console.log('=== Simple Freiburg METS Test ===\n');
    
    try {
        // Fetch METS XML
        const xmlContent = await new Promise((resolve, reject) => {
            https.get('https://dl.ub.uni-freiburg.de/diglitData/mets/hs360a.xml', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
        
        console.log('✅ METS XML fetched successfully\n');
        
        // Simple approach: extract all FLocat elements with hrefs
        const hrefRegex = /<mets:FLocat[^>]*xlink:href="([^"]*)"[^>]*\/?>/g;
        const allHrefs = [];
        let match;
        
        while ((match = hrefRegex.exec(xmlContent)) !== null) {
            allHrefs.push(match[1]);
        }
        
        console.log(`Found ${allHrefs.length} image URLs\n`);
        
        // Group by directory (resolution level)
        const byResolution = {};
        allHrefs.forEach(href => {
            const parts = href.split('/');
            if (parts.length >= 2) {
                const resolution = parts[parts.length - 2]; // e.g., "1", "2", "3", "4", "5", "6"
                if (!byResolution[resolution]) byResolution[resolution] = [];
                
                const filename = parts[parts.length - 1];
                const pageId = filename.replace(/\.(jpg|jpeg|tif|tiff)$/i, '');
                
                byResolution[resolution].push({
                    href,
                    filename,
                    pageId,
                    isStandard: pageId.match(/^\d+[rv]$/) !== null
                });
            }
        });
        
        // Display resolution groups
        console.log('Resolution groups found:');
        Object.keys(byResolution).forEach(res => {
            console.log(`  Level ${res}: ${byResolution[res].length} images`);
        });
        console.log('');
        
        // Find highest resolution (usually the highest number)
        const resolutionLevels = Object.keys(byResolution).map(Number).sort((a, b) => b - a);
        const highestRes = resolutionLevels[0].toString();
        
        console.log(`Using highest resolution level: ${highestRes}\n`);
        
        const pages = byResolution[highestRes];
        const standardPages = pages.filter(p => p.isStandard);
        const specialPages = pages.filter(p => !p.isStandard);
        
        console.log(`Total pages: ${pages.length}`);
        console.log(`Standard pages (###r/v): ${standardPages.length}`);
        console.log(`Special pages: ${specialPages.length}\n`);
        
        // Test sample URLs
        console.log('Testing sample URLs:\n');
        
        const testUrls = pages.slice(0, 10);
        const results = [];
        
        for (const page of testUrls) {
            try {
                const result = await new Promise((resolve) => {
                    const req = https.request(page.href, { method: 'HEAD' }, (res) => {
                        resolve({
                            pageId: page.pageId,
                            status: res.statusCode,
                            size: res.headers['content-length'],
                            success: res.statusCode === 200
                        });
                    });
                    
                    req.on('error', () => {
                        resolve({
                            pageId: page.pageId,
                            success: false,
                            error: 'Request failed'
                        });
                    });
                    
                    req.setTimeout(5000, () => {
                        req.destroy();
                        resolve({
                            pageId: page.pageId,
                            success: false,
                            error: 'Timeout'
                        });
                    });
                    
                    req.end();
                });
                
                results.push(result);
                
                if (result.success) {
                    const sizeKB = Math.round(parseInt(result.size) / 1024);
                    console.log(`✅ ${result.pageId}: ${result.status} (${sizeKB}KB)`);
                } else {
                    console.log(`❌ ${result.pageId}: ${result.error || 'Failed'}`);
                }
                
            } catch (error) {
                console.log(`❌ ${page.pageId}: Exception`);
                results.push({
                    pageId: page.pageId,
                    success: false,
                    error: 'Exception'
                });
            }
        }
        
        // Summary
        const successRate = results.filter(r => r.success).length / results.length;
        
        console.log(`\n=== Test Results ===`);
        console.log(`Success rate: ${Math.round(successRate * 100)}%`);
        console.log(`Total pages available: ${pages.length}`);
        console.log(`Resolution level: ${highestRes}`);
        
        if (successRate >= 0.8) {
            console.log('\n✅ Freiburg METS implementation is viable');
            console.log('✅ Ready for integration into manuscript downloader');
            
            return {
                success: true,
                totalPages: pages.length,
                standardPages: standardPages.length,
                specialPages: specialPages.length,
                resolutionLevel: highestRes,
                successRate,
                sampleUrls: pages.slice(0, 5).map(p => p.href)
            };
        } else {
            console.log('\n❌ Implementation needs refinement');
            return {
                success: false,
                successRate,
                resolutionLevel: highestRes
            };
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
        return { success: false, error: error.message };
    }
}

if (require.main === module) {
    testFreiburgMets().then(result => {
        if (result.success) {
            console.log('\n📋 Implementation Summary:');
            console.log('1. Parse METS XML to extract all FLocat hrefs');
            console.log('2. Group by resolution level (highest number = best quality)');
            console.log('3. Use direct URLs from METS XML');
            console.log('4. Handle standard (###r/v) and special pages separately');
            console.log('5. Maximum resolution images confirmed accessible');
        }
    }).catch(console.error);
}