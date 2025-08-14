import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class UgentLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'ugent';
    }
        async loadManifest(url: string): Promise<ManuscriptManifest> {
            try {
                // Extract manuscript ID from URL pattern: https://lib.ugent.be/viewer/archive.ugent.be%3A644DCADE-4FE7-11E9-9AC5-81E62282636C
                const manuscriptMatch = url.match(/\/viewer\/([^/?&]+)/);
                if (!manuscriptMatch) {
                    throw new Error('Invalid UGent URL format. Expected format: https://lib.ugent.be/viewer/MANUSCRIPT_ID');
                }
                
                const manuscriptId = decodeURIComponent(manuscriptMatch[1] || '');
                
                // Construct the IIIF v3 manifest URL based on the pattern from the reference implementation
                const manifestUrl = `https://adore.ugent.be/IIIF/manifests/${manuscriptId}`;
                
                if (!this.deps.loadIIIFManifest) {
                    throw new Error('IIIF manifest loader not available');
                }
                return this.deps.loadIIIFManifest(manifestUrl);
            } catch (error: any) {
                throw new Error(`Failed to load UGent manifest: ${(error as Error).message}`);
            }
        }
}