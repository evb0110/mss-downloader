const https = require('https');
const { URL } = require('url');

async function fetchDirect(url) {
    return new Promise((resolve, reject) => {
        const options = {
            ...new URL(url),
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    text: () => Promise.resolve(data),
                    json: () => Promise.resolve(JSON.parse(data))
                });
            });
        });

        req.on('error', (error) => {
            console.error('Request error:', error);
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

async function testMdcCatalonia() {
    console.log('Testing MDC Catalonia with URL: https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1');
    
    try {
        const originalUrl = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';
        
        // Extract collection and item ID from URL
        const urlMatch = originalUrl.match(/mdc\.csuc\.cat\/digital\/collection\/([^\/]+)\/id\/(\d+)(?:\/rec\/(\d+))?/);
        if (!urlMatch) {
            throw new Error('Could not extract collection and item ID from MDC Catalonia URL');
        }
        
        const collection = urlMatch[1];
        const itemId = urlMatch[2];
        console.log(`Extracting MDC Catalonia: collection=${collection}, itemId=${itemId}`);
        
        // Step 1: Test compound object structure using CONTENTdm API
        const compoundUrl = `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/${collection}/${itemId}/json`;
        console.log('Testing compound object structure:', compoundUrl);
        
        const compoundResponse = await fetchDirect(compoundUrl);
        console.log('Compound API response status:', compoundResponse.status);
        
        if (!compoundResponse.ok) {
            console.error(`Failed to fetch compound object info: ${compoundResponse.status}`);
            
            // Try alternative approach - direct IIIF endpoint test
            console.log('Testing direct IIIF endpoint fallback...');
            const iiifInfoUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/info.json`;
            console.log('Testing IIIF info:', iiifInfoUrl);
            
            const iiifResponse = await fetchDirect(iiifInfoUrl);
            console.log('IIIF info response status:', iiifResponse.status);
            
            if (iiifResponse.ok) {
                const iiifInfo = await iiifResponse.json();
                console.log('IIIF info received:', iiifInfo);
                
                // Test maximum resolution image
                const imageUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/full/max/0/default.jpg`;
                console.log('Testing image URL:', imageUrl);
                
                const imageResponse = await fetchDirect(imageUrl);
                console.log('Image response status:', imageResponse.status);
                
                if (imageResponse.ok) {
                    console.log('✅ Single page manuscript access successful');
                    console.log(`Image dimensions: ${iiifInfo.width}x${iiifInfo.height} pixels`);
                }
            }
            
            return;
        }
        
        const compoundData = await compoundResponse.json();
        console.log('Compound data structure:', JSON.stringify(compoundData, null, 2));
        
        // Check if this is a compound object with multiple pages
        let pageArray = compoundData.page;
        if (!pageArray && compoundData.node && compoundData.node.page) {
            pageArray = compoundData.node.page;
        }
        
        if (!pageArray || !Array.isArray(pageArray)) {
            console.log('Not a compound object, treating as single page document');
            
            // Try to get IIIF info for single page
            const iiifInfoUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/info.json`;
            console.log('Testing single page IIIF:', iiifInfoUrl);
            
            const infoResponse = await fetchDirect(iiifInfoUrl);
            console.log('Single page IIIF response status:', infoResponse.status);
            
            if (infoResponse.ok) {
                const iiifInfo = await infoResponse.json();
                console.log('Single page IIIF info:', iiifInfo);
                
                const singleImageUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/full/max/0/default.jpg`;
                console.log('Testing single image URL:', singleImageUrl);
                
                const imageResponse = await fetchDirect(singleImageUrl);
                console.log('Single image response status:', imageResponse.status);
                
                if (imageResponse.ok) {
                    console.log('✅ Single page manuscript successful');
                    console.log(`Image dimensions: ${iiifInfo.width}x${iiifInfo.height} pixels`);
                }
            }
            return;
        }
        
        // Process compound object pages
        console.log(`Found compound object with ${pageArray.length} pages`);
        let validPages = 0;
        
        for (let i = 0; i < Math.min(pageArray.length, 3); i++) {
            const page = pageArray[i];
            if (!page.pageptr) {
                console.log(`Skipping page without pageptr: ${JSON.stringify(page)}`);
                continue;
            }
            
            const pageId = page.pageptr;
            const iiifInfoUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${pageId}/info.json`;
            
            try {
                console.log(`Testing page ${i + 1}: ${iiifInfoUrl}`);
                const iiifResponse = await fetchDirect(iiifInfoUrl);
                console.log(`Page ${i + 1} IIIF response status:`, iiifResponse.status);
                
                if (iiifResponse.ok) {
                    const iiifData = await iiifResponse.json();
                    console.log(`Page ${i + 1} IIIF info:`, iiifData);
                    
                    // Test maximum resolution image
                    const imageUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${pageId}/full/max/0/default.jpg`;
                    console.log(`Testing page ${i + 1} image:`, imageUrl);
                    
                    const imageResponse = await fetchDirect(imageUrl);
                    console.log(`Page ${i + 1} image response status:`, imageResponse.status);
                    
                    if (imageResponse.ok) {
                        validPages++;
                        console.log(`✅ Page ${i + 1} successful - ${iiifData.width}x${iiifData.height}px`);
                    }
                }
                
            } catch (error) {
                console.warn(`Error processing page ${pageId}: ${error.message}`);
            }
            
            // Small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`\n✅ MDC Catalonia test completed: ${validPages} valid pages found`);
        
    } catch (error) {
        console.error('❌ MDC Catalonia test failed:', error.message);
        console.error('Full error:', error);
    }
}

testMdcCatalonia().catch(console.error);