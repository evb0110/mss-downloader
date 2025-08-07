// ULTRA-PRIORITY FIX for Issue #5: Florence Library
// Problem: Compound object detection fails, only showing 1 page when there are many

// Enhanced compound object detection for Florence ContentDM
async function detectFlorenceCompoundObjectEnhanced(itemId) {
    console.log('[Florence] Enhanced compound object detection for item:', itemId);
    
    const pageUrl = `https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/${itemId}`;
    const pageResponse = await fetch(pageUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
    });
    
    if (!pageResponse.ok) {
        throw new Error(`Failed to fetch Florence page: ${pageResponse.status}`);
    }
    
    const html = await pageResponse.text();
    const images = [];
    
    // Method 1: Look for compound object data in JavaScript
    const compoundDataMatch = html.match(/compoundObjectData\s*=\s*(\{[\s\S]*?\});/);
    if (compoundDataMatch) {
        try {
            const compoundData = JSON.parse(compoundDataMatch[1]);
            console.log('[Florence] Found compound object data in JavaScript');
            if (compoundData.pages || compoundData.items || compoundData.children) {
                const items = compoundData.pages || compoundData.items || compoundData.children;
                for (const item of items) {
                    const pageId = item.id || item.pageId || item.itemId;
                    if (pageId) {
                        images.push({
                            url: `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${pageId}/full/max/0/default.jpg`,
                            label: item.title || item.label || `Page ${images.length + 1}`
                        });
                    }
                }
            }
        } catch (e) {
            console.log('[Florence] Failed to parse compound data:', e.message);
        }
    }
    
    // Method 2: Look for parent ID and fetch parent with better parsing
    if (images.length === 0) {
        const parentIdMatch = html.match(/parentId['"]?\s*:\s*(\d+)|parent_id['"]?\s*:\s*(\d+)/i);
        if (parentIdMatch) {
            const parentId = parentIdMatch[1] || parentIdMatch[2];
            console.log(`[Florence] Found parent ID: ${parentId}, fetching parent page...`);
            
            try {
                const parentUrl = `https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/${parentId}`;
                const parentResponse = await fetch(parentUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                if (parentResponse.ok) {
                    const parentHtml = await parentResponse.text();
                    
                    // Look for ContentDM's JSON data embedded in the page
                    const jsonDataMatch = parentHtml.match(/window\.digitalCollections\s*=\s*(\{[\s\S]*?\});|CONTENTdm\.item\s*=\s*(\{[\s\S]*?\});/);
                    if (jsonDataMatch) {
                        try {
                            const jsonData = JSON.parse(jsonDataMatch[1] || jsonDataMatch[2]);
                            if (jsonData.children || jsonData.pages) {
                                const children = jsonData.children || jsonData.pages;
                                console.log(`[Florence] Found ${children.length} children in JSON data`);
                                for (const child of children) {
                                    const childId = child.id || child.dmrecord;
                                    if (childId) {
                                        images.push({
                                            url: `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${childId}/full/max/0/default.jpg`,
                                            label: child.title || child.label || `Page ${images.length + 1}`
                                        });
                                    }
                                }
                            }
                        } catch (e) {
                            console.log('[Florence] Failed to parse parent JSON data:', e.message);
                        }
                    }
                    
                    // Alternative: Look for table of contents or navigation data
                    if (images.length === 0) {
                        const tocMatch = parentHtml.match(/tableOfContents|browseData|navigationData/i);
                        if (tocMatch) {
                            // Extract all item IDs from the parent page
                            const idMatches = [...parentHtml.matchAll(/\/id\/(\d+)["']/g)];
                            const uniqueIds = [...new Set(idMatches.map(m => m[1]))];
                            console.log(`[Florence] Found ${uniqueIds.length} unique IDs in parent page`);
                            
                            // Filter IDs that are close to the parent ID (likely children)
                            const parentNum = parseInt(parentId);
                            const childIds = uniqueIds.filter(id => {
                                const num = parseInt(id);
                                return num !== parentNum && Math.abs(num - parentNum) < 1000;
                            }).sort((a, b) => parseInt(a) - parseInt(b));
                            
                            for (const childId of childIds) {
                                images.push({
                                    url: `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${childId}/full/max/0/default.jpg`,
                                    label: `Page ${images.length + 1}`
                                });
                            }
                        }
                    }
                }
            } catch (parentError) {
                console.log('[Florence] Failed to fetch parent page:', parentError.message);
            }
        }
    }
    
    // Method 3: If still no images, use sequential ID generation from current ID
    if (images.length === 0) {
        console.log('[Florence] Falling back to sequential ID generation...');
        const baseId = parseInt(itemId);
        
        // Check how many sequential IDs are valid
        let validCount = 0;
        let maxToCheck = 10; // Quick check first
        
        for (let i = 0; i < maxToCheck; i++) {
            const testId = baseId + i;
            const testUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${testId}/info.json`;
            
            try {
                const response = await fetch(testUrl, { method: 'HEAD' });
                if (response.ok) {
                    validCount++;
                    images.push({
                        url: `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${testId}/full/max/0/default.jpg`,
                        label: `Page ${i + 1}`
                    });
                } else {
                    // Stop if we hit 2 invalid IDs in a row
                    if (i > 0 && !response.ok) {
                        const prevResponse = await fetch(
                            `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${baseId + i - 1}/info.json`,
                            { method: 'HEAD' }
                        );
                        if (!prevResponse.ok) break;
                    }
                }
            } catch (e) {
                console.log(`[Florence] Error checking ID ${testId}:`, e.message);
            }
        }
        
        // If we found valid sequential IDs, continue checking
        if (validCount >= 3) {
            console.log(`[Florence] Found ${validCount} sequential IDs, checking for more...`);
            
            // Continue checking in batches
            let consecutiveFails = 0;
            for (let i = maxToCheck; i < 500 && consecutiveFails < 3; i++) {
                const testId = baseId + i;
                const testUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${testId}/info.json`;
                
                try {
                    const response = await fetch(testUrl, { method: 'HEAD' });
                    if (response.ok) {
                        consecutiveFails = 0;
                        images.push({
                            url: `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${testId}/full/max/0/default.jpg`,
                            label: `Page ${images.length + 1}`
                        });
                    } else {
                        consecutiveFails++;
                    }
                } catch (e) {
                    consecutiveFails++;
                }
            }
        }
    }
    
    console.log(`[Florence] Enhanced detection found ${images.length} images`);
    return { images };
}

// Test the enhanced detection
async function testEnhancedDetection() {
    const itemId = '317515';
    console.log(`\nTesting enhanced detection for item ${itemId}...`);
    
    try {
        const result = await detectFlorenceCompoundObjectEnhanced(itemId);
        console.log(`\n✅ SUCCESS: Found ${result.images.length} images`);
        
        if (result.images.length > 0) {
            console.log('\nFirst 5 images:');
            result.images.slice(0, 5).forEach((img, i) => {
                console.log(`  ${i + 1}. ${img.label}: ${img.url}`);
            });
        }
    } catch (error) {
        console.log(`\n❌ ERROR: ${error.message}`);
    }
}

testEnhancedDetection().catch(console.error);