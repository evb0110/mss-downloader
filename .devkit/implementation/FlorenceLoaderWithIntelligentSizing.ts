// Mock types for testing (would import from actual paths in real integration)
interface ManuscriptManifest {
    pageLinks: string[];
    totalPages: number;
    library: string;
    displayName: string;
    originalUrl: string;
}

interface LogEntry {
    level: string;
    library: string;
    url?: string;
    message: string;
    details?: any;
}

interface LoaderDependencies {
    logger: {
        log: (entry: LogEntry) => void;
        logDownloadError: (library: string, url: string, error: Error) => void;
    };
    fetchWithHTTPS: (url: string, options?: any) => Promise<Response>;
}

abstract class BaseLibraryLoader {
    protected deps: LoaderDependencies;
    
    constructor(deps: LoaderDependencies) {
        this.deps = deps;
    }
    
    abstract getLibraryName(): string;
    abstract loadManifest(originalUrl: string): Promise<ManuscriptManifest>;
}

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

interface SizeTestResult {
    width: number;
    success: boolean;
    error?: string;
    responseTime?: number;
}

export class FlorenceLoaderWithIntelligentSizing extends BaseLibraryLoader {
    private readonly SIZE_PREFERENCES = [6000, 4000, 2048, 1024, 800];
    private readonly manuscriptSizeCache = new Map<string, number>();
    
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'florence';
    }
    
    /**
     * Test a specific image size for availability and access permissions
     */
    private async testImageSize(collection: string, pageId: string, width: number): Promise<SizeTestResult> {
        const testUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${pageId}/full/${width},/0/default.jpg`;
        const startTime = Date.now();
        
        try {
            const response = await this.deps.fetchWithHTTPS(testUrl, {
                method: 'HEAD', // Use HEAD to avoid downloading actual image data
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'image/*',
                    'Referer': 'https://cdm21059.contentdm.oclc.org/'
                },
                timeout: 5000 // Quick timeout for size testing
            });
            
            const responseTime = Date.now() - startTime;
            
            if (response.ok) {
                return {
                    width,
                    success: true,
                    responseTime
                };
            } else {
                return {
                    width,
                    success: false,
                    error: `HTTP ${response.status}: ${response.statusText}`,
                    responseTime
                };
            }
        } catch (error: any) {
            const responseTime = Date.now() - startTime;
            return {
                width,
                success: false,
                error: error.message || String(error),
                responseTime
            };
        }
    }
    
    /**
     * Determine optimal image size for a manuscript using intelligent testing
     */
    private async determineOptimalSize(collection: string, samplePageId: string, manuscriptId: string): Promise<number> {
        // Check cache first
        const cachedSize = this.manuscriptSizeCache.get(manuscriptId);
        if (cachedSize) {
            this.deps.logger.log({
                level: 'info',
                library: 'florence',
                message: `Using cached optimal size: ${cachedSize}px for manuscript ${manuscriptId}`,
                details: { cached: true, size: cachedSize }
            });
            return cachedSize;
        }
        
        this.deps.logger.log({
            level: 'info',
            library: 'florence', 
            message: `Testing image sizes for manuscript ${manuscriptId} (sample page: ${samplePageId})`,
            details: { sizesToTest: this.SIZE_PREFERENCES }
        });
        
        // Test sizes in order of preference (high to low)
        for (const width of this.SIZE_PREFERENCES) {
            const result = await this.testImageSize(collection, samplePageId, width);
            
            if (result.success) {
                // Found working size - cache it and return
                this.manuscriptSizeCache.set(manuscriptId, width);
                
                this.deps.logger.log({
                    level: 'info',
                    library: 'florence',
                    message: `Optimal size determined: ${width}px for manuscript ${manuscriptId}`,
                    details: { 
                        size: width, 
                        responseTime: result.responseTime,
                        testedSizes: this.SIZE_PREFERENCES.slice(0, this.SIZE_PREFERENCES.indexOf(width) + 1)
                    }
                });
                
                return width;
            } else {
                this.deps.logger.log({
                    level: 'warn',
                    library: 'florence',
                    message: `Size ${width}px failed for manuscript ${manuscriptId}: ${result.error}`,
                    details: { 
                        size: width, 
                        error: result.error,
                        responseTime: result.responseTime
                    }
                });
                
                // For 403/401 errors, immediately try smaller size
                if (result.error?.includes('403') || result.error?.includes('401') || result.error?.includes('Forbidden')) {
                    continue;
                }
                
                // For other errors (500, network), try once more after brief delay
                if (result.error?.includes('500') || result.error?.includes('timeout') || result.error?.includes('network')) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    const retryResult = await this.testImageSize(collection, samplePageId, width);
                    if (retryResult.success) {
                        this.manuscriptSizeCache.set(manuscriptId, width);
                        
                        this.deps.logger.log({
                            level: 'info',
                            library: 'florence',
                            message: `Optimal size determined on retry: ${width}px for manuscript ${manuscriptId}`,
                            details: { 
                                size: width, 
                                responseTime: retryResult.responseTime,
                                retriedAfterError: result.error
                            }
                        });
                        
                        return width;
                    }
                }
            }
        }
        
        // If all sizes failed, fall back to smallest size without testing
        const fallbackSize = 800;
        this.manuscriptSizeCache.set(manuscriptId, fallbackSize);
        
        this.deps.logger.log({
            level: 'error',
            library: 'florence',
            message: `All size tests failed for manuscript ${manuscriptId}, using fallback size: ${fallbackSize}px`,
            details: { 
                fallbackSize,
                allSizesTested: this.SIZE_PREFERENCES,
                warning: 'This may result in lower quality images'
            }
        });
        
        return fallbackSize;
    }
    
    async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
        // Log the start of Florence manifest loading
        this.deps.logger.log({
            level: 'info',
            library: 'florence',
            url: originalUrl,
            message: 'Starting Florence manifest load with intelligent sizing',
            details: { method: 'loadFlorenceManifest', intelligentSizing: true }
        });
        
        try {
            // Extract collection and item ID from URL
            // Format: https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/25456/rec/1
            const urlMatch = originalUrl.match(/cdm21059\.contentdm\.oclc\.org\/digital\/collection\/([^/]+)\/id\/(\d+)/);
            if (!urlMatch) {
                const error = new Error('Could not extract collection and item ID from Florence URL');
                this.deps.logger.logDownloadError('florence', originalUrl, error);
                throw error;
            }

            const collection = urlMatch[1];
            const itemId = urlMatch[2];
            console.log(`🔍 Florence: collection=${collection}, itemId=${itemId}`);

            // Fetch the HTML page to extract the initial state with all children
            console.log('📄 Fetching Florence page HTML to extract manuscript structure...');
            const pageResponse = await this.deps.fetchWithHTTPS(originalUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Referer': 'https://cdm21059.contentdm.oclc.org/'
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

            // 🚀 INTELLIGENT SIZING: Determine optimal size using first page as test sample
            const firstPageId = pages[0].id;
            const manuscriptId = `${collection}:${itemId}`;
            const optimalWidth = await this.determineOptimalSize(collection, firstPageId, manuscriptId);

            // Generate IIIF URLs for all pages using determined optimal size
            const pageLinks = pages.map(page => {
                return `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/full/${optimalWidth},/0/default.jpg`;
            });

            console.log(`📄 Florence manuscript processed: ${pages?.length} pages with intelligent sizing (${optimalWidth}px width)`);

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