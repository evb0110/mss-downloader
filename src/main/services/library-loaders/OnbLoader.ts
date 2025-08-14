import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class OnbLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'onb';
    }
    
    async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
            try {
                // Extract manuscript ID from URL pattern: https://viewer.onb.ac.at/1000B160
                const manuscriptMatch = originalUrl.match(/viewer\.onb\.ac\.at\/([^/?&]+)/);
                if (!manuscriptMatch) {
                    throw new Error('Invalid ONB URL format. Expected format: https://viewer.onb.ac.at/MANUSCRIPT_ID');
                }
                
                const manuscriptId = manuscriptMatch[1];
                console.log(`Extracting ONB manuscript ID: ${manuscriptId}`);
                
                // Construct the IIIF v3 manifest URL based on the API pattern
                const manifestUrl = `https://api.onb.ac.at/iiif/presentation/v3/manifest/${manuscriptId}`;
                console.log(`Fetching ONB IIIF v3 manifest: ${manifestUrl}`);
                
                const response = await this.deps.fetchDirect(manifestUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch ONB manifest: ${response.status} ${response.statusText}`);
                }
                
                let manifestData;
                try {
                    manifestData = await response.json();
                } catch (parseError) {
                    throw new Error(`Failed to parse ONB manifest JSON: ${(parseError as Error).message}`);
                }
                
                // Extract pages from IIIF v3 manifest
                const pageLinks: string[] = [];
                
                if (!manifestData.items || !Array.isArray(manifestData.items)) {
                    throw new Error('Invalid ONB manifest: no items array found');
                }
                
                console.log(`Processing ONB manifest with ${manifestData.items?.length} canvases`);
                
                for (const canvas of manifestData.items) {
                    if (!canvas.items || !Array.isArray(canvas.items)) {
                        console.warn(`Skipping canvas without items: ${canvas.id}`);
                        continue;
                    }
                    
                    for (const annotationPage of canvas.items) {
                        if (!annotationPage.items || !Array.isArray(annotationPage.items)) {
                            continue;
                        }
                        
                        for (const annotation of annotationPage.items) {
                            if (annotation.body && annotation.body.service && Array.isArray(annotation.body.service)) {
                                // Find IIIF Image API service
                                const imageService = annotation.body.service.find((service: Record<string, unknown>) => 
                                    service['type'] === 'ImageService3' || service['@type'] === 'ImageService'
                                );
                                
                                if (imageService && imageService.id) {
                                    // Use maximum resolution: /full/max/0/default.jpg
                                    const imageUrl = `${imageService.id}/full/max/0/default.jpg`;
                                    pageLinks.push(imageUrl);
                                    break; // Take the first valid image from this canvas
                                }
                            }
                        }
                    }
                }
                
                if (pageLinks?.length === 0) {
                    throw new Error('No valid images found in ONB manifest');
                }
                
                // Extract title from manifest metadata
                let displayName = `ONB Manuscript ${manuscriptId}`;
                if (manifestData.label) {
                    if (typeof manifestData.label === 'string') {
                        displayName = manifestData.label;
                    } else if (manifestData.label.en && Array.isArray(manifestData.label.en)) {
                        displayName = manifestData.label.en[0];
                    } else if (manifestData.label.de && Array.isArray(manifestData.label.de)) {
                        displayName = manifestData.label.de[0];
                    }
                }
                
                console.log(`ONB manifest loaded successfully: ${pageLinks?.length} pages found - "${displayName}"`);
                
                return {
                    pageLinks,
                    totalPages: pageLinks?.length,
                    library: 'onb' as const,
                    displayName,
                    originalUrl: originalUrl,
                };
                
            } catch (error: any) {
                throw new Error(`Failed to load ONB manuscript: ${(error as Error).message}`);
            }
        }
}