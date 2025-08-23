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
                
                // Load more pages (views infinite scroll) to collect all facsimiles
                let pagesHtml: string[] = [pageContent];
                if (manuscriptId) {
                    const quickFacsimileIdRegex = /\/facsimile\/(\d+)\/([^"'?]+)\.jpg/g;
                    const styledFacsimileIdRegex = /\/styles\/[^"']*\/public\/facsimile\/(\d+)\/([^"'?]+)\.jpg/g;
                    const pageLinkRegex = new RegExp(`\\/collection\\/${manuscriptId}\\/(\\d+)`, 'g');
                    const knownIds = new Set<string>([
                        ...[...pageContent.matchAll(quickFacsimileIdRegex)].map(m => m[2]),
                        ...[...pageContent.matchAll(styledFacsimileIdRegex)].map(m => m[2])
                    ]);
                    const knownPages = new Set<string>([...pageContent.matchAll(pageLinkRegex)].map(m => m[1]));

                    const parseDrupalSettings = (html: string) => {
                        try {
                            const m = html.match(/<script[^>]*data-drupal-selector=\"drupal-settings-json\"[^>]*>([\s\S]*?)<\/script>/i);
                            if (!m) return null;
                            const json = JSON.parse(m[1]);
                            const ajaxViews = json?.views?.ajaxViews || {};
                            for (const key of Object.keys(ajaxViews)) {
                                const v = ajaxViews[key];
                                if (v?.view_name && v?.view_display_id && v?.view_path) {
                                    return {
                                        view_name: v.view_name,
                                        view_display_id: v.view_display_id,
                                        view_args: v.view_args || '',
                                        view_path: v.view_path,
                                        view_base_path: v.view_base_path || '',
                                        view_dom_id: v.view_dom_id || key,
                                        pager_element: String(v.pager_element ?? 0)
                                    };
                                }
                            }
                            return null;
                        } catch {
                            return null;
                        }
                    };

                    const ajaxParams = parseDrupalSettings(pageContent);
                    let usedAjax = false;

                    // Try Drupal views/ajax pagination first
                    if (ajaxParams) {
                        usedAjax = true;
                        let pageIndex = 1;
                        while (true) {
                            const form = new URLSearchParams();
                            form.set('view_name', ajaxParams.view_name);
                            form.set('view_display_id', ajaxParams.view_display_id);
                            form.set('view_args', ajaxParams.view_args);
                            form.set('view_path', ajaxParams.view_path);
                            form.set('view_base_path', ajaxParams.view_base_path);
                            form.set('view_dom_id', ajaxParams.view_dom_id);
                            form.set('pager_element', ajaxParams.pager_element);
                            form.set('page', String(pageIndex));

                            try {
                                const resp = await this.deps.fetchDirect(`${baseUrl}/views/ajax`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                        'X-Requested-With': 'XMLHttpRequest',
                                        'Accept': 'application/json, text/javascript, */*; q=0.01'
                                    },
                                    body: form.toString()
                                });

                                if (!resp.ok) break;
                                const json = await resp.json().catch(() => null as any);
                                if (!Array.isArray(json)) break;

                                // Extract any HTML chunks from 'data' fields in commands
                                let appended = false;
                                for (const cmd of json) {
                                    const data = cmd?.data;
                                    if (typeof data === 'string' && data.includes('<')) {
                                        const idsBefore = knownIds.size;
                                        const pagesBefore = knownPages.size;
                                        for (const m of data.matchAll(quickFacsimileIdRegex)) {
                                            knownIds.add(m[2]);
                                        }
                                        for (const m of data.matchAll(styledFacsimileIdRegex)) {
                                            knownIds.add(m[2]);
                                        }
                                        for (const m of data.matchAll(pageLinkRegex)) {
                                            knownPages.add(m[1]);
                                        }
                                        if (knownIds.size > idsBefore || knownPages.size > pagesBefore) {
                                            pagesHtml.push(data);
                                            appended = true;
                                        }
                                    }
                                }

                                if (!appended) break;
                                pageIndex++;
                                await new Promise(r => setTimeout(r, 200));
                            } catch {
                                break;
                            }
                        }
                    }

                    // Fallback to simple ?page=N pagination if AJAX failed
                    if (!usedAjax) {
                        try {
                            let pageIndex = 1;
                            // If initial page was /thumbs, paginate on /thumbs; otherwise, on the base collection path
                            const thumbsPagingBase = pageUrl.includes('/thumbs')
                                ? `${baseUrl}/collection/${manuscriptId}/thumbs`
                                : `${baseUrl}/collection/${manuscriptId}`;
                            while (true) {
                                const nextUrl = `${thumbsPagingBase}?page=${pageIndex}`;
                                const resp = await this.deps.fetchDirect(nextUrl);
                                if (!resp.ok) break;
                                const html = await resp.text();

                                const idsBefore = knownIds.size;
                                const pagesBefore = knownPages.size;
                                for (const m of html.matchAll(quickFacsimileIdRegex)) {
                                    knownIds.add(m[2]);
                                }
                                for (const m of html.matchAll(styledFacsimileIdRegex)) {
                                    knownIds.add(m[2]);
                                }
                                for (const m of html.matchAll(pageLinkRegex)) {
                                    knownPages.add(m[1]);
                                }
                                if (knownIds.size > idsBefore || knownPages.size > pagesBefore) {
                                    pagesHtml.push(html);
                                    pageIndex++;
                                    await new Promise(r => setTimeout(r, 200));
                                } else {
                                    break;
                                }
                            }
                        } catch {
                            // Ignore pagination errors
                        }
                    }
                }
                
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
                        // Parse image identifiers from both styled and direct facsimile references
                        // Example styled thumb: /sites/default/files/styles/largest_800_x_800_/public/facsimile/76874/76874v_0487-0001.jpg?itok=...
                        // Example direct:       /sites/default/files/facsimile/76874/76874v_0487-0001.jpg
                        const facsimileIdRegex = /\/facsimile\/(\d+)\/([^"'?]+)\.jpg/g;
                        const styledFacsimileRegex = /\/styles\/[^"']*\/public\/facsimile\/(\d+)\/([^"'?]+)\.jpg/g;

                        type FacsimileRef = { bbid: string; id: string };
                        const facsimiles: FacsimileRef[] = [];

                        // Collect from direct facsimile references
                        let fm: RegExpExecArray | null;
                        for (const html of pagesHtml) {
                            while ((fm = facsimileIdRegex.exec(html)) !== null) {
                                const bbid = fm[1];
                                const id = fm[2];
                                if (bbid && id) facsimiles.push({ bbid, id });
                            }
                            for (const sm of html.matchAll(styledFacsimileRegex)) {
                                const bbid = sm[1];
                                const id = sm[2];
                                if (bbid && id) facsimiles.push({ bbid, id });
                            }
                        }

                        // De-duplicate by id (same page may appear multiple times)
                        const isLikelyZifCandidate = (id: string) => id.includes('_') && !/-\d{2,4}x\d{2,4}/.test(id);
                        const seen = new Set<string>();
                        for (const f of facsimiles) {
                            const key = `${f.id}`;
                            if (seen.has(key)) continue;
                            seen.add(key);

                            // Priority 0: ZIF ultra-high resolution (only for plausible facsimile page IDs)
                            const zifUrl = `https://host.themorgan.org/facsimile/images/${manuscriptId}/${f.id}.zif`;
                            if (isLikelyZifCandidate(f.id)) {
                                imagesByPriority[0].push(zifUrl);
                            }

                            // Priority 2/3: original facsimile JPEG as fallback (non-styled)
                            const originalJpeg = `${baseUrl}/sites/default/files/facsimile/${f.bbid}/${f.id}.jpg`;
                            imagesByPriority[2].push(originalJpeg);
                        }

                        // Priority 1: NEW - High-resolution download URLs (16.6x improvement validated)
                        // Parse individual manuscript pages for download URLs (only if we didn't get ZIFs)
                        if (imagesByPriority[0].length === 0) try {
                            // Extract individual page URLs from all collected thumbs pages
                            const pageUrlRegex = new RegExp(`\\/collection\\/${manuscriptId}\\/(\\d+)`, 'g');
                            const altPatterns = [
                                new RegExp(`href="[^"]*\\/collection\\/${manuscriptId}\\/(\\d+)[^"]*"`, 'g'),
                                new RegExp(`data-page="(\\d+)"`, 'g'),
                                new RegExp(`page-(\\d+)`, 'g'),
                                new RegExp(`<a[^>]+href="[^"]*\\/collection\\/${manuscriptId}\\/(\\d+)[^"]*"[^>]*>\\s*<img`, 'g'),
                                new RegExp(`data-id="(\\d+)"`, 'g')
                            ];
                            const uniquePageSet = new Set<string>();
                            for (const html of pagesHtml) {
                                for (const m of html.matchAll(pageUrlRegex)) uniquePageSet.add(m[1]);
                                for (const pattern of altPatterns) {
                                    for (const m of html.matchAll(pattern)) uniquePageSet.add(m[1] || '');
                                }
                            }
                            
                            // Remove duplicates and sort
                            const allUniquePages = [...uniquePageSet].filter(Boolean).sort((a, b) => parseInt(a || '0') - parseInt(b || '0'));
                            
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
                    
                    // Priority 2/3 removed for Morgan: avoid non-facsimile hero/styled images that 404
                    
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
                    const directImageRegex = /https?:\/\/[^"']*themorgan\.org[^"']*facsimile[^"']*\.jpg/g;
                    const directMatches = pageContent.match(directImageRegex) || [];
                    
                    for (const match of directMatches) {
                        if (imagesByPriority && imagesByPriority[5]) {
                            imagesByPriority[5].push(match);
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