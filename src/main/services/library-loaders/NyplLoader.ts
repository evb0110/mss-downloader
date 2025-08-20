import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class NyplLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'nypl';
    }
    
    async loadManifest(nyplUrl: string): Promise<ManuscriptManifest> {
            try {
                // Extract UUID from URL like https://digitalcollections.nypl.org/items/6a709e10-1cda-013b-b83f-0242ac110002
                const uuidMatch = nyplUrl.match(/\/items\/([a-f0-9-]+)/);
                if (!uuidMatch) {
                    throw new Error('Invalid NYPL URL format');
                }
                
                const uuid = uuidMatch[1];
                console.log(`NYPL: Processing UUID ${uuid}`);
                
                // Modern NYPL uses IIIF Presentation API v3.0 manifests
                const manifestUrl = `https://api-collections.nypl.org/manifests/${uuid}`;
                console.log(`NYPL: Fetching IIIF manifest from ${manifestUrl}`);
                
                const manifestResponse = await this.deps.fetchDirect(manifestUrl);
                if (!manifestResponse.ok) {
                    throw new Error(`Failed to fetch IIIF manifest: ${manifestResponse.status} ${manifestResponse.statusText}`);
                }
                
                const iiifManifest = await manifestResponse.json();
                
                // Extract image URLs from IIIF manifest structure
                if (!iiifManifest.items || !Array.isArray(iiifManifest.items)) {
                    throw new Error('Invalid IIIF manifest structure - no items found');
                }
                
                console.log(`NYPL: Processing ${iiifManifest.items.length} canvases from IIIF manifest`);
                
                const pageLinks = iiifManifest.items.map((canvas: any, index: number) => {
                    const serviceId = canvas.items?.[0]?.items?.[0]?.body?.service?.[0]?.id;
                    if (!serviceId) {
                        throw new Error(`Missing image service ID in canvas ${index + 1}`);
                    }
                    
                    // Extract image ID from service URL (format: https://iiif.nypl.org/iiif/3/{IMAGE_ID})
                    const imageId = serviceId.split('/').pop();
                    if (!imageId) {
                        throw new Error(`Could not extract image ID from service URL: ${serviceId}`);
                    }
                    
                    // Use IIIF Image API v3 for maximum resolution
                    return `https://iiif.nypl.org/iiif/3/${imageId}/full/max/0/default.jpg`;
                });
                
                // Extract display name from IIIF manifest
                let displayName = `NYPL Document ${uuid}`;
                if (iiifManifest.label?.en?.[0]) {
                    displayName = iiifManifest.label.en[0];
                } else if (iiifManifest.label && typeof iiifManifest.label === 'string') {
                    displayName = iiifManifest.label;
                }
                
                if (pageLinks?.length === 0) {
                    throw new Error('No pages found in NYPL manifest');
                }
                
                const nyplManifest = {
                    pageLinks,
                    totalPages: pageLinks?.length,
                    library: 'nypl' as const,
                    displayName,
                    originalUrl: nyplUrl,
                };
                
                console.log(`NYPL: Created manifest for "${displayName}" with ${pageLinks?.length} pages`);
                
                return nyplManifest;
                
            } catch (error: any) {
                console.error(`Failed to load NYPL manifest: ${(error as Error).message}`);
                throw error;
            }
        }
}