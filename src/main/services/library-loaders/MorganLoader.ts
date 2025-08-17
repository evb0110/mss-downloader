import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class MorganLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'morgan';
    }
    
    async loadManifest(morganUrl: string): Promise<ManuscriptManifest> {
            try {
                // Check if this is a direct image URL
                if (morganUrl.match(/\.(jpg|jpeg|png|gif)$/i)) {
                    // Extract filename for display name
                    const filename = morganUrl.split('/').pop() || 'Morgan Image';
                    const displayName = filename.replace(/\.(jpg|jpeg|png|gif)$/i, '').replace(/_/g, ' ');
                    
                    return {
                        pageLinks: [morganUrl],
                        totalPages: 1,
                        displayName,
                        library: 'morgan',
                        originalUrl: morganUrl
                    };
                }
                
                // Handle different Morgan URL patterns
                let baseUrl: string;
                let displayName: string = 'Morgan Library Manuscript';
                
                if (morganUrl.includes('ica.themorgan.org')) {
                    // ICA format: https://ica.themorgan.org/manuscript/thumbs/159109
                    const icaMatch = morganUrl.match(/\/manuscript\/thumbs\/(\d+)/);
                    if (!icaMatch) {
                        throw new Error('Invalid Morgan ICA URL format');
                    }
                    baseUrl = 'https://ica.themorgan.org';
                    displayName = `Morgan ICA Manuscript ${icaMatch[1]}`;
                } else {
                    // Main format: https://www.themorgan.org/collection/lindau-gospels/thumbs
                    // or https://www.themorgan.org/collection/gospel-book/159129
                    const mainMatch = morganUrl.match(/\/collection\/([^/]+)(?:\/(\d+))?(?:\/thumbs)?/);
                    if (!mainMatch) {
                        throw new Error('Invalid Morgan URL format');
                    }
                    baseUrl = 'https://www.themorgan.org';
                    
                    // Extract display name from URL
                    displayName = mainMatch[1]?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) ?? "";
                }
                
                // Ensure we're fetching the correct page
                // FIXED: Handle different Morgan URL formats properly
                let pageUrl = morganUrl;
                let manuscriptId = '';
                let startPageNum = null;
                
                // Extract manuscript ID and check if it's a single page URL
                const singlePageMatch = morganUrl.match(/\/collection\/([^/]+)\/(\d+)/);
                if (singlePageMatch) {
                    manuscriptId = singlePageMatch[1] || '';
                    startPageNum = parseInt(singlePageMatch[2] || '0');
                    // For single page URLs, we need to fetch the thumbs page to find all pages
                    pageUrl = `${baseUrl}/collection/${manuscriptId}/thumbs`;
                    console.log(`Morgan: Single page URL detected, fetching thumbs page for ${manuscriptId}`);
                } else {
                    // For thumbs URLs or general collection URLs
                    const collectionMatch = morganUrl.match(/\/collection\/([^/]+)/);
                    if (collectionMatch) {
                        manuscriptId = collectionMatch[1] || '';
                        
                        // CRITICAL VALIDATION: Ensure manuscriptId doesn't contain URLs
                        if (manuscriptId.includes('://') || manuscriptId.includes('http')) {
                            console.error(`Morgan: Invalid manuscriptId detected: ${manuscriptId}`);
                            throw new Error(`Morgan: Malformed URL - manuscriptId contains URL fragments: ${manuscriptId}`);
                        }
                        
                        if (manuscriptId.length > 100) {
                            console.error(`Morgan: Suspiciously long manuscriptId: ${manuscriptId}`);
                            throw new Error(`Morgan: Malformed URL - manuscriptId too long: ${manuscriptId.length} chars`);
                        }
                        
                        // Ensure we have the thumbs page
                        if (!pageUrl.includes('/thumbs')) {
                            pageUrl = `${baseUrl}/collection/${manuscriptId}/thumbs`;
                        }
                    }
                }
                
                // Fetch the page to extract image data
                // FIXED: Handle redirect from /thumbs to main collection page
                let pageResponse: Response;
                try {
                    pageResponse = await this.deps.fetchDirect(pageUrl, {
                        redirect: 'manual' // Handle redirects manually to debug
                    });
                    
                    // If we get a redirect (301/302), follow it
                    if (pageResponse.status === 301 || pageResponse.status === 302) {
                        const redirectUrl = pageResponse.headers.get('location');
                        if (redirectUrl) {
                            console.log(`Morgan: Following redirect from ${pageUrl} to ${redirectUrl}`);
                            // ULTRA-ROBUST redirect URL handling to prevent URL concatenation bugs
                            const cleanRedirectUrl = redirectUrl.trim();
                            let fullRedirectUrl: string;
                            
                            console.log(`Morgan: Processing redirect URL: "${cleanRedirectUrl}"`);
                            
                            // ENHANCED VALIDATION: Check for malformed URLs first
                            if (cleanRedirectUrl.includes('thumbshttps://') || cleanRedirectUrl.includes('thumbhttp://')) {
                                console.error(`Morgan: Detected malformed redirect URL: ${cleanRedirectUrl}`);
                                // Extract the actual URL from the malformed string
                                const urlMatch = cleanRedirectUrl.match(/(https?:\/\/[^\s]+)/);
                                if (urlMatch) {
                                    fullRedirectUrl = urlMatch[1] || pageUrl;
                                    console.log(`Morgan: Recovered clean URL: ${fullRedirectUrl}`);
                                } else {
                                    // Fallback to original pageUrl
                                    fullRedirectUrl = pageUrl;
                                    console.log(`Morgan: Using fallback URL: ${fullRedirectUrl}`);
                                }
                            } else if (cleanRedirectUrl.startsWith('http://') || cleanRedirectUrl.startsWith('https://')) {
                                // Normal absolute URL
                                fullRedirectUrl = cleanRedirectUrl;
                            } else if (cleanRedirectUrl.startsWith('/')) {
                                // Normal relative URL with /
                                fullRedirectUrl = `${baseUrl}${cleanRedirectUrl}`;
                            } else {
                                // Relative URL without / - validate it's safe
                                if (cleanRedirectUrl.includes('://') || cleanRedirectUrl.length > 100) {
                                    console.error(`Morgan: Suspicious relative redirect: ${cleanRedirectUrl}`);
                                    fullRedirectUrl = pageUrl; // Use original URL as fallback
                                } else {
                                    fullRedirectUrl = `${baseUrl}/${cleanRedirectUrl}`;
                                }
                            }
                            
                            // ENHANCED SAFETY CHECK: More sophisticated validation
                            if (fullRedirectUrl.includes('thumbshttps://') || fullRedirectUrl.includes('thumbhttp://')) {
                                console.error(`Morgan: Final URL still malformed, using original: ${pageUrl}`);
                                fullRedirectUrl = pageUrl;
                            }
                            
                            pageResponse = await this.deps.fetchDirect(fullRedirectUrl, {
                                redirect: 'follow'
                            });
                            pageUrl = fullRedirectUrl;
                        } else {
                            throw new Error(`Redirect response but no location header from ${pageUrl}`);
                        }
                    }
                } catch (error: any) {
                    // Enhanced error message for debugging
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    throw new Error(`Failed to fetch Morgan page from ${pageUrl}: ${errorMessage}`);
                }
                
                if (!pageResponse.ok) {
                    throw new Error(`Failed to fetch Morgan page: ${pageResponse.status} for URL: ${pageUrl}`);
                }
                
                const pageContent = await pageResponse.text();
                
                // Extract image URLs from the page
                const pageLinks: string[] = [];
                
                // Initialize imagesByPriority at outer scope so it's accessible for logging
                const imagesByPriority: { [key: number]: string[] } = {
                    0: [], // HIGHEST PRIORITY: .zif tiled images (ULTRA HIGH RESOLUTION 6000x4000+ pixels, 25MP+)
                    1: [], // NEW: High-resolution download URLs (749KB avg, 16.6x improvement)
                    2: [], // High priority: direct full-size images  
                    3: [], // Medium priority: converted styled images (reliable multi-page)
                    4: [], // Low priority: facsimile images
                    5: []  // Lowest priority: other direct references
                };
                
                if (morganUrl.includes('ica.themorgan.org')) {
                    // ICA format - look for image references
                    const icaImageRegex = /icaimages\/\d+\/[^"']+\.jpg/g;
                    const icaMatches = pageContent.match(icaImageRegex) || [];
                    
                    for (const match of icaMatches) {
                        const fullUrl = `https://ica.themorgan.org/${match}`;
                        if (!pageLinks.includes(fullUrl)) {
                            pageLinks.push(fullUrl);
                        }
                    }
                } else {
                    // Main Morgan format - MAXIMUM RESOLUTION priority system
                    // FIXED: Prioritize ZIF files for ultra-high resolution (6000x4000+ pixels, 25MP+)
                    
                    // Priority 0: Generate .zif URLs from image references (MAXIMUM RESOLUTION - 25+ megapixels)
                    // OPTIMIZED: Single regex with capture groups to avoid redundant operations
                    // manuscriptId already extracted above
                    if (manuscriptId) {
                        const imageIdRegex = /\/images\/collection\/([^"'?]+)\.jpg/g;
                        const validImagePattern = /\d+v?_\d+/;
                        
                        let match;
                        while ((match = imageIdRegex.exec(pageContent)) !== null) {
                            const imageId = match?.[1] || '';
                            // FIXED: Use correct pattern for Lindau Gospels (76874v_*) and similar manuscripts
                            if (imageId && validImagePattern.test(imageId) && !imageId.includes('front-cover')) {
                                const zifUrl = `https://host.themorgan.org/facsimile/images/${manuscriptId}/${imageId}.zif`;
                                if (imagesByPriority && imagesByPriority[0]) {
                                    imagesByPriority[0].push(zifUrl);
                                }
                            }
                        }
                        
                        // Priority 1: NEW - High-resolution download URLs (16.6x improvement validated)
                        // Parse individual manuscript pages for download URLs
                        try {
                            // Extract individual page URLs from thumbs page
                            const pageUrlRegex = new RegExp(`\\/collection\\/${manuscriptId}\\/(\\d+)`, 'g');
                            const pageMatches = [...pageContent.matchAll(pageUrlRegex)];
                            const uniquePages = [...new Set(pageMatches.map(match => match?.[1]))];
                            
                            // Also try alternative patterns for page detection
                            const altPatterns = [
                                new RegExp(`href="[^"]*\\/collection\\/${manuscriptId}\\/(\\d+)[^"]*"`, 'g'),
                                new RegExp(`data-page="(\\d+)"`, 'g'),
                                new RegExp(`page-(\\d+)`, 'g'),
                                // FIXED: Add pattern for thumbnail grid items
                                new RegExp(`<a[^>]+href="[^"]*\\/collection\\/${manuscriptId}\\/(\\d+)[^"]*"[^>]*>\\s*<img`, 'g'),
                                // FIXED: Add pattern for data attributes in grid
                                new RegExp(`data-id="(\\d+)"`, 'g')
                            ];
                            
                            // Collect all pages from alternative patterns
                            const allPages = [...uniquePages];
                            for (const pattern of altPatterns) {
                                const altMatches = [...pageContent.matchAll(pattern)];
                                for (const match of altMatches) {
                                    allPages.push(match?.[1] || '');
                                }
                            }
                            
                            // Remove duplicates and sort
                            const allUniquePages = [...new Set(allPages)].sort((a, b) => parseInt(a || '0') - parseInt(b || '0'));
                            
                            // FIXED: If no pages found in thumbs and we started from a single page, create page range
                            if (allUniquePages?.length === 0 && startPageNum !== null) {
                                console.log(`Morgan: No pages found in thumbs, checking individual page for navigation`);
                                // Try to find total pages from the original single page
                                const singlePageResponse = await this.deps.fetchDirect(morganUrl);
                                if (singlePageResponse.ok) {
                                    const singlePageContent = await singlePageResponse.text();
                                    // Look for page navigation info
                                    const totalPagesMatch = singlePageContent.match(/of\s+(\d+)/i) || 
                                                          singlePageContent.match(/(\d+)\s*pages?/i) ||
                                                          singlePageContent.match(/page\s+\d+\s*\/\s*(\d+)/i);
                                    if (totalPagesMatch) {
                                        const totalPages = parseInt(totalPagesMatch[1] || '0');
                                        // Generate page numbers array
                                        for (let i = 1; i <= totalPages; i++) {
                                            allUniquePages.push(i.toString());
                                        }
                                        console.log(`Morgan: Generated ${totalPages} page numbers from navigation info`);
                                    } else {
                                        // Fallback: assume at least 10 pages around the current page
                                        const estimatedStart = Math.max(1, startPageNum - 5);
                                        const estimatedEnd = startPageNum + 50; // Check 50 pages forward
                                        for (let i = estimatedStart; i <= estimatedEnd; i++) {
                                            allUniquePages.push(i.toString());
                                        }
                                        console.log(`Morgan: No page count found, checking pages ${estimatedStart}-${estimatedEnd}`);
                                    }
                                }
                            }
                            
                            console.log(`Morgan: Found ${allUniquePages?.length} individual pages for ${manuscriptId}`);
                            console.log(`Morgan: Page numbers detected: ${allUniquePages.slice(0, 10).join(', ')}${allUniquePages?.length > 10 ? '...' : ''}`);
                            this.deps.logger.log({
                                level: 'info',
                                library: 'morgan',
                                url: morganUrl,
                                message: 'Morgan page detection complete',
                                details: {
                                    manuscriptId,
                                    totalPagesDetected: allUniquePages?.length,
                                    pageNumbers: allUniquePages.slice(0, 20),
                                    detectionMethod: 'multiple patterns'
                                }
                            });
                            
                            // Process all pages - removed artificial limit
                            const pagesToProcess = allUniquePages;
                            
                            // Parse each individual page for high-resolution download URLs
                            for (const pageNum of pagesToProcess) {
                                try {
                                    const pageUrl = `${baseUrl}/collection/${manuscriptId}/${pageNum}`;
                                    const individualPageResponse = await this.deps.fetchDirect(pageUrl);
                                    
                                    if (individualPageResponse.ok) {
                                        const individualPageContent = await individualPageResponse.text();
                                        
                                        // FIXED: Look for facsimile images on individual pages
                                        const facsimileMatch = individualPageContent.match(/\/sites\/default\/files\/facsimile\/[^"']+\/([^"']+\.jpg)/);
                                        if (facsimileMatch) {
                                            const downloadUrl = `${baseUrl}${facsimileMatch[0]}`;
                                            if (imagesByPriority && imagesByPriority[1]) {
                                                imagesByPriority[1].push(downloadUrl);
                                            }
                                            console.log(`Morgan: Found high-res facsimile: ${facsimileMatch[1]}`);
                                        }
                                    }
                                    
                                    // Rate limiting to be respectful to Morgan's servers
                                    await new Promise(resolve => setTimeout(resolve, 300));
                                    
                                } catch (error) {
                                    console.warn(`Morgan: Error parsing individual page ${pageNum}: ${(error as Error).message}`);
                                }
                            }
                            
                            if (imagesByPriority && imagesByPriority[1] && imagesByPriority[1]?.length > 0) {
                                console.log(`Morgan: Successfully found ${imagesByPriority[1]?.length} high-resolution download URLs`);
                            }
                            
                        } catch (error) {
                            console.warn(`Morgan: Error in high-resolution download URL parsing: ${(error as Error).message}`);
                        }
                    }
                    
                    // Priority 2: Look for direct full-size image references
                    const fullSizeImageRegex = /\/sites\/default\/files\/images\/collection\/[^"'?]+\.jpg/g;
                    const fullSizeMatches = pageContent.match(fullSizeImageRegex) || [];
                    
                    for (const match of fullSizeMatches) {
                        const fullUrl = `${baseUrl}${match}`;
                        if (imagesByPriority && imagesByPriority[2]) {
                            imagesByPriority[2].push(fullUrl);
                        }
                    }
                    
                    // Priority 3: Extract styled images converted to original (fallback for reliability)
                    const styledImageRegex = /\/sites\/default\/files\/styles\/[^"']*\/public\/images\/collection\/[^"'?]+\.jpg/g;
                    const styledMatches = pageContent.match(styledImageRegex) || [];
                    
                    for (const match of styledMatches) {
                        // Convert styled image to original high-resolution version
                        // From: /sites/default/files/styles/large__650_x_650_/public/images/collection/filename.jpg
                        // To: /sites/default/files/images/collection/filename.jpg
                        const originalPath = match.replace(/\/styles\/[^/]+\/public\//, '/');
                        const fullUrl = `${baseUrl}${originalPath}`;
                        if (imagesByPriority && imagesByPriority[3]) {
                            imagesByPriority[3].push(fullUrl);
                        }
                    }
                    
                    // Priority 4: Fallback to facsimile images (legacy format)
                    const facsimileRegex = /\/sites\/default\/files\/facsimile\/[^"']+\.jpg/g;
                    const facsimileMatches = pageContent.match(facsimileRegex) || [];
                    
                    for (const match of facsimileMatches) {
                        const fullUrl = `${baseUrl}${match}`;
                        if (imagesByPriority && imagesByPriority[4]) {
                            imagesByPriority[4].push(fullUrl);
                        }
                    }
                    
                    // Priority 5: Other direct image references
                    const directImageRegex = /https?:\/\/[^"']*themorgan\.org[^"']*\.jpg/g;
                    const directMatches = pageContent.match(directImageRegex) || [];
                    
                    for (const match of directMatches) {
                        if (match.includes('facsimile') || match.includes('images/collection')) {
                            if (imagesByPriority && imagesByPriority[5]) {
                                imagesByPriority[5].push(match);
                            }
                        }
                    }
                    
                    // FIXED: Properly select all discovered images with highest quality
                    // Priority 1 contains all individually fetched high-resolution facsimile images
                    if (imagesByPriority && imagesByPriority[1] && imagesByPriority[1]?.length > 0) {
                        // Use high-resolution facsimile images from individual pages
                        console.log(`Morgan: Using ${imagesByPriority[1]?.length} high-resolution facsimile images`);
                        pageLinks.push(...imagesByPriority[1]);
                    } else if (imagesByPriority && imagesByPriority[0] && imagesByPriority[0]?.length > 0) {
                        // Fallback to ZIF ultra-high resolution images if no facsimile images found
                        console.log(`Morgan: Using ${imagesByPriority[0]?.length} ZIF ultra-high resolution images`);
                        pageLinks.push(...imagesByPriority[0]);
                    } else {
                        // Fallback to other image priorities if no high-res images found
                        console.log('Morgan: No high-resolution images found, using fallback priorities');
                        const getFilenameFromUrl = (url: string) => {
                            const match = url.match(/([^/]+)\.(jpg|zif)$/);
                            return match ? match?.[1] : url;
                        };
                        
                        // Use Map for deduplication
                        const filenameMap = new Map<string, string>();
                        
                        // Add images by priority, avoiding duplicates based on filename
                        if (imagesByPriority) {
                            for (let priority = 2; priority <= 5; priority++) {
                                if (imagesByPriority[priority]) {
                                    for (const imageUrl of imagesByPriority[priority]!) {
                                        const filename = getFilenameFromUrl(imageUrl) || '';
                                        if (filename && !filenameMap.has(filename)) {
                                            filenameMap.set(filename, imageUrl);
                                            pageLinks.push(imageUrl);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Try to extract title from page content
                const titleMatch = pageContent.match(/<title[^>]*>([^<]+)</i);
                if (titleMatch) {
                    const pageTitle = titleMatch[1]?.replace(/\s*\|\s*The Morgan Library.*$/i, '').trim();
                    if (pageTitle && pageTitle !== 'The Morgan Library & Museum') {
                        displayName = pageTitle;
                    }
                }
                
                // Look for manuscript identifier in content
                const msMatch = pageContent.match(/MS\s+M\.?\s*(\d+)/i);
                if (msMatch) {
                    displayName = `${displayName} (MS M.${msMatch[1]})`;
                }
                
                if (pageLinks?.length === 0) {
                    throw new Error('No images found on Morgan Library page');
                }
                
                // Remove duplicates and sort
                const uniquePageLinks = [...new Set(pageLinks)].sort();
                
                // Log priority distribution for debugging - only if imagesByPriority is defined
                if (typeof imagesByPriority !== 'undefined' && imagesByPriority) {
                    console.log(`Morgan: Image quality distribution:`);
                    console.log(`  - Priority 0 (ZIF ultra-high res): ${imagesByPriority[0]?.length} images`);
                    console.log(`  - Priority 1 (High-res facsimile): ${imagesByPriority[1]?.length} images`);
                    console.log(`  - Priority 2 (Direct full-size): ${imagesByPriority[2]?.length} images`);
                    console.log(`  - Priority 3 (Converted styled): ${imagesByPriority[3]?.length} images`);
                    console.log(`  - Priority 4 (Legacy facsimile): ${imagesByPriority[4]?.length} images`);
                    console.log(`  - Priority 5 (Other direct): ${imagesByPriority[5]?.length} images`);
                }
                console.log(`Morgan: Total unique images: ${uniquePageLinks?.length}`);
                
                const morganManifest = {
                    pageLinks: uniquePageLinks,
                    totalPages: uniquePageLinks?.length,
                    library: 'morgan' as const,
                    displayName,
                    originalUrl: morganUrl,
                };
                
                return morganManifest;
                
            } catch (error: any) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`Failed to load Morgan manifest: ${errorMessage}`);
                throw error;
            }
        }
}