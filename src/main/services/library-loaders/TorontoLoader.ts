import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class TorontoLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'toronto';
    }
    
    async loadManifest(torontoUrl: string): Promise<ManuscriptManifest> {
            try {
                let manifestUrl = torontoUrl;
                let displayName = 'University of Toronto Manuscript';
                
                // Handle collections.library.utoronto.ca URLs
                if (torontoUrl.includes('collections.library.utoronto.ca')) {
                    // Extract item ID from URL: https://collections.library.utoronto.ca/view/fisher2:F6521
                    const viewMatch = torontoUrl.match(/\/view\/([^/]+)/);
                    if (viewMatch) {
                        const itemId = viewMatch[1];
                        displayName = `University of Toronto - ${itemId}`;
                        
                        // Try different manifest URL patterns
                        const manifestPatterns = [
                            `https://iiif.library.utoronto.ca/presentation/v2/${itemId}/manifest`,
                            `https://iiif.library.utoronto.ca/presentation/v2/${itemId.replace(':', '%3A')}/manifest`,
                            `https://iiif.library.utoronto.ca/presentation/v3/${itemId}/manifest`,
                            `https://iiif.library.utoronto.ca/presentation/v3/${itemId.replace(':', '%3A')}/manifest`,
                            `https://collections.library.utoronto.ca/iiif/${itemId}/manifest`,
                            `https://collections.library.utoronto.ca/iiif/${itemId.replace(':', '%3A')}/manifest`,
                            `https://collections.library.utoronto.ca/api/iiif/${itemId}/manifest`,
                            `https://collections.library.utoronto.ca/api/iiif/${itemId.replace(':', '%3A')}/manifest`
                        ];
                        
                        let manifestFound = false;
                        for (const testUrl of manifestPatterns) {
                            try {
                                const response = await this.deps.fetchDirect(testUrl);
                                if (response.ok) {
                                    const content = await response.text();
                                    if (content.includes('"@context"') && (content.includes('manifest') || content.includes('Manifest'))) {
                                        manifestUrl = testUrl;
                                        manifestFound = true;
                                        break;
                                    }
                                }
                            } catch {
                                // Continue trying other patterns
                            }
                        }
                        
                        if (!manifestFound) {
                            throw new Error(`No working manifest URL found for item ${itemId}`);
                        }
                    } else {
                        throw new Error('Could not extract item ID from collections URL');
                    }
                }
                
                // Handle direct IIIF URLs
                else if (torontoUrl.includes('iiif.library.utoronto.ca')) {
                    if (!torontoUrl.includes('/manifest')) {
                        manifestUrl = torontoUrl.endsWith('/') ? `${torontoUrl}manifest` : `${torontoUrl}/manifest`;
                    }
                }
                
                // Load IIIF manifest
                const response = await this.deps.fetchDirect(manifestUrl);
                if (!response.ok) {
                    throw new Error(`Failed to load manifest: HTTP ${response.status}`);
                }
                
                const manifest = await response.json();
                
                // Extract metadata from IIIF manifest
                if (manifest.label) {
                    if (typeof manifest.label === 'string') {
                        displayName = manifest.label;
                    } else if (Array.isArray(manifest.label)) {
                        displayName = manifest.label[0]?.['@value'] || manifest.label[0] || displayName;
                    } else if (manifest.label['@value']) {
                        displayName = manifest.label['@value'];
                    }
                }
                
                const pageLinks: string[] = [];
                
                // Handle IIIF v2 structure
                if (manifest.sequences && manifest.sequences.length > 0) {
                    const sequence = manifest.sequences[0];
                    if (sequence.canvases && Array.isArray(sequence.canvases)) {
                        // Extract image URLs with maximum resolution
                        for (const canvas of sequence.canvases) {
                            if (canvas.images && canvas.images.length > 0) {
                                const image = canvas.images[0];
                                if (image.resource && image.resource['@id']) {
                                    let maxResUrl = image.resource['@id'];
                                    
                                    if (image.resource.service && image.resource.service['@id']) {
                                        const serviceId = image.resource.service['@id'];
                                        // Test different resolution parameters for maximum quality
                                        maxResUrl = `${serviceId}/full/max/0/default.jpg`;
                                    } else {
                                        // Fallback: construct from resource URL if service not available
                                        const serviceBase = maxResUrl.split('/full/')[0];
                                        maxResUrl = `${serviceBase}/full/max/0/default.jpg`;
                                    }
                                    
                                    pageLinks.push(maxResUrl);
                                }
                            }
                        }
                    }
                }
                
                // Handle IIIF v3 structure
                else if (manifest.items && manifest.items.length > 0) {
                    for (const item of manifest.items) {
                        if (item.items && item.items.length > 0) {
                            const annotationPage = item.items[0];
                            if (annotationPage.items && annotationPage.items.length > 0) {
                                const annotation = annotationPage.items[0];
                                if (annotation.body) {
                                    let maxResUrl = annotation.body.id;
                                    
                                    if (annotation.body.service) {
                                        const service = Array.isArray(annotation.body.service) ? annotation.body.service[0] : annotation.body.service;
                                        if (service && service.id) {
                                            maxResUrl = `${service.id}/full/max/0/default.jpg`;
                                        }
                                    }
                                    
                                    pageLinks.push(maxResUrl);
                                }
                            }
                        }
                    }
                }
                
                if (pageLinks.length === 0) {
                    throw new Error('No pages found in IIIF manifest');
                }
                
                const torontoManifest = {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'toronto' as const,
                    displayName,
                    originalUrl: torontoUrl,
                };
                
                // Cache the manifest
                this.deps.manifestCache.set(torontoUrl, torontoManifest).catch(console.warn);
                
                return torontoManifest;
                
            } catch (error: unknown) {
                throw new Error(`Failed to load University of Toronto manuscript: ${(error as Error).message}`);
            }
        }
}