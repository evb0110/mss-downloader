import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class ParkerLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'parker';
    }
    
    async loadManifest(parkerUrl: string): Promise<ManuscriptManifest> {
            try {
                // Extract the manuscript ID from the URL
                // Pattern: https://parker.stanford.edu/parker/catalog/zs345bj2650
                const idMatch = parkerUrl.match(/\/catalog\/([^/]+)(?:\/|$)/);
                if (!idMatch) {
                    throw new Error('Invalid Stanford Parker URL format - could not extract manuscript ID');
                }
                
                const manuscriptId = idMatch[1];
                // Stanford Parker IIIF manifest URL pattern
                const manifestUrl = `https://dms-data.stanford.edu/data/manifests/Parker/${manuscriptId}/manifest.json`;
                
                // Fetch the IIIF manifest
                const manifestResponse = await this.deps.fetchDirect(manifestUrl);
                if (!manifestResponse.ok) {
                    throw new Error(`Failed to fetch Stanford Parker manifest: HTTP ${manifestResponse.status}`);
                }
                
                const iiifManifest = await manifestResponse.json();
                
                // Handle both IIIF v2 and v3 formats
                let canvases;
                if (iiifManifest.sequences && iiifManifest.sequences[0]) {
                    // IIIF v2 format
                    canvases = iiifManifest.sequences[0].canvases;
                } else if (iiifManifest.items) {
                    // IIIF v3 format
                    canvases = iiifManifest.items;
                } else {
                    throw new Error('Invalid IIIF manifest structure - no sequences or items found');
                }
                
                if (!canvases || canvases.length === 0) {
                    throw new Error('No pages found in manifest');
                }
                
                const pageLinks = canvases.map((canvas: any) => {
                    let imageUrl;
                    
                    if (canvas.images && canvas.images[0]) {
                        // IIIF v2 format - Stanford Parker provides direct image URLs
                        const resource = canvas.images[0].resource;
                        // Use the direct image URL provided by Stanford Parker
                        imageUrl = resource['@id'] || resource.id;
                    } else if (canvas.items && canvas.items[0] && canvas.items[0].items && canvas.items[0].items[0]) {
                        // IIIF v3 format
                        const annotation = canvas.items[0].items[0];
                        const body = annotation.body;
                        imageUrl = body.id;
                    }
                    
                    return imageUrl;
                }).filter((link: string) => link);
                
                if (pageLinks.length === 0) {
                    throw new Error('No images found in Stanford Parker manifest');
                }
                
                // Extract title and metadata
                const label = iiifManifest.label || iiifManifest.title || 'Stanford Parker Manuscript';
                let displayName;
                
                if (typeof label === 'string') {
                    displayName = label;
                } else if (label?.['@value']) {
                    displayName = label['@value'];
                } else if (label?.value) {
                    displayName = label.value;
                } else if (label?.en && Array.isArray(label.en)) {
                    displayName = label.en[0];
                } else if (label?.en) {
                    displayName = label.en;
                } else {
                    displayName = `Stanford_Parker_${manuscriptId}`;
                }
                
                // Sanitize display name for filesystem
                const sanitizedName = displayName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.+$/, '').substring(0, 150);
                
                return {
                    displayName: sanitizedName,
                    totalPages: pageLinks.length,
                    pageLinks,
                    library: 'parker' as any,
                    originalUrl: parkerUrl
                };
                
            } catch (error: any) {
                console.error(`Stanford Parker manifest loading failed:`, error);
                throw new Error(`Failed to load Stanford Parker manuscript: ${(error as Error).message}`);
            }
        }
}