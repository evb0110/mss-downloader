import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class BritishLibraryLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'bl';
    }
        async loadManifest(url: string): Promise<ManuscriptManifest> {
            try {
                let manifestUrl: string;
                
                // Check if this is a viewer URL or direct manifest URL
                if (url.includes('iiif.bl.uk/uv/') && url.includes('manifest=')) {
                    // Extract manifest URL from viewer URL - handle URLs with tracking parameters
                    const manifestMatch = url.match(/manifest=([^&\s]+)/);
                    if (!manifestMatch) {
                        throw new Error('Invalid British Library viewer URL format. Expected format with manifest parameter');
                    }
                    manifestUrl = decodeURIComponent(manifestMatch[1] || '');
                } else if (url.includes('bl.digirati.io/iiif/')) {
                    // Direct manifest URL - British Library doesn't need '/manifest' suffix
                    manifestUrl = url;
                } else {
                    // Fallback: try to extract ARK and use API
                    const arkMatch = url.match(/ark:\/[^/]+\/[^/?\s]+/);
                    if (arkMatch) {
                        manifestUrl = `https://api.bl.uk/metadata/iiif/${arkMatch[0]}/manifest.json`;
                    } else {
                        throw new Error('Invalid British Library URL format');
                    }
                }
                
                if (!this.deps.loadIIIFManifest) {
                    throw new Error('IIIF manifest loader not available');
                }
                return this.deps.loadIIIFManifest(manifestUrl);
            } catch (error: any) {
                throw new Error(`Failed to load British Library manifest: ${(error as Error).message}`);
            }
        }
}