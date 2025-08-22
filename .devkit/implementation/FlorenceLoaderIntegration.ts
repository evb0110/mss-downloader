#!/usr/bin/env bun

/**
 * Florence Loader Integration with Production Download Logic
 * 
 * This file contains the updated FlorenceLoader that integrates the enhanced
 * download logic with per-page size detection and 403 error handling.
 * 
 * Ready for integration into the main application.
 */

import { BaseLibraryLoader, type LoaderDependencies } from '../../../src/main/services/library-loaders/types';
import type { ManuscriptManifest } from '../../../src/shared/types';

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

export class FlorenceLoaderWithIntelligentSizing extends BaseLibraryLoader {
    private readonly SIZE_CASCADE = [4000, 2048, 1024, 800, 600, 400, 300]; // Aggressive size cascade
    private readonly manuscriptSizeCache = new Map<string, number>(); // Manuscript-level cache
    private readonly pageSizeCache = new Map<string, Map<string, number>>(); // Per-page cache by manuscript

    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'florence';
    }

    /**
     * Test a specific image size for availability with enhanced error handling
     */
    private async testImageSize(collection: string, pageId: string, width: number): Promise<{ 
        success: boolean; 
        error?: string;
        responseTime?: number;
    }> {
        const startTime = Date.now();
        const testUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${pageId}/full/${width},/0/default.jpg`;
        
        try {
            const response = await this.deps.fetchWithHTTPS(testUrl, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'image/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://cdm21059.contentdm.oclc.org/',
                    'Origin': 'https://cdm21059.contentdm.oclc.org',
                    'Sec-Fetch-Dest': 'image',
                    'Sec-Fetch-Mode': 'no-cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'Cache-Control': 'no-cache'
                }
            });
            
            const responseTime = Date.now() - startTime;
            
            if (response.ok) {
                return { success: true, responseTime };
            } else {
                return { 
                    success: false, 
                    error: `HTTP ${response.status}: ${response.statusText}`,
                    responseTime
                };
            }
        } catch (error: any) {
            return { 
                success: false, 
                error: error.message || String(error),
                responseTime: Date.now() - startTime
            };
        }
    }

    /**
     * Determine optimal size for a specific page with caching
     */
    private async determinePageOptimalSize(
        collection: string, 
        pageId: string, 
        manuscriptId: string
    ): Promise<{ optimalSize: number; cacheHit: boolean; attempts: number }> {
        // Check page-specific cache first
        const manuscriptCache = this.pageSizeCache.get(manuscriptId);
        if (manuscriptCache?.has(pageId)) {
            const cachedSize = manuscriptCache.get(pageId)!;
            this.deps.logger.log({
                level: 'info',
                library: 'florence',
                message: `Using cached page size: ${cachedSize}px for page ${pageId} in manuscript ${manuscriptId}`
            });
            return { optimalSize: cachedSize, cacheHit: true, attempts: 0 };
        }
        
        this.deps.logger.log({
            level: 'info',
            library: 'florence',
            message: `Testing sizes for page ${pageId} in manuscript ${manuscriptId}`
        });
        
        let attempts = 0;
        
        // Test sizes in cascade order
        for (const width of this.SIZE_CASCADE) {
            attempts++;
            
            // Add delay between tests to be respectful to ContentDM
            if (attempts > 1) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
            const result = await this.testImageSize(collection, pageId, width);
            
            if (result.success) {
                // Cache the successful size for this page
                if (!this.pageSizeCache.has(manuscriptId)) {
                    this.pageSizeCache.set(manuscriptId, new Map());
                }
                this.pageSizeCache.get(manuscriptId)!.set(pageId, width);
                
                this.deps.logger.log({
                    level: 'info',
                    library: 'florence',
                    message: `Found optimal size for page ${pageId}: ${width}px (${attempts} attempts, ${result.responseTime}ms)`
                });
                
                return { optimalSize: width, cacheHit: false, attempts };
            } else {
                this.deps.logger.log({
                    level: 'warn',
                    library: 'florence',
                    message: `Size ${width}px failed for page ${pageId}: ${result.error} (${result.responseTime}ms)`
                });
            }
        }
        
        // If all sizes fail, use the smallest as emergency fallback
        const fallbackSize = this.SIZE_CASCADE[this.SIZE_CASCADE.length - 1];
        this.deps.logger.log({
            level: 'error',
            library: 'florence',
            message: `All size tests failed for page ${pageId}, using fallback: ${fallbackSize}px`
        });
        
        return { optimalSize: fallbackSize, cacheHit: false, attempts };
    }

    /**
     * Determine manuscript-level optimal size by testing sample pages
     */
    private async determineManuscriptOptimalSize(
        collection: string, 
        samplePages: string[], 
        manuscriptId: string
    ): Promise<{ optimalSize: number; cacheHit: boolean; pagesRequireIndividualSizing: boolean }> {
        // Check manuscript-level cache first
        const cachedSize = this.manuscriptSizeCache.get(manuscriptId);
        if (cachedSize) {
            this.deps.logger.log({
                level: 'info',
                library: 'florence',
                message: `Using cached manuscript size: ${cachedSize}px for manuscript ${manuscriptId}`
            });
            return { optimalSize: cachedSize, cacheHit: true, pagesRequireIndividualSizing: false };
        }
        
        this.deps.logger.log({
            level: 'info',
            library: 'florence',
            message: `Determining manuscript-level optimal size for ${manuscriptId} by testing ${samplePages.length} sample pages`
        });
        
        const sampleResults = new Map<number, number>(); // size -> success count
        let pagesRequireIndividualSizing = false;
        
        // Test a few sample pages to determine if there's a consistent size that works
        const pagesToTest = samplePages.slice(0, Math.min(3, samplePages.length));
        
        for (const pageId of pagesToTest) {
            const { optimalSize } = await this.determinePageOptimalSize(collection, pageId, manuscriptId);
            sampleResults.set(optimalSize, (sampleResults.get(optimalSize) || 0) + 1);
        }
        
        // Analyze results
        const sizes = Array.from(sampleResults.entries()).sort((a, b) => b[1] - a[1]); // Sort by frequency
        const mostCommonSize = sizes[0]?.[0];
        const mostCommonCount = sizes[0]?.[1];
        
        if (mostCommonCount === pagesToTest.length) {
            // All pages use the same size - we can use manuscript-level caching
            this.manuscriptSizeCache.set(manuscriptId, mostCommonSize);
            
            this.deps.logger.log({
                level: 'info',
                library: 'florence',
                message: `Manuscript ${manuscriptId} consistently uses ${mostCommonSize}px across all sample pages`
            });
            
            return { 
                optimalSize: mostCommonSize, 
                cacheHit: false, 
                pagesRequireIndividualSizing: false 
            };
        } else {
            // Pages require different sizes - individual sizing needed
            pagesRequireIndividualSizing = true;
            
            this.deps.logger.log({
                level: 'warn',
                library: 'florence',
                message: `Manuscript ${manuscriptId} has mixed size requirements - will use per-page sizing`
            });
            
            // Use the most common size as fallback, but flag for individual sizing
            return { 
                optimalSize: mostCommonSize || this.SIZE_CASCADE[0], 
                cacheHit: false, 
                pagesRequireIndividualSizing: true 
            };
        }
    }
    
    async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
        this.deps.logger.log({
            level: 'info',
            library: 'florence',
            url: originalUrl,
            message: 'Starting Florence manifest load with intelligent sizing',
            details: { method: 'loadFlorenceManifestWithIntelligentSizing' }
        });
        
        try {
            // Extract collection and item ID from URL
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

            // Extract __INITIAL_STATE__ from the HTML (same logic as original)
            const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*JSON\.parse\("(.+?)"\);/);
            if (!stateMatch) {
                throw new Error('Could not find __INITIAL_STATE__ in Florence page');
            }

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

            // Extract pages (same logic as original)
            const itemData = state?.item?.item;
            if (!itemData) {
                throw new Error('No item data found in Florence page state');
            }

            let pages: Array<{ id: string; title: string }> = [];
            let displayName = 'Florence Manuscript';

            // Extract pages and display name (using original logic)
            if (itemData.parentId && itemData.parentId !== -1) {
                if (itemData.parent && itemData.parent.children && Array.isArray(itemData.parent.children)) {
                    console.log(`📄 Found ${itemData.parent.children?.length} pages in parent compound object`);
                    
                    pages = itemData.parent.children
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

                    // Extract display name from parent metadata
                    if (itemData.parent.fields) {
                        const subjecField = itemData.parent.fields.find((f: FlorenceField) => f.key === 'subjec');
                        const identField = itemData.parent.fields.find((f: FlorenceField) => f.key === 'identi');
                        const titleField = itemData.parent.fields.find((f: FlorenceField) => f.key === 'title' || f.key === 'titlea');
                        
                        if (subjecField && subjecField.value) {
                            displayName = subjecField.value;
                            if (titleField && titleField.value) {
                                const shortTitle = titleField.value?.split('.')[0]?.substring(0, 50);
                                displayName = `${subjecField.value} - ${shortTitle}`;
                            }
                        } else if (identField && identField.value) {
                            displayName = identField.value;
                        } else if (titleField && titleField.value) {
                            displayName = titleField.value.substring(0, 80);
                        }
                    }
                } else {
                    throw new Error('Parent compound object has no children data');
                }
            } else {
                // Handle current page children or single page (using original logic)
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
                        const subjecField = itemData.fields.find((f: FlorenceField) => f.key === 'subjec');
                        const identField = itemData.fields.find((f: FlorenceField) => f.key === 'identi');
                        const titleField = itemData.fields.find((f: FlorenceField) => f.key === 'title' || f.key === 'titlea');
                        
                        if (subjecField && subjecField.value) {
                            displayName = subjecField.value;
                            if (titleField && titleField.value) {
                                const shortTitle = titleField.value?.split('.')[0]?.substring(0, 50);
                                displayName = `${subjecField.value} - ${shortTitle}`;
                            }
                        } else if (identField && identField.value) {
                            displayName = identField.value;
                        } else if (titleField && titleField.value) {
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

            // NEW: Intelligent size determination
            const manuscriptId = itemId || 'unknown';
            const samplePageIds = pages.slice(0, 3).map(p => p.id);
            
            const { optimalSize, pagesRequireIndividualSizing } = await this.determineManuscriptOptimalSize(
                collection, 
                samplePageIds, 
                manuscriptId
            );
            
            console.log(`🎯 Florence intelligent sizing: ${optimalSize}px optimal, individual sizing: ${pagesRequireIndividualSizing ? 'REQUIRED' : 'NOT REQUIRED'}`);
            
            // Generate URLs with intelligent sizing
            const pageLinks = pages.map(page => {
                let sizeToUse = optimalSize;
                
                // If individual sizing is required, we'll let the download queue handle per-page optimization
                // For now, use the manuscript optimal size as baseline
                
                return `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/full/${sizeToUse},/0/default.jpg`;
            });

            console.log(`📄 Florence manuscript processed: ${pages?.length} pages with intelligent sizing (${optimalSize}px baseline)`);

            return {
                pageLinks,
                totalPages: pageLinks?.length,
                library: 'florence',
                displayName: displayName,
                originalUrl: originalUrl,
                // Add metadata for download queue to know about individual sizing requirements
                metadata: {
                    collection,
                    manuscriptId,
                    optimalSize,
                    pagesRequireIndividualSizing,
                    pageInfo: pages.map(p => ({ id: p.id, title: p.title }))
                }
            };

        } catch (error: any) {
            this.deps.logger.logDownloadError('florence', originalUrl, error as Error);
            throw new Error(`Failed to load Florence manuscript: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

export { FlorenceLoaderWithIntelligentSizing };