import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class DiammLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'diamm';
    }
        async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
            try {
                let manifestUrl: string;
                
                // Handle both musmed.eu viewer URLs and direct manifest URLs
                if (originalUrl.includes('musmed.eu/visualiseur-iiif')) {
                    // Extract manifest URL from musmed.eu viewer parameters
                    const urlParams = new URLSearchParams(originalUrl.split('?')[1]);
                    const encodedManifest = urlParams.get('manifest');
                    if (!encodedManifest) {
                        throw new Error('No manifest parameter found in DIAMM viewer URL');
                    }
                    manifestUrl = decodeURIComponent(encodedManifest);
                } else if (originalUrl.includes('iiif.diamm.net/manifests/')) {
                    // Direct manifest URL
                    manifestUrl = originalUrl;
                } else {
                    throw new Error('Unsupported DIAMM URL format');
                }
                
                // Validate manifest URL format
                if (!manifestUrl.includes('iiif.diamm.net/manifests/')) {
                    throw new Error('Invalid DIAMM manifest URL format');
                }
                
                // Load the IIIF manifest using DIAMM-specific processing for maximum resolution
                if (!this.deps.loadDiammSpecificManifest) {
                    throw new Error('DIAMM-specific manifest loader not available');
                }
                const manifest = await this.deps.loadDiammSpecificManifest(manifestUrl);
                
                // Override library type to ensure correct identification
                manifest.library = 'diamm';
                
                return manifest;
                
            } catch (error: unknown) {
                throw new Error(`Failed to load DIAMM manuscript: ${(error as Error).message}`);
            }
        }
}