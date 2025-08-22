#!/usr/bin/env bun

/**
 * Debug what page ID corresponds to the page 2 URL the user provided
 */

async function debugPage2() {
    console.log('🔍 DEBUGGING PAGE 2 URL FROM USER');
    console.log('==================================\n');
    
    const userProvidedUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217710/rec/2';
    console.log(`User provided URL: ${userProvidedUrl}`);
    console.log('This should be page 2 of the manuscript\n');
    
    // Fetch the page HTML to see what ContentDM shows as page 2
    try {
        const response = await fetch(userProvidedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Referer': 'https://cdm21059.contentdm.oclc.org/',
            }
        });
        
        if (response.ok) {
            const html = await response.text();
            
            // Extract the actual image URL that ContentDM serves for this page
            const iiifMatch = html.match(/https:\/\/cdm21059\.contentdm\.oclc\.org\/iiif\/2\/plutei:(\d+)\/full\/[^"]+/);
            
            if (iiifMatch) {
                const pageId = iiifMatch[1];
                const fullImageUrl = iiifMatch[0];
                
                console.log(`✅ Found actual page 2 details:`);
                console.log(`   ContentDM Page ID: ${pageId}`);
                console.log(`   IIIF Image URL: ${fullImageUrl}`);
                
                // Test if this image URL actually works
                console.log(`\n📋 Testing if page 2 image is actually accessible...`);
                
                try {
                    const imageResponse = await fetch(fullImageUrl.replace('/full/', '/full/4000,/0/default.jpg'), {
                        method: 'HEAD',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                            'Accept': 'image/*,*/*;q=0.8',
                            'Referer': 'https://cdm21059.contentdm.oclc.org/',
                        }
                    });
                    
                    if (imageResponse.ok) {
                        const size = imageResponse.headers.get('content-length');
                        console.log(`✅ PAGE 2 IMAGE IS ACCESSIBLE!`);
                        console.log(`   Status: ${imageResponse.status} ${imageResponse.statusText}`);
                        console.log(`   Size: ${size ? Math.round(parseInt(size) / 1024) + 'KB' : 'unknown'}`);
                        console.log(`\n🚨 THIS PROVES MY DOWNLOAD LOGIC FAILED TO GET PAGE 2!`);
                        
                        return {
                            accessible: true,
                            pageId: pageId,
                            imageUrl: fullImageUrl.replace('/full/', '/full/4000,/0/default.jpg')
                        };
                    } else {
                        console.log(`❌ Page 2 image not accessible: ${imageResponse.status} ${imageResponse.statusText}`);
                        return {
                            accessible: false,
                            pageId: pageId,
                            error: `${imageResponse.status} ${imageResponse.statusText}`
                        };
                    }
                } catch (error) {
                    console.log(`💥 Error testing page 2 image: ${error instanceof Error ? error.message : String(error)}`);
                    return {
                        accessible: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
                
            } else {
                console.log('❌ Could not find IIIF image URL in page HTML');
                
                // Look for __INITIAL_STATE__ data
                const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*JSON\.parse\("(.+?)"\);/);
                if (stateMatch) {
                    console.log('📋 Found __INITIAL_STATE__ data - the page exists in ContentDM');
                    console.log('This confirms page 2 exists, my extraction logic failed');
                }
                
                return { accessible: false, error: 'IIIF URL not found in HTML' };
            }
            
        } else {
            console.log(`❌ Could not fetch page 2 HTML: ${response.status} ${response.statusText}`);
            return { accessible: false, error: `${response.status} ${response.statusText}` };
        }
        
    } catch (error) {
        console.error(`💥 Error fetching page 2: ${error instanceof Error ? error.message : String(error)}`);
        return { accessible: false, error: error instanceof Error ? error.message : String(error) };
    }
}

debugPage2().then(result => {
    if (result.accessible) {
        console.log(`\n🎯 CONCLUSION: PAGE 2 EXISTS AND IS ACCESSIBLE`);
        console.log(`My download logic incorrectly filtered it out!`);
        console.log(`The 72% success rate is artificially low due to filtering bugs.`);
        console.log(`\nACTION REQUIRED: Fix the download/filtering logic to include all accessible pages.`);
    } else {
        console.log(`\n🎯 CONCLUSION: Page 2 genuinely inaccessible`);
        console.log(`Error: ${result.error}`);
        console.log(`This would explain why it wasn't downloaded.`);
    }
});