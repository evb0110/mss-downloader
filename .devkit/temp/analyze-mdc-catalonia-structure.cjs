const https = require('https');
const { execSync } = require('child_process');

async function analyzeMDCCataloniaStructure() {
    console.log('=== MDC Catalonia Structure Analysis ===');
    
    const collection = 'incunableBC';
    const itemId = '175331';
    
    // Get compound object info
    const compoundUrl = `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/${collection}/${itemId}/json`;
    console.log('Fetching compound object info...');
    
    try {
        const curlCmd = `curl -s -m 30 --retry 2 --retry-delay 1 -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${compoundUrl}"`;
        const result = execSync(curlCmd, { encoding: 'utf8', timeout: 35000 });
        
        const compoundData = JSON.parse(result);
        console.log('✅ Compound object structure obtained');
        console.log('Type:', compoundData.type);
        console.log('Number of pages:', compoundData.page ? compoundData.page.length : 'N/A');
        
        if (compoundData.page && Array.isArray(compoundData.page)) {
            console.log('\n--- Page Structure Analysis ---');
            console.log('First 5 pages:');
            
            for (let i = 0; i < Math.min(5, compoundData.page.length); i++) {
                const page = compoundData.page[i];
                console.log(`Page ${i + 1}:`, {
                    pageptr: page.pageptr,
                    pagetitle: page.pagetitle,
                    pagefile: page.pagefile
                });
            }
            
            console.log('\n--- Testing IIIF endpoints for first few pages ---');
            
            for (let i = 0; i < Math.min(3, compoundData.page.length); i++) {
                const page = compoundData.page[i];
                const pageId = page.pageptr;
                
                console.log(`\nTesting page ${i + 1} (pageptr: ${pageId}):`);
                
                // Test IIIF info endpoint
                const iiifInfoUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${pageId}/info.json`;
                console.log(`IIIF Info URL: ${iiifInfoUrl}`);
                
                try {
                    const iiifCmd = `curl -s -m 30 "${iiifInfoUrl}"`;
                    const iiifResult = execSync(iiifCmd, { encoding: 'utf8', timeout: 35000 });
                    console.log('IIIF Info response:', iiifResult.substring(0, 200));
                    
                    // Try to parse as JSON
                    try {
                        const iiifData = JSON.parse(iiifResult);
                        console.log('✅ IIIF Info parsed successfully');
                        console.log('Image dimensions:', iiifData.width, 'x', iiifData.height);
                    } catch (e) {
                        console.log('❌ IIIF Info not JSON:', e.message);
                    }
                } catch (error) {
                    console.log('❌ IIIF Info request failed:', error.message);
                }
                
                // Test different image URL patterns
                const imageUrls = [
                    `https://mdc.csuc.cat/iiif/2/${collection}:${pageId}/full/,2000/0/default.jpg`,
                    `https://mdc.csuc.cat/iiif/2/${collection}:${pageId}/full/full/0/default.jpg`,
                    `https://mdc.csuc.cat/iiif/2/${collection}:${pageId}/full/max/0/default.jpg`,
                    `https://mdc.csuc.cat/digital/api/singleitem/image/${collection}/${pageId}/default.jpg`
                ];
                
                for (const imageUrl of imageUrls) {
                    console.log(`Testing image URL: ${imageUrl}`);
                    try {
                        const imageCmd = `curl -s -I -m 10 "${imageUrl}"`;
                        const imageResult = execSync(imageCmd, { encoding: 'utf8', timeout: 15000 });
                        
                        const statusLine = imageResult.split('\n')[0];
                        console.log('Status:', statusLine);
                        
                        if (statusLine.includes('200')) {
                            console.log('✅ Image URL works');
                        } else {
                            console.log('❌ Image URL failed');
                        }
                    } catch (error) {
                        console.log('❌ Image URL test failed:', error.message);
                    }
                }
            }
        }
        
        // Test alternative API endpoints
        console.log('\n--- Testing Alternative API Endpoints ---');
        
        const alternativeUrls = [
            `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetItemInfo/${collection}/${itemId}/json`,
            `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCollectionParameters/${collection}/json`,
            `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmQuery/${collection}/title/*/title/5/0/0/0/0/json`
        ];
        
        for (const url of alternativeUrls) {
            console.log(`\nTesting: ${url}`);
            try {
                const cmd = `curl -s -m 30 "${url}"`;
                const result = execSync(cmd, { encoding: 'utf8', timeout: 35000 });
                
                try {
                    const parsed = JSON.parse(result);
                    console.log('✅ Success - JSON keys:', Object.keys(parsed));
                } catch (e) {
                    console.log('❌ Response not JSON:', result.substring(0, 200));
                }
            } catch (error) {
                console.log('❌ Request failed:', error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Failed to analyze structure:', error.message);
    }
}

analyzeMDCCataloniaStructure().catch(console.error);