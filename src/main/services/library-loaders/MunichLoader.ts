import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class MunichLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'munich';
    }
    
    async loadManifest(munichUrl: string): Promise<ManuscriptManifest> {
            try {
                // Extract manuscript ID from URL
                // URL format: https://www.digitale-sammlungen.de/en/view/{MANUSCRIPT_ID}?page=1
                const urlMatch = munichUrl.match(/view\/([a-z0-9]+)/i);
                if (!urlMatch) {
                    throw new Error('Could not extract manuscript ID from Munich URL');
                }
                
                const manuscriptId = urlMatch[1];
                let displayName = `Munich Digital Collections - ${manuscriptId}`;
                
                // Construct IIIF manifest URL
                const manifestUrl = `https://api.digitale-sammlungen.de/iiif/presentation/v2/${manuscriptId}/manifest`;
                
                // Load IIIF manifest
                const response = await this.deps.fetchDirect(manifestUrl);
                if (!response.ok) {
                    throw new Error(`Failed to load manifest: HTTP ${response.status}`);
                }
                
                const manifest = await response.json();
                
                // Extract metadata from IIIF v2.0 manifest
                if (manifest.label) {
                    if (typeof manifest.label === 'string') {
                        displayName = manifest.label;
                    } else if (Array.isArray(manifest.label)) {
                        displayName = manifest.label[0]?.['@value'] || manifest.label[0] || displayName;
                    } else if (manifest.label['@value']) {
                        displayName = manifest.label['@value'];
                    }
                }
                
                // Get page count from sequences/canvases (IIIF v2.0)
                let totalPages = 0;
                const pageLinks: string[] = [];
                
                if (manifest.sequences && manifest.sequences.length > 0) {
                    const sequence = manifest.sequences[0];
                    if (sequence.canvases && Array.isArray(sequence.canvases)) {
                        totalPages = sequence.canvases.length;
                        
                        // Extract image URLs with maximum resolution
                        for (const canvas of sequence.canvases) {
                            if (canvas.images && canvas.images.length > 0) {
                                const image = canvas.images[0];
                                if (image.resource) {
                                    const service = image.resource.service;
                                    const imageId = service?.['@id'] || service?.id || image.resource['@id'];
                                    
                                    if (imageId) {
                                        // Munich IIIF service supports /full/max/ for highest quality
                                        const imageUrl = imageId.includes('/iiif/image/') ? 
                                            `${imageId}/full/max/0/default.jpg` : 
                                            imageId;
                                        pageLinks.push(imageUrl);
                                    }
                                }
                            }
                        }
                    }
                }
                
                if (pageLinks.length === 0) {
                    throw new Error('No images found in Munich manifest');
                }
                
                const munichManifest: ManuscriptManifest = {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'munich' as const,
                    displayName,
                    originalUrl: munichUrl,
                };
                
                // Cache the manifest
                this.deps.manifestCache.set(munichUrl, munichManifest).catch(console.warn);
                
                return munichManifest;
                
            } catch (error: any) {
                throw new Error(`Failed to load Munich manuscript: ${(error as Error).message}`);
            }
        }
}