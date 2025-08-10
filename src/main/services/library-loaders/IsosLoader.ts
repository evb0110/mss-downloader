import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class IsosLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'isos';
    }
    
    async loadManifest(isosUrl: string): Promise<ManuscriptManifest> {
            try {
                const idMatch = isosUrl.match(/\/([^/]+)\.html$/);
                if (!idMatch) {
                    throw new Error('Invalid ISOS URL format');
                }
                
                const manuscriptId = idMatch[1];
                const manifestUrl = `https://www.isos.dias.ie/static/manifests/${manuscriptId}.json`;
                
                const manifestResponse = await this.deps.fetchDirect(manifestUrl);
                if (!manifestResponse.ok) {
                    throw new Error(`Failed to fetch ISOS manifest: HTTP ${manifestResponse.status}`);
                }
                
                const iiifManifest = await manifestResponse.json();
                
                if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                    throw new Error('Invalid IIIF manifest structure');
                }
                
                const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                    const resource = canvas.images[0].resource;
                    
                    // For ISOS, prefer the service URL format which works better with headers
                    if (resource.service && (resource.service['@id'] || resource.service.id)) {
                        const serviceUrl = resource.service['@id'] || resource.service.id;
                        return serviceUrl + '/full/max/0/default.jpg';
                    }
                    
                    // Fallback to resource ID
                    return resource['@id'] || resource.id;
                }).filter((link: string) => link);
                
                if (pageLinks.length === 0) {
                    throw new Error('No pages found in manifest');
                }
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'isos',
                    displayName: `ISOS_${manuscriptId}`,
                    originalUrl: isosUrl,
                };
                
            } catch (error: any) {
                throw new Error(`Failed to load ISOS manuscript: ${(error as Error).message}`);
            }
        }
}