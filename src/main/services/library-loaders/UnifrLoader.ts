import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class UnifrLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'unifr';
    }
    
    async loadManifest(url: string): Promise<ManuscriptManifest> {
            const pathMatch = url.match(/\/(?:en|de|fr|it)\/([^/]+)\/([^/]+)/) || url.match(/\/(?:thumbs|list\/one)\/([^/]+)\/([^/]+)/);
            const collection = pathMatch ? pathMatch[1] : '';
            const manuscript = pathMatch ? pathMatch[2] : '';
            if (!collection || !manuscript) {
                throw new Error('Invalid Unifr URL format - could not extract manifest ID');
            }
            const manifestId = `${collection}-${manuscript}`;
            const manifestUrl = `https://www.e-codices.unifr.ch/metadata/iiif/${manifestId}/manifest.json`;
            
            // Add proper headers for e-codices requests to avoid HTTP 400 errors
            const response = await this.deps.fetchDirect(manifestUrl, {
                headers: {
                    'Referer': url,
                    'Accept': 'application/json,application/ld+json,*/*'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load IIIF manifest: HTTP ${response.status}`);
            }
            
            const responseText = await response.text();
            let manifest;
            try {
                manifest = JSON.parse(responseText);
            } catch {
                throw new Error(`Invalid JSON response from manifest URL: ${manifestUrl}. Response starts with: ${responseText.substring(0, 100)}`);
            }
            
            const pageLinks: string[] = [];
            const sequences = manifest.sequences || [manifest];
            
            for (const sequence of sequences) {
                const canvases = sequence.canvases || sequence.items || [];
                
                for (const canvas of canvases) {
                    const images = canvas.images || canvas.items || [];
                    
                    for (const image of images) {
                        let imageUrl;
                        
                        if (image.resource) {
                            imageUrl = image.resource['@id'] || image.resource.id;
                        } else if (image.body) {
                            imageUrl = image.body.id;
                        }
                        
                        if (imageUrl) {
                            pageLinks.push(imageUrl);
                        }
                    }
                }
            }
            
            if (pageLinks?.length === 0) {
                throw new Error('No page links found in IIIF manifest');
            }
            
            return {
                pageLinks,
                totalPages: pageLinks?.length,
                displayName: `UNIFR_${collection}_${manuscript}`,
                library: 'unifr',
                originalUrl: url
            };
        }
}