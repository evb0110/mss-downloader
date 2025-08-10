import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class ViennaManuscriptaLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'vienna';
    }
    
    async loadManifest(manuscriptaUrl: string): Promise<ManuscriptManifest> {
            console.log('Loading Vienna Manuscripta manifest for:', manuscriptaUrl);
            
            try {
                // Extract manuscript ID and page number from URL
                // Expected format: https://manuscripta.at/diglit/AT5000-XXXX/0001 (specific page)
                // or: https://manuscripta.at/diglit/AT5000-XXXX (entire manuscript)
                const urlMatch = manuscriptaUrl.match(/\/diglit\/(AT\d+-\d+)(?:\/(\d{4}))?/);
                if (!urlMatch) {
                    throw new Error('Invalid Vienna Manuscripta URL format');
                }
                
                const manuscriptId = urlMatch[1];
                const startPage = urlMatch[2] ? parseInt(urlMatch[2], 10) : null;
                console.log('Manuscript ID:', manuscriptId);
                if (startPage) {
                    console.log('Page range: Starting from page', startPage);
                } else {
                    console.log('Page range: Entire manuscript');
                }
                
                // Try IIIF manifest first (much faster than page discovery)
                try {
                    const manifestUrl = `https://manuscripta.at/diglit/iiif/${manuscriptId}/manifest.json`;
                    console.log(`Vienna Manuscripta: Attempting IIIF manifest at ${manifestUrl}`);
                    
                    const manifestResponse = await this.deps.fetchDirect(manifestUrl);
                    if (manifestResponse.ok) {
                        const iiifManifest = await manifestResponse.json();
                        
                        if (iiifManifest.sequences && iiifManifest.sequences[0] && iiifManifest.sequences[0].canvases) {
                            const canvases = iiifManifest.sequences[0].canvases;
                            console.log(`Vienna Manuscripta: IIIF manifest loaded successfully with ${canvases.length} pages`);
                            
                            // Extract highest quality image URLs from IIIF manifest
                            const pageLinks = canvases.map((canvas: any) => {
                                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                                    const resource = canvas.images[0].resource;
                                    
                                    // Check for service URL (IIIF Image API)
                                    if (resource.service && resource.service['@id']) {
                                        return resource.service['@id'] + '/full/max/0/default.jpg';
                                    }
                                    
                                    // Fallback to resource @id
                                    return resource['@id'] || resource.id;
                                }
                                return null;
                            }).filter((url: string | null): url is string => url !== null);
                            
                            if (pageLinks.length > 0) {
                                // DO NOT pre-filter pageLinks here to avoid hanging issues
                                // Page range filtering will be handled during download process
                                console.log(`Vienna Manuscripta: IIIF manifest loaded with ${pageLinks.length} total pages available`);
                                if (startPage !== null) {
                                    console.log(`Vienna Manuscripta: URL specifies starting from page ${startPage} - this will be handled during download`);
                                }
                                
                                const displayName = iiifManifest.label || `Vienna_${manuscriptId}`;
                                
                                return {
                                    pageLinks: pageLinks, // Return full page list, filtering handled in download
                                    totalPages: pageLinks.length, // Total pages available
                                    library: 'vienna_manuscripta' as const,
                                    displayName: typeof displayName === 'string' ? displayName : displayName[0] || `Vienna_${manuscriptId}`,
                                    originalUrl: manuscriptaUrl,
                                    startPageFromUrl: startPage ?? undefined, // Store URL page number for later use
                                };
                            }
                        }
                    }
                } catch (iiifError: any) {
                    console.warn(`Vienna Manuscripta: IIIF manifest failed (${iiifError.message}), falling back to page discovery`);
                }
                
                // Fallback to direct image URL construction
                console.log('Vienna Manuscripta: Using direct image URL construction method');
                
                // Parse manuscript ID to build image path
                const parts = manuscriptId.match(/(AT)(\d+)-(\d+)/);
                if (!parts) {
                    throw new Error('Invalid Vienna Manuscripta manuscript ID format');
                }
                
                const [, prefix, num1, num2] = parts;
                const imagePath = `https://manuscripta.at/images/${prefix}/${num1}/${manuscriptId}`;
                
                const pageLinks: string[] = [];
                let pageNum = 1;
                let consecutiveFailures = 0;
                
                // Probe for available pages by checking if images exist
                console.log(`Vienna Manuscripta: Probing for pages at ${imagePath}`);
                
                while (consecutiveFailures < 3 && pageNum <= 500) { // Stop after 3 consecutive 404s or 500 pages
                    // Vienna uses folio notation: 001r, 001v, 002r, 002v, etc.
                    const paddedPage = String(Math.ceil(pageNum / 2)).padStart(3, '0');
                    const side = pageNum % 2 === 1 ? 'r' : 'v'; // odd = recto, even = verso
                    const imageUrl = `${imagePath}/${manuscriptId}_${paddedPage}${side}.jpg`;
                    
                    try {
                        // Quick HEAD request to check if image exists
                        const response = await this.deps.fetchDirect(imageUrl, { method: 'HEAD' });
                        
                        if (response.ok) {
                            pageLinks.push(imageUrl);
                            console.log(`Page ${pageNum} (${paddedPage}${side}): Found`);
                            consecutiveFailures = 0; // Reset failure counter
                        } else if (response.status === 404) {
                            console.log(`Page ${pageNum} (${paddedPage}${side}): Not found (404)`);
                            consecutiveFailures++;
                        } else {
                            console.log(`Page ${pageNum} (${paddedPage}${side}): HTTP ${response.status}`);
                            consecutiveFailures++;
                        }
                    } catch (error: any) {
                        console.log(`Page ${pageNum} (${paddedPage}${side}): Network error - ${error.message}`);
                        consecutiveFailures++;
                    }
                    
                    pageNum++;
                }
                
                if (pageLinks.length === 0) {
                    throw new Error('No pages found in Vienna Manuscripta manuscript');
                }
                
                // DO NOT pre-filter pageLinks here to avoid hanging issues
                // Page range filtering will be handled during download process
                console.log(`Vienna Manuscripta: Page discovery found ${pageLinks.length} total pages available`);
                if (startPage !== null) {
                    console.log(`Vienna Manuscripta: URL specifies starting from page ${startPage} - this will be handled during download`);
                }
                
                // Extract manuscript name from first page for display name
                const displayName = `Vienna_${manuscriptId}`;
                
                const manifest: ManuscriptManifest = {
                    pageLinks: pageLinks, // Return full page list, filtering handled in download
                    totalPages: pageLinks.length, // Total pages available
                    library: 'vienna_manuscripta' as const,
                    displayName,
                    originalUrl: manuscriptaUrl,
                    startPageFromUrl: startPage ?? undefined, // Store URL page number for later use
                };
                
                console.log(`Vienna Manuscripta manifest loaded: ${displayName}, total pages: ${pageLinks.length}`);
                return manifest;
                
            } catch (error: any) {
                console.error('Vienna Manuscripta manifest loading failed:', error);
                throw new Error(`Failed to load Vienna Manuscripta manuscript: ${(error as Error).message}`);
            }
        }
}