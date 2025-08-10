import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class SaintOmerLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'saintomer';
    }
    
    async loadManifest(saintOmerUrl: string): Promise<ManuscriptManifest> {
            try {
                // Extract manuscript ID from URL
                // URL format: https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/viewer/{MANUSCRIPT_ID}/?offset=...
                const urlMatch = saintOmerUrl.match(/\/viewer\/(\d+)/);
                if (!urlMatch) {
                    throw new Error('Could not extract manuscript ID from Saint-Omer URL');
                }
                
                const manuscriptId = urlMatch[1];
                let displayName = `Saint-Omer Municipal Library - ${manuscriptId}`;
                
                // Construct IIIF manifest URL
                const manifestUrl = `https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/iiif/${manuscriptId}/manifest`;
                
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
                                if (image.resource && image.resource['@id']) {
                                    // Get the IIIF service URL and construct maximum resolution URL
                                    let maxResUrl = image.resource['@id'];
                                    
                                    if (image.resource.service && image.resource.service['@id']) {
                                        const serviceId = image.resource.service['@id'];
                                        // Use Saint-Omer pattern: /full/max/0/default.jpg for maximum quality
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
                
                if (totalPages === 0 || pageLinks.length === 0) {
                    throw new Error('No pages found in IIIF manifest');
                }
                
                const saintOmerManifest = {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'saint_omer' as const,
                    displayName,
                    originalUrl: saintOmerUrl,
                };
                
                // Cache the manifest
                this.deps.manifestCache.set(saintOmerUrl, saintOmerManifest).catch(console.warn);
                
                return saintOmerManifest;
                
            } catch (error: any) {
                throw new Error(`Failed to load Saint-Omer manuscript: ${(error as Error).message}`);
            }
        }
}