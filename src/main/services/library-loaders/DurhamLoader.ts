import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class DurhamLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'durham';
    }
        async loadManifest(url: string): Promise<ManuscriptManifest> {
            const manifestMatch = url.match(/[?&]manifest=([^&]+)/);
            if (!manifestMatch || !manifestMatch[1]) {
                throw new Error('Invalid Durham URL format - could not extract manifest ID');
            }
            
            const manifestId = manifestMatch[1];
            
            // Durham University IIIF manifest URL pattern:
            // https://iiif.durham.ac.uk/manifests/trifle/32150/[first-2-chars]/[next-2-chars]/[next-2-chars]/[full-id]/manifest
            // Example: t1mp2676v52p -> t1/mp/26/t1mp2676v52p/manifest
            if (manifestId?.length < 6) {
                throw new Error(`Invalid Durham manifest ID format: ${manifestId}`);
            }
            
            const part1 = manifestId.substring(0, 2);
            const part2 = manifestId.substring(2, 4);
            const part3 = manifestId.substring(4, 6);
            
            const manifestUrl = `https://iiif.durham.ac.uk/manifests/trifle/32150/${part1}/${part2}/${part3}/${manifestId}/manifest`;
            if (!this.deps.loadIIIFManifest) {
                throw new Error('IIIF manifest loader not available');
            }
            return this.deps.loadIIIFManifest(manifestUrl);
        }
}