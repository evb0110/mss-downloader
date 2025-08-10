import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class GrenobleLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'grenoble';
    }
    
    async loadManifest(grenobleUrl: string): Promise<ManuscriptManifest> {
            try {
                // Extract document ID from URL
                const idMatch = grenobleUrl.match(/\/([^/]+)\/f\d+/);
                if (!idMatch) {
                    throw new Error('Invalid Grenoble URL format - document ID not found');
                }
                
                const documentId = idMatch[1];
                let displayName = `Grenoble Manuscript ${documentId}`;
                
                // Use IIIF manifest endpoint with correct ARK path
                const manifestUrl = `https://pagella.bm-grenoble.fr/iiif/ark:/12148/${documentId}/manifest.json`;
                
                try {
                    const response = await this.deps.fetchDirect(manifestUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                            'Accept': 'application/json,*/*'
                        }
                    });
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status} from manifest endpoint`);
                    }
                    
                    const manifest = await response.json();
                    
                    // Extract metadata from IIIF manifest
                    if (manifest.label) {
                        displayName = manifest.label;
                    }
                    
                    // Get page count from sequences/canvases (IIIF v1.1 format)
                    let totalPages = 0;
                    if (manifest.sequences && manifest.sequences.length > 0) {
                        const sequence = manifest.sequences[0];
                        if (sequence.canvases) {
                            totalPages = sequence.canvases.length;
                        }
                    }
                    
                    if (totalPages === 0) {
                        throw new Error('No pages found in IIIF manifest');
                    }
                    
                    // Generate IIIF image URLs with maximum resolution
                    const pageLinks: string[] = [];
                    for (let i = 1; i <= totalPages; i++) {
                        // Use IIIF Image API v1.1 format with maximum resolution: /full/4000,/0/default.jpg
                        // This provides 4000x5020 pixels instead of the default 3164x3971
                        const imageUrl = `https://pagella.bm-grenoble.fr/iiif/ark:/12148/${documentId}/f${i}/full/4000,/0/default.jpg`;
                        pageLinks.push(imageUrl);
                    }
                    
                    const grenobleManifest = {
                        pageLinks,
                        totalPages: pageLinks.length,
                        library: 'grenoble' as const,
                        displayName,
                        originalUrl: grenobleUrl,
                    };
                    
                    // Cache the manifest
                    this.deps.manifestCache.set(grenobleUrl, grenobleManifest).catch(console.warn);
                    
                    return grenobleManifest;
                    
                } catch (manifestError) {
                    throw new Error(`Failed to load IIIF manifest: ${(manifestError as Error).message}`);
                }
                
            } catch (error: any) {
                throw new Error(`Failed to load Grenoble manuscript: ${(error as Error).message}`);
            }
        }
}