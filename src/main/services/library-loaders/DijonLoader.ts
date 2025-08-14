import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

interface DijonVersion {
    src: string;
    [key: string]: unknown;
}

interface DijonPage {
    versions: DijonVersion[];
    [key: string]: unknown;
}

export class DijonLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'dijon';
    }
    
    async loadManifest(url: string): Promise<ManuscriptManifest> {
            const msMatch = url.match(/img-viewer\/([^/?]+)/);
            if (!msMatch) {
                throw new Error('Invalid Dijon URL format - could not extract manuscript ID');
            }
            const manuscriptId = msMatch[1];
            const manifestUrl = `http://patrimoine.bm-dijon.fr/pleade/img-server/${manuscriptId}/dir.json`;
            const response = await this.deps.fetchDirect(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to load Dijon manifest: HTTP ${response.status}`);
            }
            const manifestData = await response.json();
            if (!Array.isArray(manifestData) || manifestData?.length === 0) {
                throw new Error('No images found in Dijon manifest');
            }
            const pageLinks = manifestData.map((page: DijonPage) => {
                if (!page.versions || !Array.isArray(page.versions)) {
                    throw new Error(`Invalid page versions for manuscript ${manuscriptId}`);
                }
                const version = page.versions.find((v: DijonVersion) => v.src && !v.src.includes('__thumbs__'));
                if (!version || !version.src) {
                    throw new Error(`No full-size version found for a page of manuscript ${manuscriptId}`);
                }
                return `http://patrimoine.bm-dijon.fr/pleade/img-server/${version.src}`;
            });
            return {
                pageLinks,
                totalPages: pageLinks?.length,
                displayName: `Dijon_${manuscriptId}`,
                library: 'dijon',
                originalUrl: url
            };
        }
}