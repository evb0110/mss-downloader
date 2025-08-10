import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class SharedCanvasLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'sharedcanvas';
    }
        async loadManifest(url: string): Promise<ManuscriptManifest> {
            const match = url.match(/\/viewer\/mirador\/([^/?&]+)/);
            if (!match) {
                throw new Error('Invalid SharedCanvas URL format');
            }
            const manifestUrl = `https://sharedcanvas.be/IIIF/manifests/${match[1]}`;
            return this.deps.loadIIIFManifest(manifestUrl);
        }
}