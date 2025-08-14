import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class ManchesterLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'manchester';
    }
    
    async loadManifest(manchesterUrl: string): Promise<ManuscriptManifest> {
            try {
                // Extract manuscript ID from URL
                // URL format: https://www.digitalcollections.manchester.ac.uk/view/{MANUSCRIPT_ID}/{PAGE_NUMBER}
                const urlMatch = manchesterUrl.match(/\/view\/([^/]+)/);
                if (!urlMatch) {
                    throw new Error('Could not extract manuscript ID from Manchester URL');
                }
                
                const manuscriptId = urlMatch[1];
                let displayName = `Manchester Digital Collections - ${manuscriptId}`;
                
                // Construct IIIF manifest URL
                const manifestUrl = `https://www.digitalcollections.manchester.ac.uk/iiif/${manuscriptId}`;
                
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
                
                if (manifest.sequences && manifest.sequences?.length > 0) {
                    const sequence = manifest.sequences[0];
                    if (sequence.canvases && Array.isArray(sequence.canvases)) {
                        totalPages = sequence.canvases?.length;
                        
                        // Extract image URLs with maximum resolution
                        for (const canvas of sequence.canvases) {
                            if (canvas.images && canvas.images?.length > 0) {
                                const image = canvas.images[0];
                                if (image.resource && image.resource.service && image.resource.service['@id']) {
                                    // FIXED: Use optimal resolution pattern discovered through testing
                                    // Manchester IIIF service supports maximum 2000x2000 pixels
                                    // Pattern /full/1994,2800/0/default.jpg provides highest quality
                                    const serviceId = image.resource.service['@id'];
                                    const maxResUrl = `${serviceId}/full/1994,2800/0/default.jpg`;
                                    
                                    pageLinks.push(maxResUrl);
                                }
                            }
                        }
                    }
                }
                
                if (totalPages === 0 || pageLinks?.length === 0) {
                    throw new Error('No pages found in IIIF manifest');
                }
                
                const manchesterManifest = {
                    pageLinks,
                    totalPages: pageLinks?.length,
                    library: 'manchester' as const,
                    displayName,
                    originalUrl: manchesterUrl,
                };
                
                // Cache the manifest
                this.deps.manifestCache.set(manchesterUrl, manchesterManifest).catch(console.warn);
                
                return manchesterManifest;
                
            } catch (error: any) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`Failed to load Manchester manuscript: ${errorMessage}`);
            }
        }
}