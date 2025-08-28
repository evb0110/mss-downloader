import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class MorganLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    // Detect whether we can stitch ZIF tiles on this platform (Canvas available)
    private async canStitchZif(): Promise<boolean> {
        try {
            // Dynamic import to avoid bundling issues on platforms without canvas
            await import('canvas');
            return true;
        } catch {
            // Fallback: try Jimp-based stitching capability
            try {
                const jimpModule: any = await import('jimp');
                return Boolean(jimpModule);
            } catch {
                return false;
            }
        }
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
                // FIXED: Handle different Morgan URL formats properly (preserve objectId when present)
                let pageUrl = morganUrl;
                let manuscriptId = '';
                let objectId: string | null = null;
                let startPageNum: number | null = null;
                
                // Normalize obvious malformed Morgan URLs where 'thumbs' is concatenated with an absolute URL
                // e.g. '/collection/lindau-gospelszhttps://www.themorgan.org/collection/lindau-gospels/thumbsz'
                if (/thumbs?https?:\/\//i.test(pageUrl)) {
                    const match = pageUrl.match(/(https?:\/\/[^\s]+?(?:\/collection\/[^\s]+?))(?:\?|#|$)/i);
                    if (match && match[1]) {
                        console.warn(`Morgan: Normalized malformed URL '${pageUrl}' -> '${match[1]}'`);
                        pageUrl = match[1];
                    } else {
                        // Fallback: strip everything after 'thumbs' and re-append '/thumbs'
                        const idx = pageUrl.toLowerCase().indexOf('/thumbs');
                        if (idx > 0) {
                            pageUrl = pageUrl.substring(0, idx + '/thumbs'.length);
                            console.warn(`Morgan: Fallback normalized URL to '${pageUrl}'`);
                        }
                    }
                }

                // Parse common Morgan URL shapes:
                // 1) /collection/<slug>/<objectId>/thumbs
                // 2) /collection/<slug>/<objectId>
                // 3) /collection/<slug>/<objectId>/<page>
                // 4) /collection/<slug>/thumbs
                // 5) /collection/<slug>
                const objThumbsMatch = morganUrl.match(/\/collection\/([^/]+)\/(\d+)\/thumbs\b/);
                const objBaseMatch = morganUrl.match(/\/collection\/([^/]+)\/(\d+)(?:[?#]|$)/);
                const objPageMatch = morganUrl.match(/\/collection\/([^/]+)\/(\d+)\/(\d+)(?:[/?#]|$)/);
                const slugThumbsMatch = morganUrl.match(/\/collection\/([^/]+)\/thumbs\b/);
                const slugOnlyMatch = morganUrl.match(/\/collection\/([^/]+)(?:[?#]|$)/);
                
                if (objPageMatch) {
                    // Explicit objectId + page URL, fetch the corresponding thumbs page
                    manuscriptId = objPageMatch[1] || '';
                    objectId = objPageMatch[2] || null;
                    startPageNum = parseInt(objPageMatch[3] || '0');
                    pageUrl = `${baseUrl}/collection/${manuscriptId}/${objectId}/thumbs`;
                    console.log(`Morgan: Detected object page URL, using thumbs for ${manuscriptId}/${objectId}`);
                } else if (objThumbsMatch) {
                    manuscriptId = objThumbsMatch[1] || '';
                    objectId = objThumbsMatch[2] || null;
                    pageUrl = `${baseUrl}/collection/${manuscriptId}/${objectId}/thumbs`;
                    console.log(`Morgan: Detected object thumbs URL for ${manuscriptId}/${objectId}`);
                } else if (objBaseMatch) {
                    manuscriptId = objBaseMatch[1] || '';
                    objectId = objBaseMatch[2] || null;
                    pageUrl = `${baseUrl}/collection/${manuscriptId}/${objectId}/thumbs`;
                    console.log(`Morgan: Detected object base URL, redirecting to thumbs for ${manuscriptId}/${objectId}`);
                } else if (slugThumbsMatch) {
                    manuscriptId = slugThumbsMatch[1] || '';
                    pageUrl = `${baseUrl}/collection/${manuscriptId}/thumbs`;
                    console.log(`Morgan: Detected slug thumbs URL for ${manuscriptId}`);
                } else {
                    // Fallback: slug-only
                    const m = slugOnlyMatch;
                    if (m) {
                        manuscriptId = m[1] || '';
                        pageUrl = `${baseUrl}/collection/${manuscriptId}/thumbs`;
                        console.log(`Morgan: Detected slug base URL, redirecting to thumbs for ${manuscriptId}`);
                    }
                }
                
                // CRITICAL VALIDATION: Ensure manuscriptId doesn't contain URLs
                if (manuscriptId) {
                    if (manuscriptId.includes('://') || manuscriptId.includes('http')) {
                        console.error(`Morgan: Invalid manuscriptId detected: ${manuscriptId}`);
                        throw new Error(`Morgan: Malformed URL - manuscriptId contains URL fragments: ${manuscriptId}`);
                    }
                    if (manuscriptId.length > 100) {
                        console.error(`Morgan: Suspiciously long manuscriptId: ${manuscriptId}`);
                        throw new Error(`Morgan: Malformed URL - manuscriptId too long: ${manuscriptId.length} chars`);
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
                            
                            console.log(`Morgan: Processing redirect URL: \"${cleanRedirectUrl}\"`);
                            
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
                    // Fallback: if /thumbs path is 404, try base object page without /thumbs
                    if (pageResponse.status === 404 && pageUrl.includes('/thumbs')) {
                        const altUrl = pageUrl.replace('/thumbs', '');
                        console.log(`Morgan: /thumbs returned 404. Trying base page: ${altUrl}`);
                        const altResp = await this.deps.fetchDirect(altUrl, { redirect: 'follow' });
                        if (!altResp.ok) {
                            throw new Error(`Failed to fetch Morgan page: ${altResp.status} for URL: ${altUrl}`);
                        }
                        pageResponse = altResp;
                        pageUrl = altUrl;
                    } else {
                        throw new Error(`Failed to fetch Morgan page: ${pageResponse.status} for URL: ${pageUrl}`);
                    }
                }
                
                const pageContent = await pageResponse.text();
                
                // Load more pages (views infinite scroll) to collect all facsimiles
                const pagesHtml: string[] = [pageContent];
                if (manuscriptId) {
                    const quickFacsimileIdRegex = /\/facsimile\/(\d+)\/([^\"'?]+)\.jpg/g;
                    const styledFacsimileIdRegex = /\/styles\/[^\"']*\/public\/facsimile\/(\d+)\/([^\"'?]+)\.jpg/g;
                        const collectionPath = `${manuscriptId}${objectId ? `/${objectId}` : ''}`;
                        const pageLinkRegex = new RegExp(`/collection/${collectionPath}/(\\d+)`, 'g');
                    const knownIds = new Set<string>([
                        ...[...pageContent.matchAll(quickFacsimileIdRegex)].map(m => m[2]).filter((id): id is string => Boolean(id)),
                        ...[...pageContent.matchAll(styledFacsimileIdRegex)].map(m => m[2]).filter((id): id is string => Boolean(id))
                    ]);
                    const knownPages = new Set<string>([...pageContent.matchAll(pageLinkRegex)].map(m => m[1]).filter((id): id is string => Boolean(id)));

                    const parseDrupalSettings = (html: string) => {
                        try {
const m = html.match(/<script[^>]*data-drupal-selector="drupal-settings-json"[^>]*>([\s\S]*?)<\/script>/i);
                            if (!m || !m[1]) return null;
                            const json = JSON.parse(m[1]);
                            const ajaxViews = json?.views?.ajaxViews || {};
                            const candidates: any[] = [];
                            for (const key of Object.keys(ajaxViews)) {
                                const v = ajaxViews[key];
                                if (v?.view_name && v?.view_display_id && v?.view_path) {
                                    const view_path: string = v.view_path || '';
                                    let score = 0;
                                    const collectionPath = `${manuscriptId}${objectId ? `/${objectId}` : ''}`;
                                    if (view_path.includes(`/collection/${collectionPath}/thumbs`)) score = 3;
                                    else if (view_path.includes(`/collection/${collectionPath}`)) score = 2;
                                    else score = 1;
                                    candidates.push({ key, score, v });
                                }
                            }
                            if (candidates.length === 0) return null;
                            candidates.sort((a, b) => b.score - a.score);
                            const v = candidates[0].v;
                            return {
                                view_name: v.view_name,
                                view_display_id: v.view_display_id,
                                view_args: v.view_args || '',
                                view_path: v.view_path,
                                view_base_path: v.view_base_path || '',
                                view_dom_id: v.view_dom_id || candidates[0].key,
                                pager_element: String(v.pager_element ?? 0)
                            };
                        } catch {
                            return null;
                        }
                    };

                    const ajaxParams = parseDrupalSettings(pageContent);
                    // let usedAjax = false; // Removed unused variable

                    // Helper: try both POST and GET to /views/ajax
                    const fetchViewsAjax = async (pageIndex: number): Promise<any[] | null> => {
                        const form = new URLSearchParams();
                        form.set('view_name', ajaxParams!.view_name);
                        form.set('view_display_id', ajaxParams!.view_display_id);
                        form.set('view_args', ajaxParams!.view_args);
                        form.set('view_path', ajaxParams!.view_path);
                        form.set('view_base_path', ajaxParams!.view_base_path);
                        form.set('view_dom_id', ajaxParams!.view_dom_id);
                        form.set('pager_element', ajaxParams!.pager_element);
                        form.set('page', String(pageIndex));

                        // First try POST
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
                            if (resp.ok) {
                                const json = await resp.json().catch(() => null as any);
                                if (Array.isArray(json)) return json;
                            }
                        } catch { void 0; }

                        // Fallback: GET with query params
                        try {
                            const resp = await this.deps.fetchDirect(`${baseUrl}/views/ajax?${form.toString()}&_wrapper_format=drupal_ajax`, {
                                method: 'GET',
                                headers: {
                                    'X-Requested-With': 'XMLHttpRequest',
                                    'Accept': 'application/json, text/javascript, */*; q=0.01'
                                }
                            });
                            if (resp.ok) {
                                const json = await resp.json().catch(() => null as any);
                                if (Array.isArray(json)) return json;
                            }
                        } catch { void 0; }

                        return null;
                    };

                    // Try Drupal views/ajax pagination first
                    if (ajaxParams) {
                        let _appendedTotal = 0;
                        let pageIndex = 1;
                        while (true) {
                            const json = await fetchViewsAjax(pageIndex);
                            if (!Array.isArray(json)) break;

                            // Extract any HTML chunks from 'data' fields in commands
                            let appended = false;
                            for (const cmd of json) {
                                const data = cmd?.data;
                                if (typeof data === 'string' && data.includes('<')) {
                                    const idsBefore = knownIds.size;
                                    const pagesBefore = knownPages.size;
                                    // Note: facsimiles array is declared later; only update knownIds/knownPages here to avoid hoist issues
                                    for (const m of data.matchAll(quickFacsimileIdRegex)) {
                                        if (m[2]) knownIds.add(m[2]);
                                    }
                                    for (const m of data.matchAll(styledFacsimileIdRegex)) {
                                        if (m[2]) knownIds.add(m[2]);
                                    }
                                    for (const m of data.matchAll(pageLinkRegex)) {
                                        if (m[1]) knownPages.add(m[1]);
                                    }
                                    if (knownIds.size > idsBefore || knownPages.size > pagesBefore) {
                                        appended = true;
                                        _appendedTotal++;
                                    }
                                }
                            }

                            if (!appended) break;
                            pageIndex++;
                            await new Promise(r => setTimeout(r, 200));
                        }
                        // Only consider AJAX successful if we appended at least once
                        // usedAjax = appendedTotal > 0; // Currently unused
                    }

                    // ALWAYS perform simple ?page=N pagination as a safety net
                    try {
                        let pageIndex = 1;
                        // If initial page was /thumbs, paginate on /thumbs; otherwise, on the base collection path
                        const collectionPath = `${manuscriptId}${objectId ? `/${objectId}` : ''}`;
                        const thumbsPagingBase = pageUrl.includes('/thumbs')
                            ? `${baseUrl}/collection/${collectionPath}/thumbs`
                            : `${baseUrl}/collection/${collectionPath}`;
                        while (true) {
                            const nextUrl = `${thumbsPagingBase}?page=${pageIndex}`;
                            const resp = await this.deps.fetchDirect(nextUrl);
                            if (!resp.ok) break;
                            const html = await resp.text();

                            const idsBefore = knownIds.size;
                            const pagesBefore = knownPages.size;
                            for (const m of html.matchAll(quickFacsimileIdRegex)) {
                                if (m[2]) knownIds.add(m[2]);
                            }
                            for (const m of html.matchAll(styledFacsimileIdRegex)) {
                                if (m[2]) knownIds.add(m[2]);
                            }
                            for (const m of html.matchAll(pageLinkRegex)) {
                                if (m[1]) knownPages.add(m[1]);
                            }
                            if (knownIds.size > idsBefore || knownPages.size > pagesBefore) {
                                // We only tracked IDs here; detailed facsimile extraction happens after regex setup below
                                pageIndex++;
                                await new Promise(r => setTimeout(r, 200));
                            } else {
                                break;
                            }
                        }
                    } catch { void 0; }
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
                        const dedupedFacsimiles: FacsimileRef[] = [];
                        for (const f of facsimiles) {
                            const key = `${f.id}`;
                            if (seen.has(key)) continue;
                            seen.add(key);
                            dedupedFacsimiles.push(f);

                            // Priority 2/3: original facsimile JPEG as fallback (non-styled)
                            const originalJpeg = `${baseUrl}/sites/default/files/facsimile/${f.bbid}/${f.id}.jpg`;
                            imagesByPriority[2]?.push(originalJpeg);
                        }

                        // Attempt ZIF by discovering manuscript code from individual pages
                        let manuscriptCode: string | null = null;
                        let imagesDir: string | null = null; // Subdirectory under /facsimile/images/<imagesDir>/
                        try {
                            // Try to discover manuscript code from first individual page
                            const collectionPath = `${manuscriptId}${objectId ? `/${objectId}` : ''}`;
                            const firstPageUrl = `${baseUrl}/collection/${collectionPath}/1`;
                            const firstPageResp = await this.deps.fetchDirect(firstPageUrl);
                            
                            if (firstPageResp.ok) {
                                const firstPageHtml = await firstPageResp.text();
                                // Look for iframe src with manuscript code pattern (e.g., /facsimile/m1/default.asp)
                                const iframeMatch = firstPageHtml.match(/host\.themorgan\.org\/facsimile\/([^\/]+)\/default\.asp/);
                                if (iframeMatch && iframeMatch[1]) {
                                    manuscriptCode = iframeMatch[1];
                                    console.log(`Morgan: Discovered manuscript code: ${manuscriptCode}`);
                                }
                                // Look for Zoomify viewer call that reveals the images directory (e.g., ../images/lindau-gospels/... .zif)
                                const imagesDirMatch = firstPageHtml.match(/images\/([A-Za-z0-9_-]+)\/[^"']+\.zif/);
                                if (imagesDirMatch && imagesDirMatch[1]) {
                                    imagesDir = imagesDirMatch[1];
                                    console.log(`Morgan: Discovered images directory: ${imagesDir}`);
                                }
                            }
                        } catch {
                            console.log('Morgan: Could not discover manuscript code from individual page');
                        }

                        // If we have facsimile IDs, build ZIF URLs using discovered imagesDir or manuscriptId
                        if (dedupedFacsimiles.length > 0) {
                            try {
                                const f0 = dedupedFacsimiles[0];
                                if (f0) {
                                    // Prefer discovered imagesDir (e.g., lindau-gospels); fallback to slug manuscriptId
                                    const zifDir = imagesDir || manuscriptId;
                                    // Build ZIF URLs directly (avoid HEAD to reduce memory/time)
                                    for (const f of dedupedFacsimiles) {
                                        if (!isLikelyZifCandidate(f.id)) continue;
                                        const zifUrl = `https://host.themorgan.org/facsimile/images/${zifDir}/${f.id}.zif`;
                                        imagesByPriority[0]?.push(zifUrl);
                                    }
                                }
                            } catch (error) {
                                console.log('Morgan: ZIF verification failed:', error);
                            }
                        } else {
                            console.log('Morgan: No manuscript code discovered, skipping ZIF attempt');
                        }

                    // Priority 1: NEW - High-resolution download URLs (and per-page ZIF discovery)
                    // Limit per-page parsing to a tiny sample to avoid memory blowups
                    try {
                            // Extract individual page URLs from all collected thumbs pages
                            const collectionPath = `${manuscriptId}${objectId ? `/${objectId}` : ''}`;
                            const pageUrlRegex = new RegExp(`/collection/${collectionPath}/(\\d+)`, 'g');
                            const altPatterns = [
                                new RegExp(`href=\"[^\"]*/collection/${collectionPath}/(\\d+)[^\"]*\"`, 'g'),
                                new RegExp(`data-page=\"(\\d+)\"`, 'g'),
                                new RegExp(`page-(\\d+)`, 'g'),
                                new RegExp(`<a[^>]+href=\"[^\"]*/collection/${collectionPath}/(\\d+)[^\"]*\"[^>]*>\\s*<img`, 'g'),
                                new RegExp(`data-id=\"(\\d+)\"`, 'g')
                            ];
                            const uniquePageSet = new Set<string>();
                            for (const html of pagesHtml) {
                                for (const m of html.matchAll(pageUrlRegex)) {
                                    if (m[1]) uniquePageSet.add(m[1]);
                                }
                                for (const pattern of altPatterns) {
                                    for (const m of html.matchAll(pattern)) {
                                        if (m[1]) uniquePageSet.add(m[1]);
                                    }
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
                            
                            // Process only first 3 pages for ZIF confirmation
                            const pagesToProcess = allUniquePages.slice(0, 3);
                            
                            // Parse each individual page for high-resolution download URLs
                            for (const pageNum of pagesToProcess) {
                                try {
                                    const collectionPath = `${manuscriptId}${objectId ? `/${objectId}` : ''}`;
                                    const pageUrl = `${baseUrl}/collection/${collectionPath}/${pageNum}`;
                                    const individualPageResponse = await this.deps.fetchDirect(pageUrl);
                                    
                                    if (individualPageResponse.ok) {
                                        const individualPageContent = await individualPageResponse.text();
                                        
                                        // FIXED: Look for facsimile images on individual pages
                                        // Support both with and without BBID segment and optional styled path
                                        const facsimileMatch = individualPageContent.match(/\/sites\/default\/files\/(?:styles\/[^"']*\/public\/)?facsimile\/(?:\d+\/)?([^"']+\.jpg)/i);
                                        if (facsimileMatch) {
                                            const downloadUrl = `${baseUrl}${facsimileMatch[0]}`;
                                            if (imagesByPriority && imagesByPriority[1]) {
                                                imagesByPriority[1].push(downloadUrl);
                                            }
                                            console.log(`Morgan: Found high-res facsimile: ${facsimileMatch[1]}`);
                                        }

                                        // NEW: Extract Zoom viewer link and resolve per-page ZIF path via default.asp
                                        try {
                                            const zoomLinkMatch = individualPageContent.match(/https?:\/\/host\.themorgan\.org\/facsimile\/([^\/]+)\/default\.asp\?id=(\d+)/i);
                                            const zifOk = await this.canStitchZif();
                                            if (zoomLinkMatch && zifOk) {
                                                const code = zoomLinkMatch[1];
                                                const pageId = zoomLinkMatch[2];
                                                const viewerUrl = `https://host.themorgan.org/facsimile/${code}/default.asp?id=${pageId}`;
                                                const viewerResp = await this.deps.fetchDirect(viewerUrl);
                                                if (viewerResp.ok) {
                                                    const viewerHtml = await viewerResp.text();
                                                    const zifPathMatch = viewerHtml.match(/images\/([A-Za-z0-9_-]+)\/([^"']+)\.zif/i);
                                                    if (zifPathMatch && zifPathMatch[1] && zifPathMatch[2]) {
                                                        const dir = zifPathMatch[1];
                                                        const fileBase = zifPathMatch[2];
                                                        const zifUrl = `https://host.themorgan.org/facsimile/images/${dir}/${fileBase}.zif`;
                                                        if (imagesByPriority && imagesByPriority[0]) {
                                                            imagesByPriority[0].push(zifUrl);
                                                        }
                                                    }
                                                }
                                            }
                                        } catch { /* non-fatal */ }
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
                    // Prefer per-page high-res JPEGs; use ZIF only when tile stitching is supported
                    const zifCapable = await this.canStitchZif();
                    if (imagesByPriority && imagesByPriority[0] && imagesByPriority[0]?.length > 0 && zifCapable) {
                        // Prefer ZIF for maximum resolution when tile stitching is available
                        console.log(`Morgan: Using ${imagesByPriority[0]?.length} ZIF ultra-high resolution images (tile stitching enabled)`);
                        pageLinks.push(...imagesByPriority[0]);
                    } else if (imagesByPriority && imagesByPriority[1] && imagesByPriority[1]?.length > 0) {
                        // Use high-resolution facsimile images from individual pages
                        console.log(`Morgan: Using ${imagesByPriority[1]?.length} high-resolution facsimile images`);
                        pageLinks.push(...imagesByPriority[1]);
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

                    // Ensure first two pages (cover pages) are included if missing
                    try {
                        const firstPageCandidates: string[] = [];
                        const presentId = (url: string) => (url.match(/([^/]+)\.(?:jpg|jpeg|png|gif|zif)$/i)?.[1] || url);
                        const containsId = (id: string): boolean => {
                            const inZifs = (imagesByPriority?.[0] || []).some(u => u.includes(`/${id}.zif`));
                            const inLinks = pageLinks.some(u => presentId(u) === id);
                            return inZifs || inLinks;
                        };
                        const collectionPath = `${manuscriptId}${objectId ? `/${objectId}` : ''}`;
                        for (let p = 1; p <= 2; p++) {
                            const pageUrlAbs = `${baseUrl}/collection/${collectionPath}/${p}`;
                            const resp = await this.deps.fetchDirect(pageUrlAbs);
                            if (!resp.ok) continue;
                            const html = await resp.text();
                            // Match both facsimile/BBID/ID.jpg and facsimile/ID.jpg
                            const m = html.match(/\/(sites\/default\/files\/facsimile\/(?:\d+\/)?([^"']+\.jpg))/i);
                            if (m && m[1]) {
                                const rel = m[1];
                                const idMatch = rel.match(/([^/]+)\.jpg$/i);
                                const id = idMatch ? idMatch[1] : null;
                                if (id && !containsId(id)) {
                                    const full = `${baseUrl}/${rel}`.replace(/\/+/, '/').replace('https:/', 'https://');
                                    firstPageCandidates.push(full);
                                    console.log(`Morgan: Added missing cover page P${p}: ${id}`);
                                }
                            }
                            await new Promise(r => setTimeout(r, 100));
                        }
                        // Prepend candidates to maintain correct sequencing
                        if (firstPageCandidates.length > 0) {
                            pageLinks.unshift(...firstPageCandidates);
                        }
                    } catch { void 0; }
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
                
                // Remove duplicates but preserve original order
                const seenIdsForOrder = new Set<string>();
                const extractId = (url: string) => (url.match(/([^/]+)\.(?:jpg|jpeg|png|gif|zif)$/i)?.[1] || url);
                const uniquePageLinks = pageLinks.filter(url => {
                    const id = extractId(url);
                    if (seenIdsForOrder.has(id)) return false;
                    seenIdsForOrder.add(id);
                    return true;
                });
                
                // If we still ended up with ZIFs but cannot stitch them, replace with available JPEGs as a safety net
                if (!(await this.canStitchZif()) && uniquePageLinks.every(u => u.endsWith('.zif')) && imagesByPriority[2]?.length) {
                    console.warn('Morgan: Safety net activated - replacing ZIF-only set with direct JPEG facsimiles due to missing Canvas');
                    uniquePageLinks.splice(0, uniquePageLinks.length, ...imagesByPriority[2]!);
                }
                
                // Log priority distribution for debugging - only if imagesByPriority is defined
                if (typeof imagesByPriority !== 'undefined' && imagesByPriority) {
                    console.log(`Morgan: Image quality distribution:`);
                    console.log(`  - Priority 0 (ZIF ultra-high res): ${imagesByPriority[0]?.length} images`);
                    console.log(`  - Priority 1 (High-res facsimile): ${imagesByPriority[1]?.length} images`);
                    console.log(`  - Priority 2 (Direct full-size): ${imagesByPriority[2]?.length} images`);
                    console.log(`  - Priority 3 (Converted styled): ${imagesByPriority[3]?.length} images`);
                    console.log(`  - Priority 4 (Legacy facsimile): ${imagesByPriority[4]?.length} images`);
                    console.log(`  - Priority 5 (Other direct): ${imagesByPriority[5]?.length} images`);
                    // Explicitly print first few links for 0/1 to validate sources during logs
                    const sample0 = (imagesByPriority[0] || []).slice(0, 3);
                    const sample1 = (imagesByPriority[1] || []).slice(0, 3);
                    if (sample0.length) console.log(`Morgan: ZIF sample: ${sample0.join(' | ')}`);
                    if (sample1.length) console.log(`Morgan: JPEG sample: ${sample1.join(' | ')}`);
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