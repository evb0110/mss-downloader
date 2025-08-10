import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class VaticanLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'vatican';
    }
    
    async loadManifest(vatLibUrl: string): Promise<ManuscriptManifest> {
            try {
                // Extract manuscript name from URL
                const nameMatch = vatLibUrl.match(/\/view\/([^/?]+)/);
                if (!nameMatch) {
                    throw new Error('Invalid Vatican Library URL format');
                }
                
                const manuscriptName = nameMatch[1];
                
                // Extract cleaner manuscript name according to patterns:
                // MSS_Vat.lat.7172 -> Vat.lat.7172
                // bav_pal_lat_243 -> Pal.lat.243
                // MSS_Reg.lat.15 -> Reg.lat.15
                let displayName = manuscriptName;
                if (manuscriptName.startsWith('MSS_')) {
                    displayName = manuscriptName.substring(4);
                } else if (manuscriptName.startsWith('bav_')) {
                    displayName = manuscriptName.substring(4).replace(/^([a-z])/, (match) => match.toUpperCase());
                }
                
                const manifestUrl = `https://digi.vatlib.it/iiif/${manuscriptName}/manifest.json`;
                
                const response = await this.deps.fetchDirect(manifestUrl);
                
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error(`Manuscript not found: ${manuscriptName}. Please check the URL is correct.`);
                    }
                    throw new Error(`HTTP ${response.status}: Failed to load manifest`);
                }
                
                const iiifManifest = await response.json();
                
                // Check if manifest has the expected structure
                if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                    throw new Error('Invalid manifest structure: missing sequences or canvases');
                }
                
                const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                    const resource = canvas.images[0].resource;
                    
                    // Vatican Library uses a service object with @id pointing to the image service
                    if (resource.service && resource.service['@id']) {
                        // Extract the base service URL and construct full resolution image URL
                        const serviceId = resource.service['@id'];
                        return `${serviceId}/full/full/0/native.jpg`;
                    }
                    
                    // Fallback to direct resource @id if no service (other IIIF implementations)
                    if (resource['@id']) {
                        return resource['@id'];
                    }
                    
                    return null;
                }).filter((link: string) => link);
                
                if (pageLinks.length === 0) {
                    throw new Error('No pages found in manifest');
                }
                
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'vatlib',
                    displayName: displayName,
                    originalUrl: vatLibUrl,
                };
                
            } catch (error: any) {
                throw new Error(`Failed to load Vatican Library manuscript: ${(error as Error).message}`);
            }
        }
}