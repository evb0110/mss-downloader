const { execSync } = require('child_process');

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
        
        // Step 1: Test compound object structure using CONTENTdm API with curl
        const compoundUrl = `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/${collection}/${itemId}/json`;
        console.log('Testing compound object structure:', compoundUrl);
        
        try {
            const compoundResult = execSync(`curl -s -m 30 "${compoundUrl}"`, { encoding: 'utf8' });
            console.log('Compound API response received, length:', compoundResult.length);
            
            if (compoundResult.trim() === '') {
                throw new Error('Empty response from compound API');
            }
            
            const compoundData = JSON.parse(compoundResult);
            console.log('Compound data structure keys:', Object.keys(compoundData));
            
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
                
                try {
                    const iiifResult = execSync(`curl -s -m 30 "${iiifInfoUrl}"`, { encoding: 'utf8' });
                    console.log('Single page IIIF response received, length:', iiifResult.length);
                    
                    if (iiifResult.trim() !== '') {
                        const iiifInfo = JSON.parse(iiifResult);
                        console.log('Single page IIIF info:', iiifInfo);
                        
                        const singleImageUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/full/max/0/default.jpg`;
                        console.log('Testing single image URL:', singleImageUrl);
                        
                        // Test image accessibility
                        const imageTest = execSync(`curl -s -I -m 30 "${singleImageUrl}"`, { encoding: 'utf8' });
                        console.log('Single image response headers:', imageTest.split('\n')[0]);
                        
                        if (imageTest.includes('200 OK')) {
                            console.log('✅ Single page manuscript successful');
                            console.log(`Image dimensions: ${iiifInfo.width}x${iiifInfo.height} pixels`);
                        }
                    }
                } catch (error) {
                    console.error('Error testing single page IIIF:', error.message);
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
                    const iiifResult = execSync(`curl -s -m 30 "${iiifInfoUrl}"`, { encoding: 'utf8' });
                    console.log(`Page ${i + 1} IIIF response received, length:`, iiifResult.length);
                    
                    if (iiifResult.trim() !== '') {
                        const iiifData = JSON.parse(iiifResult);
                        console.log(`Page ${i + 1} IIIF info:`, iiifData);
                        
                        // Test maximum resolution image
                        const imageUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${pageId}/full/max/0/default.jpg`;
                        console.log(`Testing page ${i + 1} image:`, imageUrl);
                        
                        const imageTest = execSync(`curl -s -I -m 30 "${imageUrl}"`, { encoding: 'utf8' });
                        console.log(`Page ${i + 1} image response headers:`, imageTest.split('\n')[0]);
                        
                        if (imageTest.includes('200 OK')) {
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
            console.error('Error with compound API:', error.message);
            
            // Try direct IIIF endpoint as fallback
            console.log('Testing direct IIIF endpoint fallback...');
            const iiifInfoUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/info.json`;
            console.log('Testing IIIF info:', iiifInfoUrl);
            
            try {
                const iiifResult = execSync(`curl -s -m 30 "${iiifInfoUrl}"`, { encoding: 'utf8' });
                console.log('IIIF info response received, length:', iiifResult.length);
                
                if (iiifResult.trim() !== '') {
                    const iiifInfo = JSON.parse(iiifResult);
                    console.log('IIIF info received:', iiifInfo);
                    
                    // Test maximum resolution image
                    const imageUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/full/max/0/default.jpg`;
                    console.log('Testing image URL:', imageUrl);
                    
                    const imageTest = execSync(`curl -s -I -m 30 "${imageUrl}"`, { encoding: 'utf8' });
                    console.log('Image response headers:', imageTest.split('\n')[0]);
                    
                    if (imageTest.includes('200 OK')) {
                        console.log('✅ Single page manuscript access successful');
                        console.log(`Image dimensions: ${iiifInfo.width}x${iiifInfo.height} pixels`);
                    }
                }
            } catch (fallbackError) {
                console.error('Fallback IIIF test also failed:', fallbackError.message);
            }
        }
        
    } catch (error) {
        console.error('❌ MDC Catalonia test failed:', error.message);
        console.error('Full error:', error);
    }
}

testMdcCatalonia().catch(console.error);