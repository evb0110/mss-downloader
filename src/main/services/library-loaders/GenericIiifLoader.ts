import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class GenericIiifLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'generic_iiif';
    }
    
    async loadManifest(manifestUrl: string): Promise<ManuscriptManifest> {
            const response = await this.deps.fetchDirect(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to load IIIF manifest: HTTP ${response.status}`);
            }
            
            const responseText = await response.text();
            let manifest;
            try {
                manifest = JSON.parse(responseText);
            } catch {
                throw new Error(`Invalid JSON response from manifest URL: ${manifestUrl}. Response starts with: ${responseText.substring(0, 100)}`);
            }
            
            
            const pageLinks: string[] = [];
            
            // Handle IIIF v3 format (items directly in manifest) and IIIF v2 format (sequences)
            let canvases: Record<string, unknown>[] = [];
            
            if (manifest.items && Array.isArray(manifest.items)) {
                // IIIF v3: canvases are directly in manifest.items
                canvases = manifest.items;
            } else if (manifest.sequences && Array.isArray(manifest.sequences)) {
                // IIIF v2: canvases are in sequences
                for (const sequence of manifest.sequences) {
                    const sequenceCanvases = sequence.canvases || [];
                    canvases.push(...sequenceCanvases);
                }
            } else {
                // Fallback: try to find canvases in the manifest itself
                canvases = manifest.canvases || [];
            }
            
            // Process each canvas to extract image URLs
            for (const canvas of canvases) {
                let foundImages = false;
                
                // Check if this looks like IIIF v2 (has canvas.images)
                if (canvas['images'] && Array.isArray(canvas['images'])) {
                    for (const image of canvas['images']) {
                        let imageUrl;
                        
                        // IIIF v2 format
                        if (image.resource) {
                            imageUrl = image.resource['@id'] || image.resource.id;
                        } else if (image['@id']) {
                            imageUrl = image['@id'];
                        }
                        
                        if (imageUrl) {
                            // const originalUrl = imageUrl;
                            // Convert to full resolution for all IIIF libraries
                            if (imageUrl.includes('/full/')) {
                                imageUrl = imageUrl.replace(/\/full\/[^/]+\//, '/full/max/');
                            }
                            pageLinks.push(imageUrl);
                            foundImages = true;
                        }
                    }
                }
                
                // Check if this looks like IIIF v3 (has canvas.items with AnnotationPages)
                if (!foundImages && canvas['items'] && Array.isArray(canvas['items'])) {
                    for (const item of canvas['items']) {
                        if (item.type === 'AnnotationPage' && item.items && Array.isArray(item.items)) {
                            for (const annotation of item.items) {
                                if (annotation.body && annotation.body.id) {
                                    let imageUrl = annotation.body.id;
                                    // const originalUrl = imageUrl;
                                    
                                    // Convert to full resolution for all IIIF libraries
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
            
            // Extract display name from IIIF manifest
            let displayName = 'IIIF Document';
            
            if (manifest.label) {
                if (typeof manifest.label === 'string') {
                    displayName = manifest.label;
                } else if (manifest.label.en && Array.isArray(manifest.label.en)) {
                    displayName = manifest.label.en[0];
                } else if (manifest.label.none && Array.isArray(manifest.label.none)) {
                    displayName = manifest.label.none[0];
                } else if (typeof manifest.label === 'object') {
                    // Try to extract any language variant
                    const languages = Object.keys(manifest.label);
                    if (languages?.length > 0 && languages[0] && Array.isArray(manifest.label[languages[0]])) {
                        displayName = manifest.label[languages[0]]![0];
                    }
                }
            }
            
            // Fallback to metadata if no label found
            if (displayName === 'IIIF Document' && manifest.metadata) {
                const titleMetadata = manifest.metadata.find((m: Record<string, unknown>) => 
                    m['label'] === 'Title' || 
                    (typeof m['label'] === 'object' && ((m['label'] as any).en?.[0] === 'Title' || (m['label'] as any).none?.[0] === 'Title'))
                );
                if (titleMetadata?.value) {
                    if (typeof titleMetadata.value === 'string') {
                        displayName = titleMetadata.value;
                    } else if (Array.isArray(titleMetadata.value.en)) {
                        displayName = titleMetadata.value.en[0];
                    } else if (Array.isArray(titleMetadata.value.none)) {
                        displayName = titleMetadata.value.none[0];
                    }
                }
            }
            
            
            return {
                pageLinks,
                totalPages: pageLinks?.length,
                displayName: displayName || 'IIIF Document',
                library: 'gallica' as const,
                originalUrl: ''
            };
        }
}