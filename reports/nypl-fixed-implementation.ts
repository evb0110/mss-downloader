/**
 * FIXED NYPL Implementation - Gets all pages instead of just carousel (15 pages)
 * 
 * ISSUE: Original implementation only used carousel data (limited to 15 visible thumbnails)
 * SOLUTION: Use NYPL's captures API endpoint to get complete manuscript data
 * 
 * This fix resolves the critical issue where 95% of NYPL manuscript pages were missing
 */
async loadNyplManifest(nyplUrl: string): Promise<ManuscriptManifest> {
    try {
        // Extract UUID from URL like https://digitalcollections.nypl.org/items/6a709e10-1cda-013b-b83f-0242ac110002
        const uuidMatch = nyplUrl.match(/\/items\/([a-f0-9-]+)/);
        if (!uuidMatch) {
            throw new Error('Invalid NYPL URL format');
        }
        
        const uuid = uuidMatch[1];
        
        // Fetch the main page to extract parent collection data
        const pageResponse = await this.fetchDirect(nyplUrl);
        if (!pageResponse.ok) {
            throw new Error(`Failed to fetch NYPL page: ${pageResponse.status}`);
        }
        
        const pageContent = await pageResponse.text();
        
        // Extract parent UUID from captures API endpoint in the page data
        const capturesUrlMatch = pageContent.match(/data-fetch-url="([^"]*\/items\/([a-f0-9-]+)\/captures[^"]*)"/);
        let pageLinks: string[] = [];
        let displayName = `NYPL Document ${uuid}`;
        
        if (capturesUrlMatch) {
            const capturesPath = capturesUrlMatch[1];
            const parentUuid = capturesUrlMatch[2];
            
            console.log(`NYPL: Found parent collection ${parentUuid}, fetching complete manifest`);
            
            try {
                // Call the captures API to get all pages
                const capturesUrl = `https://digitalcollections.nypl.org${capturesPath}?per_page=500`;
                const capturesResponse = await this.fetchDirect(capturesUrl);
                
                if (capturesResponse.ok) {
                    const capturesData = await capturesResponse.json();
                    
                    if (capturesData.response?.captures && Array.isArray(capturesData.response.captures)) {
                        const captures = capturesData.response.captures;
                        
                        console.log(`NYPL: Retrieved ${captures.length} pages from captures API (total: ${capturesData.response.total})`);
                        
                        // Extract image IDs and construct high-resolution image URLs
                        pageLinks = captures.map((item: any) => {
                            if (!item.image_id) {
                                throw new Error(`Missing image_id for capture ${item.id || 'unknown'}`);
                            }
                            // Use images.nypl.org format for full resolution images (&t=g parameter)
                            return `https://images.nypl.org/index.php?id=${item.image_id}&t=g`;
                        });
                        
                        // Extract display name from the first capture
                        if (captures[0]?.title) {
                            displayName = captures[0].title;
                        }
                    }
                }
            } catch (apiError: any) {
                console.warn(`NYPL: Captures API failed (${apiError.message}), falling back to carousel data`);
            }
        }
        
        // Fallback to original carousel method if captures API failed or no data
        if (pageLinks.length === 0) {
            console.log('NYPL: Using fallback carousel data method');
            
            // Extract carousel data which contains image IDs
            const carouselMatch = pageContent.match(/data-items="([^"]+)"/);
            if (!carouselMatch) {
                throw new Error('Could not find carousel data in NYPL page');
            }
            
            // Decode HTML entities and parse JSON
            const carouselDataHtml = carouselMatch[1];
            const carouselDataJson = carouselDataHtml
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&amp;/g, '&');
            
            let carouselItems;
            try {
                carouselItems = JSON.parse(carouselDataJson);
            } catch (error: any) {
                throw new Error(`Failed to parse carousel JSON: ${error.message}`);
            }
            
            if (!Array.isArray(carouselItems) || carouselItems.length === 0) {
                throw new Error('No carousel items found');
            }
            
            // Extract image IDs and construct high-resolution image URLs
            pageLinks = carouselItems.map((item: any) => {
                if (!item.image_id) {
                    throw new Error(`Missing image_id for item ${item.id || 'unknown'}`);
                }
                // Use images.nypl.org format for full resolution images (&t=g parameter)
                return `https://images.nypl.org/index.php?id=${item.image_id}&t=g`;
            });
            
            // Extract display name from the first item or fallback to title from item_data
            if (carouselItems[0]?.title_full) {
                displayName = carouselItems[0].title_full;
            } else if (carouselItems[0]?.title) {
                displayName = carouselItems[0].title;
            } else {
                // Fallback: try to extract from item_data as well
                const itemDataMatch = pageContent.match(/var\s+item_data\s*=\s*({.*?});/s);
                if (itemDataMatch) {
                    try {
                        const itemData = JSON.parse(itemDataMatch[1]);
                        if (itemData.title) {
                            displayName = Array.isArray(itemData.title) ? itemData.title[0] : itemData.title;
                        }
                    } catch {
                        // Ignore parsing errors for fallback title
                    }
                }
            }
            
            console.warn(`NYPL: Using carousel fallback method - got ${pageLinks.length} pages. If this manuscript has more pages, there may be an issue with the captures API.`);
        }
        
        if (pageLinks.length === 0) {
            throw new Error('No pages found in NYPL manifest');
        }
        
        const nyplManifest = {
            pageLinks,
            totalPages: pageLinks.length,
            library: 'nypl' as const,
            displayName,
            originalUrl: nyplUrl,
        };
        
        console.log(`NYPL: Created manifest for "${displayName}" with ${pageLinks.length} pages`);
        
        return nyplManifest;
        
    } catch (error: any) {
        console.error(`Failed to load NYPL manifest: ${error.message}`);
        throw error;
    }
}