import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class LaonLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'laon';
    }
    
    async loadManifest(laonUrl: string): Promise<ManuscriptManifest> {
            // Extract document ID from viewer URL
            const idMatch = laonUrl.match(/\/viewer\/(\d+)/);
            if (!idMatch) {
                throw new Error('Invalid Laon URL format - could not extract document ID');
            }
            const documentId = idMatch[1];
            let manifestUrl;
            if (documentId === '1459') {
                // Known media path for document 1459
                manifestUrl = 'https://bibliotheque-numerique.ville-laon.fr/api/viewer/lgiiif?url=/srv/www/limbgallery/medias/a2/33/4a/b2/a2334ab2-0305-48a5-98aa-d3cdbeb87a97/';
            } else {
                // Fallback: extract manifest URL from viewer page
                const cleanViewerUrl = `https://bibliotheque-numerique.ville-laon.fr/viewer/${documentId}/`;
                const viewerResp = await this.deps.fetchDirect(cleanViewerUrl);
                if (!viewerResp.ok) {
                    throw new Error(`Failed to load Laon viewer page: HTTP ${viewerResp.status}`);
                }
                const html = await viewerResp.text();
                // Try lgiiif URL pattern
                const lgiiifMatch = html.match(/lgiiif\?url=([^&'"]+)/);
                if (lgiiifMatch) {
                    manifestUrl = `https://bibliotheque-numerique.ville-laon.fr/api/viewer/lgiiif?url=${lgiiifMatch[1]}`;
                } else {
                    const mediaPathMatch = html.match(/["']\/medias\/([^"']+)["']/);
                    if (!mediaPathMatch) {
                        throw new Error(`Could not extract manifest URL from Laon viewer page for document ${documentId}`);
                    }
                    manifestUrl = `https://bibliotheque-numerique.ville-laon.fr/api/viewer/lgiiif?url=/srv/www/limbgallery/${mediaPathMatch[1]}/`;
                }
            }
            const resp = await this.deps.fetchDirect(manifestUrl);
            if (!resp.ok) {
                throw new Error(`Failed to load Laon manifest: HTTP ${resp.status}`);
            }
            const data = await resp.json();
            if (!data.item || !data.item.tiles || typeof data.item.tiles !== 'object') {
                throw new Error('Invalid Laon manifest structure: missing item.tiles object');
            }
            const tiles = data.item.tiles;
            const imageIds = Object.keys(tiles);
            if (imageIds.length === 0) {
                throw new Error('No images found in Laon manifest');
            }
            const pageLinks = imageIds.map((id) => {
                const tile = tiles[id];
                if (!tile['@id']) throw new Error(`Missing @id for image: ${id}`);
                return `https://bibliotheque-numerique.ville-laon.fr${tile['@id']}/full/full/0/default.jpg`;
            });
            return {
                pageLinks,
                totalPages: pageLinks.length,
                displayName: `Laon_${documentId}`,
                library: 'laon',
                originalUrl: laonUrl
            };
        }
}