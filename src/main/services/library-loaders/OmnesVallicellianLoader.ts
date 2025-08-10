import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class OmnesVallicellianLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'omnesvallicelliana';
    }
    
    async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
            try {
                let manifestUrl: string;
                let displayName: string;
                
                // Handle both direct manifest URLs and viewer URLs
                if (originalUrl.includes('/manifest')) {
                    manifestUrl = originalUrl;
                    // Extract ID from manifest URL
                    const idMatch = originalUrl.match(/iiif\/([^/]+)\/manifest/);
                    displayName = idMatch ? `Vallicelliana ${idMatch[1]}` : 'Vallicelliana Manuscript';
                } else {
                    // Extract ID from regular URL and construct manifest URL
                    const idMatch = originalUrl.match(/omnes\.dbseret\.com\/vallicelliana\/iiif\/([^/?]+)/);
                    if (!idMatch) {
                        throw new Error('Cannot extract manuscript ID from Omnes Vallicelliana URL');
                    }
                    const manuscriptId = idMatch[1];
                    manifestUrl = `https://omnes.dbseret.com/vallicelliana/iiif/${manuscriptId}/manifest`;
                    displayName = `Vallicelliana ${manuscriptId}`;
                }
                
                console.log(`Loading Omnes Vallicelliana manifest from: ${manifestUrl}`);
                
                // Fetch and parse IIIF manifest
                const response = await this.deps.fetchDirect(manifestUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch manifest: HTTP ${response.status}`);
                }
                
                const manifestData = await response.json();
                
                // Extract display name from manifest label
                if (manifestData.label) {
                    displayName = manifestData.label;
                }
                
                // Get canvases from IIIF v2 structure
                const canvases = manifestData.sequences?.[0]?.canvases || [];
                if (canvases.length === 0) {
                    throw new Error('No canvases found in manifest');
                }
                
                // Extract page URLs using full/full/0/default.jpg for maximum resolution
                const pageLinks = canvases.map((canvas: any) => {
                    if (canvas.images && canvas.images[0]) {
                        const imageService = canvas.images[0].resource.service;
                        if (imageService && imageService['@id']) {
                            // Extract canvas ID and construct full resolution URL
                            const serviceId = imageService['@id'];
                            const canvasId = serviceId.split('/').pop();
                            return `https://omnes.dbseret.com/vallicelliana/iiif/2/${canvasId}/full/full/0/default.jpg`;
                        }
                    }
                    return null;
                }).filter((url: string) => url !== null);
                
                if (pageLinks.length === 0) {
                    throw new Error('No valid image URLs found in manifest');
                }
                
                console.log(`Found ${pageLinks.length} pages in Omnes Vallicelliana manuscript: ${displayName}`);
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'omnes_vallicelliana' as any,
                    displayName: displayName,
                    originalUrl: originalUrl,
                };
                
            } catch (error: any) {
                throw new Error(`Failed to load Omnes Vallicelliana manuscript: ${(error as Error).message}`);
            }
        }
}