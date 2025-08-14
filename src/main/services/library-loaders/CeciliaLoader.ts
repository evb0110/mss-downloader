import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class CeciliaLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'cecilia';
    }
    
    async loadManifest(url: string): Promise<ManuscriptManifest> {
            try {
                let manifestUrl: string;
                let documentId: string;
                
                if (url.includes('api/viewer/lgiiif')) {
                    // Direct manifest URL - extract document info and use as-is
                    manifestUrl = url.replace('&max=260', ''); // Remove max parameter for full quality
                    documentId = 'direct_manifest';
                } else {
                    // Extract document ID from viewer URL
                    // Example: https://cecilia.mediatheques.grand-albigeois.fr/viewer/124/?offset=#page=1&viewer=picture&o=&n=0&q=
                    const idMatch = url.match(/\/viewer\/(\d+)/);
                    if (!idMatch) {
                        throw new Error('Invalid Cecilia URL format - could not extract document ID');
                    }
                    
                    documentId = idMatch[1] || '';
                
                    // For known documents, use direct manifest URLs
                    if (documentId === '124') {
                        manifestUrl = 'https://cecilia.mediatheques.grand-albigeois.fr/api/viewer/lgiiif?url=/srv/www/limbgallery/medias/99/72/0c/a5/99720ca5-de2c-43fc-a8b0-f7b27fedc24a/';
                    } else if (documentId === '105') {
                        manifestUrl = 'https://cecilia.mediatheques.grand-albigeois.fr/api/viewer/lgiiif?url=/srv/www/limbgallery/medias/18/d6/50/b5/18d650b5-14e5-4b48-88b1-6fa9b8982c7d/';
                    } else {
                        // For unknown documents, try to extract manifest URL from viewer page HTML
                        const cleanViewerUrl = `https://cecilia.mediatheques.grand-albigeois.fr/viewer/${documentId}/`;
                        const viewerResp = await this.deps.fetchDirect(cleanViewerUrl);
                        if (!viewerResp.ok) {
                            throw new Error(`Failed to load Cecilia viewer page: HTTP ${viewerResp.status}`);
                        }
                        const viewerPageHtml = await viewerResp.text();
                        
                        // Try lgiiif URL pattern: lgiiif?url=([^&'"]+)
                        const lgiiifMatch = viewerPageHtml.match(/lgiiif\?url=([^&'"]+)/);
                        if (lgiiifMatch) {
                            const encodedPath = lgiiifMatch[1];
                            manifestUrl = `https://cecilia.mediatheques.grand-albigeois.fr/api/viewer/lgiiif?url=${encodedPath}`;
                        } else {
                            throw new Error(`Could not extract manifest URL from Cecilia viewer page for document ${documentId}`);
                        }
                    }
                }
                
                
                // Load the IIIF-style manifest from Cecilia
                const response = await this.deps.fetchDirect(manifestUrl);
                if (!response.ok) {
                    throw new Error(`Failed to load Cecilia manifest: HTTP ${response.status}`);
                }
                
                const responseText = await response.text();
                let manifestData;
                try {
                    manifestData = JSON.parse(responseText);
                } catch {
                    throw new Error(`Invalid JSON response from Cecilia manifest URL: ${manifestUrl}. Response starts with: ${responseText.substring(0, 100)}`);
                }
                
                // Parse Cecilia's IIIF-style manifest format
                const pageLinks: string[] = [];
                
                if (manifestData.item && manifestData.item.tiles) {
                    // Cecilia uses a tiles structure
                    const tiles = manifestData.item.tiles;
                    const imageIds = Object.keys(tiles);
                    
                    for (const id of imageIds) {
                        const tile = tiles[id];
                        if (tile['@id']) {
                            const imageUrl = `https://cecilia.mediatheques.grand-albigeois.fr${tile['@id']}/full/max/0/default.jpg`;
                            pageLinks.push(imageUrl);
                        }
                    }
                } else {
                    throw new Error('Invalid Cecilia manifest structure: missing item.tiles object');
                }
                
                if (pageLinks?.length === 0) {
                    throw new Error('No images found in Cecilia manifest');
                }
                
                return {
                    pageLinks,
                    totalPages: pageLinks?.length,
                    displayName: `Cecilia_${documentId}`,
                    library: 'cecilia',
                    originalUrl: url
                };
                
            } catch (error: any) {
                throw new Error(`Failed to load Cecilia manifest: ${(error as Error).message}`);
            }
        }
}