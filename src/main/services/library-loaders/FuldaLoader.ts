import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class FuldaLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'fulda';
    }
    
    async loadManifest(fuldaUrl: string): Promise<ManuscriptManifest> {
            try {
                // URL formats: 
                // - https://fuldig.hs-fulda.de/viewer/image/{PPN_ID}/[page]/
                // - https://fuldig.hs-fulda.de/viewer/api/v1/records/{PPN_ID}/manifest/
                const urlMatch = fuldaUrl.match(/(?:\/image\/|\/records\/)([^/]+)/);
                if (!urlMatch) {
                    throw new Error('Could not extract PPN ID from Fulda URL');
                }
    
                const ppnId = urlMatch[1];
                let displayName = `Fulda University Digital Collection - ${ppnId}`;
    
                // Construct IIIF manifest URL
                const manifestUrl = `https://fuldig.hs-fulda.de/viewer/api/v1/records/${ppnId}/manifest/`;
    
                console.log('Loading Fulda manifest from:', manifestUrl);
                const response = await fetch(manifestUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} when fetching Fulda manifest`);
                }
    
                const manifest = await response.json();
    
                // Extract title from manifest
                if (manifest.label) {
                    displayName = `Fulda University - ${manifest.label}`;
                }
    
                console.log(`Processing Fulda IIIF manifest: ${displayName}`);
    
                if (!manifest.sequences || !manifest.sequences[0] || !manifest.sequences[0].canvases) {
                    throw new Error('Invalid IIIF manifest structure');
                }
    
                const canvases = manifest.sequences[0].canvases;
                const pageLinks: string[] = [];
    
                // Process each canvas to extract maximum quality image URLs
                for (const canvas of canvases) {
                    if (canvas.images && canvas.images[0]) {
                        const image = canvas.images[0];
                        let imageUrl = '';
    
                        if (image.resource && image.resource.service) {
                            // IIIF Image API service
                            const serviceId = image.resource.service['@id'] || image.resource.service.id;
                            if (serviceId) {
                                // Use maximum quality parameters for Fulda IIIF v2.0
                                imageUrl = `${serviceId}/full/max/0/default.jpg`;
                            }
                        } else if (image.resource && image.resource['@id']) {
                            // Direct image URL
                            imageUrl = image.resource['@id'];
                        }
    
                        if (imageUrl) {
                            pageLinks.push(imageUrl);
                        }
                    }
                }
    
                if (pageLinks?.length === 0) {
                    throw new Error('No images found in Fulda manifest');
                }
    
                console.log(`Found ${pageLinks?.length} pages in Fulda manuscript`);
    
                const fuldaManifest = {
                    displayName,
                    pageLinks,
                    library: 'fulda' as const,
                    manifestUrl,
                    originalUrl: fuldaUrl,
                    totalPages: pageLinks.length
                };
    
                this.deps.manifestCache.set(fuldaUrl, fuldaManifest).catch(console.warn);
    
                return fuldaManifest;
    
            } catch (error) {
                throw new Error(`Failed to load Fulda manuscript: ${(error as Error).message}`);
            }
        }
}