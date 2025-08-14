import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class WolfenbuettelLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'wolfenbuettel';
    }
    
    async loadManifest(wolfenbuettelUrl: string): Promise<ManuscriptManifest> {
            try {
                // URL formats:
                // 1. https://diglib.hab.de/wdb.php?dir=mss/1008-helmst
                // 2. https://diglib.hab.de/varia/selecta/ed000011/start.htm?distype=thumbs-img&imgtyp=0&size=
                
                let manuscriptId: string;
                
                // Try original format first
                const dirMatch = wolfenbuettelUrl.match(/dir=mss\/([^&]+)/);
                if (dirMatch) {
                    manuscriptId = dirMatch[1] || '';
                } else {
                    // Try alternative format - extract from path
                    const pathMatch = wolfenbuettelUrl.match(/diglib\.hab\.de\/([^/]+\/[^/]+\/[^/]+)/);
                    if (!pathMatch) {
                        throw new Error('Could not extract manuscript ID from Wolfenbüttel URL');
                    }
                    manuscriptId = pathMatch[1] || ''; // e.g., "varia/selecta/ed000011"
                }
                console.log(`Loading Wolfenbüttel manuscript: ${manuscriptId}`);
                
                // First try to get page list from thumbs.php with pagination
                const pageLinks: string[] = [];
                const allImageNames: string[] = [];
                
                try {
                    let pointer = 0;
                    let hasMorePages = true;
                    
                    while (hasMorePages) {
                        // Construct thumbs URL based on manuscript ID format
                        let thumbsUrl: string;
                        if (!manuscriptId) {
                            throw new Error('Manuscript ID is required for Wolfenbüttel loader');
                        }
                        
                        if (manuscriptId.startsWith('mss/')) {
                            // Already has mss/ prefix
                            thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=${manuscriptId}&pointer=${pointer}`;
                        } else if (manuscriptId.includes('/')) {
                            // Alternative format like varia/selecta/ed000011
                            thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=${manuscriptId}&pointer=${pointer}`;
                        } else {
                            // Just the manuscript number
                            thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=mss/${manuscriptId}&pointer=${pointer}`;
                        }
                        console.log(`Fetching page list from: ${thumbsUrl} (pointer=${pointer})`);
                        
                        const thumbsResponse = await this.deps.fetchWithProxyFallback(thumbsUrl);
                        if (thumbsResponse.ok) {
                            const thumbsHtml = await thumbsResponse.text();
                            
                            // Extract image names from current thumbs page
                            const imageMatches = thumbsHtml.matchAll(/image=([^'"&]+)/g);
                            const imageNames = Array.from(imageMatches, m => m[1]!).filter(name => name);
                            
                            if (imageNames?.length > 0) {
                                allImageNames.push(...imageNames);
                                console.log(`Found ${imageNames?.length} images on page (total so far: ${allImageNames?.length})`);
                                
                                // Check if there's a next page link (forward button)
                                // Updated regex to handle both mss/ and other directory structures
                                const nextPageMatch = thumbsHtml.match(/href="thumbs\.php\?dir=[^&]+&pointer=(\d+)"[^>]*><img[^>]*title="forward"/);
                                if (nextPageMatch) {
                                    const nextPointer = parseInt(nextPageMatch[1] || '0', 10);
                                    // Check if we're stuck on the same page (last page scenario)
                                    if (nextPointer === pointer) {
                                        hasMorePages = false;
                                    } else {
                                        pointer = nextPointer;
                                    }
                                } else {
                                    hasMorePages = false;
                                }
                            } else {
                                hasMorePages = false;
                            }
                        } else {
                            hasMorePages = false;
                        }
                    }
                    
                    if (allImageNames?.length > 0) {
                        // Remove duplicates from collected image names
                        const uniqueImageNames = [...new Set(allImageNames)];
                        console.log(`Total unique images found: ${uniqueImageNames?.length} (from ${allImageNames?.length} total)`);
                        
                        // Convert all unique image names to full URLs using maximum resolution
                        for (const imageName of uniqueImageNames) {
                            let imageUrl: string;
                            if (manuscriptId.includes('/')) {
                                // Already includes path structure
                                imageUrl = `http://diglib.hab.de/${manuscriptId}/max/${imageName}.jpg`;
                            } else {
                                // Just manuscript number, add mss/ prefix
                                imageUrl = `http://diglib.hab.de/mss/${manuscriptId}/max/${imageName}.jpg`;
                            }
                            pageLinks.push(imageUrl);
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to fetch thumbs pages: ${error}`);
                }
                
                // If thumbs approach failed, fall back to sequential number testing
                if (pageLinks?.length === 0) {
                    console.log('Falling back to sequential page detection');
                    let baseImageUrl: string;
                    if (manuscriptId.includes('/')) {
                        // Already includes path structure
                        baseImageUrl = `http://diglib.hab.de/${manuscriptId}/max`;
                    } else {
                        // Just manuscript number, add mss/ prefix
                        baseImageUrl = `http://diglib.hab.de/mss/${manuscriptId}/max`;
                    }
                    
                    // Ensure baseImageUrl is defined
                    if (!baseImageUrl) {
                        baseImageUrl = `http://diglib.hab.de/mss/${manuscriptId}/max`;
                    }
                    
                    let pageNum = 1;
                    let consecutiveFailures = 0;
                    
                    while (consecutiveFailures < 10 && pageNum <= 500) { // Maximum 500 pages
                        const pageStr = pageNum.toString().padStart(5, '0');
                        const imageUrl = `${baseImageUrl}/${pageStr}.jpg`;
                        
                        try {
                            const response = await this.deps.fetchWithProxyFallback(imageUrl);
                            if (response.status === 200) {
                                pageLinks.push(imageUrl);
                                consecutiveFailures = 0;
                            } else {
                                consecutiveFailures++;
                            }
                        } catch {
                            consecutiveFailures++;
                        }
                        
                        pageNum++;
                    }
                }
    
                if (pageLinks?.length === 0) {
                    throw new Error(`No pages found for Wolfenbüttel manuscript: ${manuscriptId}`);
                }
    
                const displayName = `Wolfenbüttel HAB MS ${manuscriptId}`;
                
                console.log(`Found ${pageLinks?.length} pages in Wolfenbüttel manuscript`);
    
                const wolfenbuettelManifest = {
                    displayName,
                    pageLinks,
                    library: 'wolfenbuettel' as const,
                    manifestUrl: wolfenbuettelUrl,
                    originalUrl: wolfenbuettelUrl,
                    totalPages: pageLinks.length
                };
    
                this.deps.manifestCache.set(wolfenbuettelUrl, wolfenbuettelManifest).catch(console.warn);
    
                return wolfenbuettelManifest;
    
            } catch (error) {
                throw new Error(`Failed to load Wolfenbüttel manuscript: ${(error as Error).message}`);
            }
        }
}