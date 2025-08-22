import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

interface FlorenceField {
    key: string;
    value: string;
    [key: string]: unknown;
}

interface FlorenceChild {
    id: number;
    title?: string;
    [key: string]: unknown;
}

interface FlorenceParent {
    children?: FlorenceChild[];
    fields?: FlorenceField[];
    [key: string]: unknown;
}

interface FlorenceItemData {
    parentId?: number;
    parent?: FlorenceParent;
    fields?: FlorenceField[];
    title?: string;
    [key: string]: unknown;
}

interface FlorenceState {
    item?: {
        item?: FlorenceItemData;
        children?: FlorenceChild[];
    };
    [key: string]: unknown;
}

interface ParsedFlorenceUrl {
    collection: string;
    itemId: string;
    urlType: 'manuscript_viewer' | 'iiif_image' | 'iiif_manifest' | 'contentdm_api';
    viewerUrl: string; // Always provide the manuscript viewer URL for processing
}

export class FlorenceLoader extends BaseLibraryLoader {
    private sessionCookie: string | null = null;

    constructor(deps: LoaderDependencies) {
        super(deps);
    }

    /**
     * Intelligently parse various Florence URL formats
     */
    private parseFlorenceUrl(url: string): ParsedFlorenceUrl {
        // Pattern 1: Manuscript viewer URLs
        // https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217702/rec/1
        const viewerMatch = url.match(/cdm21059\.contentdm\.oclc\.org\/digital\/collection\/([^/]+)\/id\/(\d+)/);
        if (viewerMatch) {
            return {
                collection: viewerMatch[1]!,
                itemId: viewerMatch[2]!,
                urlType: 'manuscript_viewer',
                viewerUrl: `https://cdm21059.contentdm.oclc.org/digital/collection/${viewerMatch[1]}/id/${viewerMatch[2]}/rec/1`
            };
        }

        // Pattern 2: IIIF image URLs
        // https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217702/full/max/0/default.jpg
        const iiifImageMatch = url.match(/cdm21059\.contentdm\.oclc\.org\/iiif\/2\/([^:]+):(\d+)/);
        if (iiifImageMatch) {
            return {
                collection: iiifImageMatch[1]!,
                itemId: iiifImageMatch[2]!,
                urlType: 'iiif_image',
                viewerUrl: `https://cdm21059.contentdm.oclc.org/digital/collection/${iiifImageMatch[1]}/id/${iiifImageMatch[2]}/rec/1`
            };
        }

        // Pattern 3: IIIF manifest URLs
        // https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217702/manifest.json
        const iiifManifestMatch = url.match(/cdm21059\.contentdm\.oclc\.org\/iiif\/2\/([^:]+):(\d+)\/manifest/);
        if (iiifManifestMatch) {
            return {
                collection: iiifManifestMatch[1]!,
                itemId: iiifManifestMatch[2]!,
                urlType: 'iiif_manifest',
                viewerUrl: `https://cdm21059.contentdm.oclc.org/digital/collection/${iiifManifestMatch[1]}/id/${iiifManifestMatch[2]}/rec/1`
            };
        }

        // Pattern 4: ContentDM API URLs
        // https://cdm21059.contentdm.oclc.org/digital/api/singleitem/image/plutei/217702/default.jpg
        const apiMatch = url.match(/cdm21059\.contentdm\.oclc\.org\/digital\/api\/singleitem\/image\/([^/]+)\/(\d+)/);
        if (apiMatch) {
            return {
                collection: apiMatch[1]!,
                itemId: apiMatch[2]!,
                urlType: 'contentdm_api',
                viewerUrl: `https://cdm21059.contentdm.oclc.org/digital/collection/${apiMatch[1]}/id/${apiMatch[2]}/rec/1`
            };
        }

        // If no patterns match, throw a helpful error
        throw new Error(`Unsupported Florence URL format: ${url}

Supported formats:
• Manuscript viewer: https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/ID/rec/1
• IIIF image: https://cdm21059.contentdm.oclc.org/iiif/2/plutei:ID/full/max/0/default.jpg
• IIIF manifest: https://cdm21059.contentdm.oclc.org/iiif/2/plutei:ID/manifest.json
• ContentDM API: https://cdm21059.contentdm.oclc.org/digital/api/singleitem/image/plutei/ID/default.jpg`);
    }

    /**
     * Establish ContentDM session by visiting collection page to get JSESSIONID cookie
     */
    private async establishSession(): Promise<void> {
        if (this.sessionCookie) {
            return; // Already have session
        }

        try {
            // Visit the collection page to establish session
            const collectionUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei';
            const response = await this.deps.fetchWithHTTPS(collectionUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Referer': 'https://cdm21059.contentdm.oclc.org/',
                    'Cache-Control': 'no-cache'
                }
            });

            // Extract JSESSIONID from set-cookie headers
            const setCookie = response.headers.get('set-cookie');
            if (setCookie) {
                const match = setCookie.match(/JSESSIONID=([^;]+)/);
                if (match) {
                    this.sessionCookie = `JSESSIONID=${match[1]}`;
                    this.deps.logger.log({
                        level: 'info',
                        library: 'florence',
                        message: 'ContentDM session established successfully'
                    });
                }
            }
        } catch (error) {
            this.deps.logger.log({
                level: 'warn',
                library: 'florence',
                message: 'Failed to establish ContentDM session, proceeding without'
            });
        }
    }

    /**
     * Get session-aware headers for ContentDM requests
     */
    private getSessionHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'image/*,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://cdm21059.contentdm.oclc.org/',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'same-origin',
            'DNT': '1'
        };

        if (this.sessionCookie) {
            headers['Cookie'] = this.sessionCookie;
        }

        return headers;
    }

    
    getLibraryName(): string {
        return 'florence';
    }

    /**
     * Determine the best high-resolution variant supported by the Florence IIIF server (with fallbacks)
     */
    private async resolveBestImageVariant(collection: string, pageId: string): Promise<
        { kind: 'iiif', sizeMode: 'max' | 'full' | 'pct' | 'width', width?: number } | { kind: 'native' }
    > {
        const baseIiif = `https://cdm21059.contentdm.oclc.org/digital/iiif/${collection}/${pageId}`;
        const probes: Array<{ url: string; mode: 'max' | 'full' | 'pct' }> = [
            { url: `${baseIiif}/full/max/0/default.jpg`, mode: 'max' },
            { url: `${baseIiif}/full/full/0/default.jpg`, mode: 'full' },
            { url: `${baseIiif}/full/pct:100/0/default.jpg`, mode: 'pct' },
        ];
        
        try {
            // Try common IIIF maximum-size syntaxes
            for (const p of probes) {
                const response = await this.deps.fetchWithHTTPS(p.url, {
                    method: 'HEAD',
                    headers: this.getSessionHeaders()
                });
                if (response.ok) {
                    return { kind: 'iiif', sizeMode: p.mode };
                }
            }
            
            // If these failed, try exact native width from info.json
            const infoUrl = `${baseIiif}/info.json`;
            try {
                const infoResp = await this.deps.fetchWithHTTPS(infoUrl, { headers: this.getSessionHeaders() });
                if (infoResp.ok) {
                    const info = await infoResp.json() as { width?: number };
                    const w = (info && typeof info['width'] === 'number') ? info['width'] : undefined;
                    if (w && w > 0) {
                        const widthUrl = `${baseIiif}/full/${w},/0/default.jpg`;
                        const widthHead = await this.deps.fetchWithHTTPS(widthUrl, { method: 'HEAD', headers: this.getSessionHeaders() });
                        if (widthHead.ok) {
                            return { kind: 'iiif', sizeMode: 'width', width: w };
                        }
                    }
                }
            } catch {
                // ignore info.json errors and continue to native fallback
            }
            
            // Final fallback: native ContentDM API (lower resolution on some servers)
            return { kind: 'native' };
        } catch {
            // On unexpected errors, be conservative and use native
            return { kind: 'native' };
        }
    }

    /**
     * Validate page accessibility to filter out 403/501 gaps and missing content in ContentDM sequence
     */
    private async validatePageAccessibility(collection: string, pages: Array<{ id: string; title: string }>): Promise<Array<{ id: string; title: string }>> {
        const maxValidation = 20; // Don't validate too many to avoid overwhelming server
        const validatedPages: Array<{ id: string; title: string }> = [];
        
        // If there are many pages, sample validate first portion + random selection
        const pagesToValidate = pages.length <= maxValidation ? pages : [
            ...pages.slice(0, 10), // First 10 pages
            ...pages.slice(-5),     // Last 5 pages
            ...pages.filter((_, i) => i % Math.ceil(pages.length / 5) === 0).slice(0, 5) // Every ~20% sample
        ];
        
        this.deps.logger.log({
            level: 'info',
            library: 'florence',
            message: `Validating ${pagesToValidate.length} pages for accessibility (${pages.length} total pages)`
        });
        
        const validationStart = Date.now();
        let validCount = 0;
        let invalidCount = 0;
        
        for (const page of pagesToValidate) {
            try {
                const baseIiif = `https://cdm21059.contentdm.oclc.org/digital/iiif/${collection}/${page.id}`;
                const probes = [
                    `${baseIiif}/full/max/0/default.jpg`,
                    `${baseIiif}/full/full/0/default.jpg`,
                    `${baseIiif}/full/pct:100/0/default.jpg`
                ];
                let ok = false;
                let lastStatus = 0;
                let lastText = '';
                for (const url of probes) {
                    const response = await this.deps.fetchWithHTTPS(url, {
                        method: 'HEAD',
                        headers: this.getSessionHeaders()
                    });
                    if (response.ok) { ok = true; break; }
                    lastStatus = response.status;
                    lastText = response.statusText;
                }
                
                if (ok) {
                    validCount++;
                } else if (lastStatus === 403 || lastStatus === 501) {
                    invalidCount++;
                    this.deps.logger.log({
                        level: 'warn',
                        library: 'florence',
                        message: `Page ${page.id} inaccessible: ${lastStatus} ${lastText} - skipping`
                    });
                    continue; // Skip invalid pages
                } else {
                    // For other errors, check if it's a "no file associated" case by fetching the actual page
                    const pageUrl = `https://cdm21059.contentdm.oclc.org/digital/collection/${collection}/id/${page.id}`;
                    try {
                        const pageResponse = await this.deps.fetchWithHTTPS(pageUrl, {
                            headers: this.getSessionHeaders()
                        });
                        
                        if (pageResponse.ok) {
                            const pageHtml = await pageResponse.text();
                            if (pageHtml.includes('Nessun file è associato a questo item') || 
                                pageHtml.includes('No file is associated with this item')) {
                                invalidCount++;
                                this.deps.logger.log({
                                    level: 'warn',
                                    library: 'florence',
                                    message: `Page ${page.id} has no associated file - skipping`
                                });
                                continue; // Skip pages with no associated files
                            }
                        }
                    } catch (pageError) {
                        // If page check fails, fall back to HTTP status handling
                    }
                    
                    // Other errors might be temporary - include page but log warning
                    this.deps.logger.log({
                        level: 'warn',
                        library: 'florence',
                        message: `Page ${page.id} validation warning: ${lastStatus} ${lastText} - including anyway`
                    });
                }
                
                validatedPages.push(page);
                
            } catch (error) {
                this.deps.logger.log({
                    level: 'warn',
                    library: 'florence',
                    message: `Page ${page.id} validation error: ${error instanceof Error ? error.message : String(error)} - including anyway`
                });
                validatedPages.push(page); // Include on network errors
            }
            
            // Rate limiting during validation
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const validationDuration = Date.now() - validationStart;
        
        // If we validated a sample and found ANY invalid pages, we need to validate all for ContentDM
        if (pagesToValidate.length < pages.length) {
            const invalidRate = invalidCount / pagesToValidate.length;
            
            if (invalidCount > 0) {
                // ANY invalid pages found - ContentDM requires full validation due to irregular gaps
                this.deps.logger.log({
                    level: 'warn',
                    library: 'florence',
                    message: `Invalid pages detected (${Math.round(invalidRate * 100)}% rate), validating all ${pages.length} pages to filter gaps...`
                });
                
                return await this.validateAllPages(collection, pages);
            }
            
            // No invalid pages in sample - assume all pages are valid
            this.deps.logger.log({
                level: 'info',
                library: 'florence',
                message: `Validation complete: ${validCount} valid, ${invalidCount} invalid in ${validationDuration}ms. All pages should be accessible.`
            });
            return pages;
        }
        
        this.deps.logger.log({
            level: 'info',
            library: 'florence',
            message: `Page validation complete: ${validatedPages.length} valid pages in ${validationDuration}ms`
        });
        
        return validatedPages;
    }
    
    /**
     * Validate all pages when gaps detected - optimized for ContentDM patterns with intelligent gap detection
     */
    private async validateAllPages(collection: string, pages: Array<{ id: string; title: string }>): Promise<Array<{ id: string; title: string }>> {
        console.log(`📄 Starting comprehensive validation of ${pages.length} pages...`);
        const validatedPages: Array<{ id: string; title: string }> = [];
        const batchSize = 20; // Larger batches for efficiency
        
        for (let i = 0; i < pages.length; i += batchSize) {
            const batch = pages.slice(i, i + batchSize);
            
            // Process batch with limited concurrency
            const validationPromises = batch.map(async (page, index) => {
                try {
                    const baseIiif = `https://cdm21059.contentdm.oclc.org/digital/iiif/${collection}/${page.id}`;
                    const probes = [
                        `${baseIiif}/full/max/0/default.jpg`,
                        `${baseIiif}/full/full/0/default.jpg`,
                        `${baseIiif}/full/pct:100/0/default.jpg`
                    ];
                    
                    // Stagger requests to avoid overwhelming server
                    await new Promise(resolve => setTimeout(resolve, index * 20));
                    
                    let ok = false;
                    let lastStatus = 0;
                    for (const url of probes) {
                        const response = await this.deps.fetchWithHTTPS(url, {
                            method: 'HEAD',
                            headers: this.getSessionHeaders()
                        });
                        if (response.ok) { ok = true; break; }
                        lastStatus = response.status;
                    }
                    
                    if (ok) {
                        return page;
                    } else if (lastStatus === 403 || lastStatus === 501) {
                        // Known error codes - skip immediately
                        return null;
                    } else {
                        // For other errors, check if page has actual content by examining the viewer page
                        const pageUrl = `https://cdm21059.contentdm.oclc.org/digital/collection/${collection}/id/${page.id}`;
                        try {
                            const pageResponse = await this.deps.fetchWithHTTPS(pageUrl, {
                                headers: this.getSessionHeaders()
                            });
                            
                            if (pageResponse.ok) {
                                const pageHtml = await pageResponse.text();
                                
                                // Check for Italian and English "no file associated" messages
                                if (pageHtml.includes('Nessun file è associato a questo item') || 
                                    pageHtml.includes('No file is associated with this item') ||
                                    pageHtml.includes('No file associated with this item')) {
                                    return null; // Skip pages with no associated files
                                }
                                
                                // If page loads but image fails, it might be a temporary issue - include it
                                return page;
                            }
                        } catch (pageError) {
                            // If page check fails, fall back to excluding the page to be safe
                            return null;
                        }
                    }
                    
                    // Return null for any other error conditions to be conservative
                    return null;
                    
                } catch (error) {
                    // Return null for network errors too - be strict for ContentDM
                    return null;
                }
            });
            
            const batchResults = await Promise.all(validationPromises);
            const validPages = batchResults.filter((page): page is { id: string; title: string } => page !== null);
            
            validatedPages.push(...validPages);
            
            // Progress logging
            const progress = Math.min(i + batchSize, pages.length);
            const validRate = Math.round((validatedPages.length / progress) * 100);
            console.log(`📄 Validated ${progress}/${pages.length} pages, ${validatedPages.length} valid (${validRate}% success rate)`);
            
            // Short delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`✅ Validation complete: ${validatedPages.length} valid pages from ${pages.length} total`);
        return validatedPages;
    }

    /**
     * Test Florence IIIF image accessibility - ensure high resolution endpoints respond
     */
    private async validateNativeAPIAccess(collection: string, samplePageId: string, manuscriptId: string): Promise<{ kind: 'iiif', sizeMode: 'max' | 'full' | 'pct' | 'width', width?: number } | { kind: 'native' }> {
        this.deps.logger.log({
            level: 'info',
            library: 'florence',
            message: `Testing Florence IIIF access for manuscript ${manuscriptId} (sample page: ${samplePageId})`
        });
        
        const variant = await this.resolveBestImageVariant(collection, samplePageId);
        
        if (variant.kind === 'iiif') {
            this.deps.logger.log({
                level: 'info',
                library: 'florence',
                message: `Florence IIIF confirmed (mode: ${variant.sizeMode}${variant.sizeMode === 'width' ? `=${variant.width}` : ''}) for manuscript ${manuscriptId}`
            });
            return variant;
        } else {
            this.deps.logger.log({
                level: 'warn',
                library: 'florence',
                message: `Falling back to native ContentDM API for manuscript ${manuscriptId}`
            });
            return variant;
        }
    }
    
    async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
        // Log the start of Florence manifest loading
        this.deps.logger.log({
            level: 'info',
            library: 'florence',
            url: originalUrl,
            message: 'Starting Florence manifest load',
            details: { method: 'loadFlorenceManifest' }
        });
        
        // CRITICAL: Establish ContentDM session before any requests
        await this.establishSession();
        
        try {
            // Use intelligent URL parsing to handle multiple Florence URL formats
            const parsed = this.parseFlorenceUrl(originalUrl);
            const collection = parsed.collection;
            const itemId = parsed.itemId;

            // Log the intelligent handling strategy
            let processingNote = '';
            switch (parsed.urlType) {
                case 'manuscript_viewer':
                    processingNote = 'Using manuscript viewer URL for standard processing';
                    break;
                case 'iiif_image':
                    processingNote = 'Single IIIF image detected - will discover full manuscript';
                    break;
                case 'contentdm_api':
                    processingNote = 'ContentDM API URL detected - will discover full manuscript';
                    break;
                case 'iiif_manifest':
                    processingNote = 'IIIF manifest detected - will discover full manuscript';
                    break;
            }

            this.deps.logger.log({
                level: 'info',
                library: 'florence',
                message: `Florence URL processing: ${processingNote} (collection: ${collection}, itemId: ${itemId})`
            });

            console.log(`🔍 Florence: collection=${collection}, itemId=${itemId}`);

            // For IIIF URLs, we need to convert to manuscript viewer URL for proper processing
            const processingUrl = parsed.urlType !== 'manuscript_viewer' 
                ? `https://cdm21059.contentdm.oclc.org/digital/collection/${collection}/id/${itemId}/rec/1`
                : originalUrl;

            if (processingUrl !== originalUrl) {
                this.deps.logger.log({
                    level: 'info',
                    library: 'florence',
                    message: `Converting to manuscript viewer URL for processing: ${processingUrl}`
                });
            }

            // Fetch the HTML page to extract the initial state with all children
            console.log('📄 Fetching Florence page HTML to extract manuscript structure...');
            const sessionHeaders = this.getSessionHeaders();
            const pageResponse = await this.deps.fetchWithHTTPS(processingUrl, {
                headers: {
                    ...sessionHeaders,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });

            if (!pageResponse.ok) {
                throw new Error(`Failed to fetch Florence page: HTTP ${pageResponse.status}`);
            }

            const html = await pageResponse.text();
            console.log(`📄 Page HTML retrieved (${html?.length} characters)`);

            // Extract __INITIAL_STATE__ from the HTML
            const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*JSON\.parse\("(.+?)"\);/);
            if (!stateMatch) {
                throw new Error('Could not find __INITIAL_STATE__ in Florence page');
            }

            // Unescape the JSON string
            const escapedJson = stateMatch[1];
            if (!escapedJson) {
                throw new Error('Florence state match found but content is empty');
            }
            const unescapedJson = escapedJson
                ?.replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\')
                .replace(/\\u0026/g, '&')
                .replace(/\\u003c/g, '<')
                .replace(/\\u003e/g, '>')
                .replace(/\\u002F/g, '/');

            let state: FlorenceState;
            try {
                state = JSON.parse(unescapedJson);
            } catch {
                console.error('Failed to parse Florence state JSON');
                throw new Error('Could not parse Florence page state');
            }

            // Extract item and parent data from state
            const itemData = state?.item?.item;
            if (!itemData) {
                throw new Error('No item data found in Florence page state');
            }

            let pages: Array<{ id: string; title: string }> = [];
            let displayName = 'Florence Manuscript';

            // Check if this item has a parent (compound object)
            if (itemData.parentId && itemData.parentId !== -1) {
                // This is a child page - get all siblings from parent
                if (itemData.parent && itemData.parent.children && Array.isArray(itemData.parent.children)) {
                    console.log(`📄 Found ${itemData.parent.children?.length} pages in parent compound object`);
                    
                    // Filter out non-page items (like Color Chart, Dorso, etc.)
                    pages = itemData.parent.children
                        .filter((child: FlorenceChild) => {
                            const title = (child.title || '').toLowerCase();
                            // Include carta/folio pages, exclude color charts and binding parts
                            return !title.includes('color chart') && 
                                   !title.includes('dorso') && 
                                   !title.includes('piatto') &&
                                   !title.includes('controguardia');
                        })
                        .map((child: FlorenceChild) => ({
                            id: child.id.toString(),
                            title: child.title || `Page ${child.id}`
                        }));

                    // Extract display name from parent metadata
                    if (itemData.parent.fields) {
                        // First check for segnatura (signature) as it's more concise
                        const subjecField = itemData.parent.fields.find((f: FlorenceField) => f.key === 'subjec');
                        const identField = itemData.parent.fields.find((f: FlorenceField) => f.key === 'identi');
                        const titleField = itemData.parent.fields.find((f: FlorenceField) => f.key === 'title' || f.key === 'titlea');
                        
                        if (subjecField && subjecField.value) {
                            // Use signature as primary identifier
                            displayName = subjecField.value;
                            
                            // Add shortened title if available
                            if (titleField && titleField.value) {
                                const shortTitle = titleField.value?.split('.')[0]?.substring(0, 50);
                                displayName = `${subjecField.value} - ${shortTitle}`;
                            }
                        } else if (identField && identField.value) {
                            // Use identifier if no signature
                            displayName = identField.value;
                        } else if (titleField && titleField.value) {
                            // Fall back to title only
                            displayName = titleField.value.substring(0, 80);
                        }
                    }
                } else {
                    throw new Error('Parent compound object has no children data');
                }
            } else {
                // This might be a parent itself or a single page
                // Check the current page for children
                const currentPageChildren = state?.item?.children;
                if (currentPageChildren && Array.isArray(currentPageChildren) && currentPageChildren?.length > 0) {
                    console.log(`📄 Found ${currentPageChildren?.length} child pages in current item`);
                    
                    pages = currentPageChildren
                        .filter((child: FlorenceChild) => {
                            const title = (child.title || '').toLowerCase();
                            return !title.includes('color chart') && 
                                   !title.includes('dorso') && 
                                   !title.includes('piatto') &&
                                   !title.includes('controguardia');
                        })
                        .map((child: FlorenceChild) => ({
                            id: child.id.toString(),
                            title: child.title || `Page ${child.id}`
                        }));

                    // Extract display name from current item
                    if (itemData.fields) {
                        // First check for segnatura (signature) as it's more concise
                        const subjecField = itemData.fields.find((f: FlorenceField) => f.key === 'subjec');
                        const identField = itemData.fields.find((f: FlorenceField) => f.key === 'identi');
                        const titleField = itemData.fields.find((f: FlorenceField) => f.key === 'title' || f.key === 'titlea');
                        
                        if (subjecField && subjecField.value) {
                            // Use signature as primary identifier
                            displayName = subjecField.value;
                            
                            // Add shortened title if available
                            if (titleField && titleField.value) {
                                const shortTitle = titleField.value?.split('.')[0]?.substring(0, 50);
                                displayName = `${subjecField.value} - ${shortTitle}`;
                            }
                        } else if (identField && identField.value) {
                            // Use identifier if no signature
                            displayName = identField.value;
                        } else if (titleField && titleField.value) {
                            // Fall back to title only
                            displayName = titleField.value.substring(0, 80);
                        }
                    }
                } else {
                    // Single page manuscript
                    pages = [{
                        id: itemId || '',
                        title: itemData.title || 'Page 1'
                    }];
                    
                    displayName = itemData.title || displayName;
                    console.log('📄 Single page manuscript');
                }
            }

            if (pages?.length === 0) {
                throw new Error('No pages found in Florence manuscript');
            }

            console.log(`📄 Extracted ${pages?.length} manuscript pages (excluding binding/charts)`);

            // CRITICAL: Validate page accessibility to filter out 403/501 gaps
            console.log('📄 Validating page accessibility to filter gaps...');
            const validatedPages = await this.validatePageAccessibility(collection, pages);
            
            if (validatedPages.length === 0) {
                throw new Error('No accessible pages found after validation');
            }
            
            const filteredCount = pages.length - validatedPages.length;
            if (filteredCount > 0) {
                console.log(`📄 Filtered out ${filteredCount} inaccessible pages, ${validatedPages.length} pages remaining`);
            }

            // Validate ContentDM native API access with first validated page
            const manuscriptId = itemId || 'unknown';
            const samplePageId = validatedPages[0]?.id ? validatedPages[0].id.toString() : '217712';
            const variant = await this.validateNativeAPIAccess(collection, samplePageId, manuscriptId);
            
            // Use validated pages for URL generation
            pages = validatedPages;
            
            let pageLinks: string[] = [];
            if (variant.kind === 'iiif') {
                const toUrl = (pageId: string) => {
                    const baseIiif = `https://cdm21059.contentdm.oclc.org/digital/iiif/${collection}/${pageId}`;
                    switch (variant.sizeMode) {
                        case 'max':
                            return `${baseIiif}/full/max/0/default.jpg`;
                        case 'full':
                            return `${baseIiif}/full/full/0/default.jpg`;
                        case 'pct':
                            return `${baseIiif}/full/pct:100/0/default.jpg`;
                        case 'width':
                            return `${baseIiif}/full/${variant.width},/0/default.jpg`;
                    }
                };
                pageLinks = pages.map(p => toUrl(p.id));
                console.log(`📄 Florence manuscript processed: ${pageLinks.length} pages using IIIF Image API (${variant.sizeMode}${variant.sizeMode === 'width' ? `=${variant.width}` : ''}) for maximum resolution`);
            } else {
                // Native fallback (should be rare). Note: may be lower resolution but ensures robustness.
                pageLinks = pages.map(page => `https://cdm21059.contentdm.oclc.org/digital/api/singleitem/image/${collection}/${page.id}/default.jpg`);
                console.log(`📄 Florence manuscript processed: ${pageLinks.length} pages using native ContentDM API fallback (lower resolution)`);
            }

            return {
                pageLinks,
                totalPages: pageLinks?.length,
                library: 'florence',
                displayName: displayName,
                originalUrl: originalUrl,
            };

        } catch (error: any) {
            this.deps.logger.logDownloadError('florence', originalUrl, error as Error);
            throw new Error(`Failed to load Florence manuscript: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}