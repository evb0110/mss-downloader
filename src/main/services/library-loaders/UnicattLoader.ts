import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class UnicattLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'unicatt';
    }
    
    async loadManifest(unicattUrl: string): Promise<ManuscriptManifest> {
            try {
                // Extract the book ID from the URL
                // Pattern: https://digitallibrary.unicatt.it/veneranda/0b02da82800c3ea6
                const urlMatch = unicattUrl.match(/\/veneranda\/([^/?]+)/);
                if (!urlMatch) {
                    throw new Error('Invalid Unicatt URL format - could not extract book ID');
                }
                
                const bookIdFull = urlMatch[1];
                const displayType = 'public'; // Based on JavaScript in the page
                
                // Build the folder structure as done in the JavaScript:
                // for (let i = 0; i < 15; i += 2) { bookId = bookId + bookIdFull.substring(i, i+2) + "/" }
                let bookIdPath = '';
                for (let i = 0; i < Math.min(15, bookIdFull.length); i += 2) {
                    const segment = bookIdFull.substring(i, i + 2);
                    if (segment.length > 0) {
                        bookIdPath += segment + '/';
                    }
                }
                bookIdPath += bookIdFull;
                
                // Construct the manifest URL based on the pattern found in the HTML
                const manifestUrl = `https://digitallibrary.unicatt.it/veneranda/data/${displayType}/manifests/${bookIdPath}.json`;
                
                try {
                    // Try to load the IIIF manifest with proxy fallback
                    const response = await this.deps.fetchWithProxyFallback(manifestUrl);
                    
                    if (!response.ok) {
                        throw new Error(`Failed to load Unicatt manifest: HTTP ${response.status}`);
                    }
                    
                    const responseText = await response.text();
                    let manifest;
                    try {
                        manifest = JSON.parse(responseText);
                    } catch {
                        throw new Error(`Invalid JSON response from Unicatt manifest URL: ${manifestUrl}. Response starts with: ${responseText.substring(0, 100)}`);
                    }
                    
                    // Process the IIIF manifest
                    const pageLinks: string[] = [];
                    
                    // Handle IIIF v2/v3 format
                    let canvases: any[] = [];
                    
                    if (manifest.sequences && Array.isArray(manifest.sequences)) {
                        // IIIF v2: canvases are in sequences
                        for (const sequence of manifest.sequences) {
                            const sequenceCanvases = sequence.canvases || [];
                            canvases.push(...sequenceCanvases);
                        }
                    } else if (manifest.items && Array.isArray(manifest.items)) {
                        // IIIF v3: canvases are directly in manifest.items
                        canvases = manifest.items;
                    } else {
                        // Fallback: try to find canvases in the manifest itself
                        canvases = manifest.canvases || [];
                    }
                    
                    // Process each canvas to extract image URLs
                    for (const canvas of canvases) {
                        let foundImages = false;
                        
                        // Check IIIF v2 format (canvas.images)
                        if (canvas.images && Array.isArray(canvas.images)) {
                            for (const image of canvas.images) {
                                let imageUrl;
                                
                                if (image.resource) {
                                    imageUrl = image.resource['@id'] || image.resource.id;
                                } else if (image['@id']) {
                                    imageUrl = image['@id'];
                                }
                                
                                if (imageUrl) {
                                    // Convert to full resolution
                                    if (imageUrl.includes('/full/')) {
                                        imageUrl = imageUrl.replace(/\/full\/[^/]+\//, '/full/max/');
                                    }
                                    pageLinks.push(imageUrl);
                                    foundImages = true;
                                }
                            }
                        }
                        
                        // Check IIIF v3 format (canvas.items with AnnotationPages)
                        if (!foundImages && canvas.items && Array.isArray(canvas.items)) {
                            for (const item of canvas.items) {
                                if (item.type === 'AnnotationPage' && item.items && Array.isArray(item.items)) {
                                    for (const annotation of item.items) {
                                        if (annotation.body && annotation.body.id) {
                                            let imageUrl = annotation.body.id;
                                            
                                            // Convert to full resolution
                                            if (imageUrl.includes('/full/')) {
                                                imageUrl = imageUrl.replace(/\/full\/[^/]+\//, '/full/max/');
                                            }
                                            pageLinks.push(imageUrl);
                                            foundImages = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    if (pageLinks.length === 0) {
                        throw new Error('No page links found in Unicatt IIIF manifest');
                    }
                    
                    // Extract display name from manifest
                    let displayName = `Unicatt_${bookIdFull}`;
                    
                    if (manifest.label) {
                        if (typeof manifest.label === 'string') {
                            displayName = manifest.label;
                        } else if (manifest.label.en && Array.isArray(manifest.label.en)) {
                            displayName = manifest.label.en[0];
                        } else if (manifest.label.it && Array.isArray(manifest.label.it)) {
                            displayName = manifest.label.it[0];
                        } else if (manifest.label.none && Array.isArray(manifest.label.none)) {
                            displayName = manifest.label.none[0];
                        } else if (typeof manifest.label === 'object') {
                            // Try to extract any language variant
                            const languages = Object.keys(manifest.label);
                            if (languages.length > 0 && Array.isArray(manifest.label[languages[0]])) {
                                displayName = manifest.label[languages[0]][0];
                            }
                        }
                    }
                    
                    return {
                        pageLinks,
                        totalPages: pageLinks.length,
                        displayName: displayName,
                        library: 'unicatt',
                        originalUrl: unicattUrl
                    };
                    
                } catch (error: any) {
                    throw new Error(`Failed to load Unicatt manifest: ${(error as Error).message}`);
                }
                
            } catch (error: any) {
                throw new Error(`Failed to load Unicatt manuscript: ${(error as Error).message}`);
            }
        }
}