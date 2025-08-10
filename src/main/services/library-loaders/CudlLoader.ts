import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class CudlLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'cudl';
    }
    
    async loadManifest(cudlUrl: string): Promise<ManuscriptManifest> {
            try {
                const idMatch = cudlUrl.match(/\/view\/([^/]+)/);
                if (!idMatch) {
                    throw new Error('Invalid Cambridge CUDL URL format');
                }
                
                const manuscriptId = idMatch[1];
                const manifestUrl = `https://cudl.lib.cam.ac.uk/iiif/${manuscriptId}`;
                
                const manifestResponse = await this.deps.fetchDirect(manifestUrl);
                if (!manifestResponse.ok) {
                    throw new Error(`Failed to fetch CUDL manifest: HTTP ${manifestResponse.status}`);
                }
                
                const iiifManifest = await manifestResponse.json();
                
                if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                    throw new Error('Invalid IIIF manifest structure');
                }
                
                const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                    const resource = canvas.images[0].resource;
                    const rawUrl = resource['@id'] || resource.id;
                    // Convert bare IIIF identifier to proper IIIF image URL for Cambridge CUDL
                    if (rawUrl && rawUrl.includes('images.lib.cam.ac.uk/iiif/')) {
                        return rawUrl + '/full/1000,/0/default.jpg';
                    }
                    return rawUrl;
                }).filter((link: string) => link);
                
                if (pageLinks.length === 0) {
                    throw new Error('No pages found in manifest');
                }
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'cudl',
                    displayName: `Cambridge_${manuscriptId}`,
                    originalUrl: cudlUrl,
                };
                
            } catch (error: any) {
                throw new Error(`Failed to load Cambridge CUDL manuscript: ${(error as Error).message}`);
            }
        }
}