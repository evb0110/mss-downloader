import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class TrinityCamLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'trinity_cam';
    }
    
    async loadManifest(trinityUrl: string): Promise<ManuscriptManifest> {
            try {
                const manuscriptIdMatch = trinityUrl.match(/\/Manuscript\/([^/]+)/);
                if (!manuscriptIdMatch) {
                    throw new Error('Invalid Trinity College Cambridge URL format');
                }
                
                const manuscriptId = manuscriptIdMatch[1];
                const manifestUrl = `https://mss-cat.trin.cam.ac.uk/Manuscript/${manuscriptId}/manifest.json`;
                
                // Use intelligent progress monitoring for Trinity Cambridge as their server can be slow
                const progressMonitor = this.deps.createProgressMonitor(
                    'Trinity Cambridge manifest loading'
                );
                
                const controller = (progressMonitor as any)['start']();
                (progressMonitor as any)['updateProgress'](0, 1, 'Loading Trinity Cambridge manifest...');
                
                try {
                    const manifestResponse = await fetch(manifestUrl, {
                        signal: controller.signal,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            'Accept': 'application/json,application/ld+json,*/*',
                            'Accept-Language': 'en-US,en;q=0.5',
                            'Cache-Control': 'no-cache'
                        }
                    });
                    
                    (progressMonitor as any)['updateProgress'](1, 1, 'Trinity Cambridge manifest loaded successfully');
                    
                    if (!manifestResponse.ok) {
                        if (manifestResponse.status === 404) {
                            throw new Error(`Manuscript not found: ${manuscriptId}. Please check the URL is correct.`);
                        } else if (manifestResponse.status >= 500) {
                            throw new Error(`Trinity Cambridge server error (HTTP ${manifestResponse.status}). The server may be temporarily unavailable.`);
                        } else {
                            throw new Error(`Failed to fetch Trinity Cambridge manifest: HTTP ${manifestResponse.status}`);
                        }
                    }
                    
                    const responseText = await manifestResponse.text();
                    let iiifManifest;
                    
                    try {
                        iiifManifest = JSON.parse(responseText);
                    } catch {
                        throw new Error(`Invalid JSON response from Trinity Cambridge. Response starts with: ${responseText.substring(0, 100)}`);
                    }
                    
                    if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                        throw new Error('Invalid IIIF manifest structure from Trinity Cambridge');
                    }
                    
                    const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: Record<string, unknown>) => {
                        const resource = ((canvas['images'] as unknown[])[0] as Record<string, unknown>)['resource'] as Record<string, unknown>;
                        let imageUrl = resource['@id'] || resource['id'];
                        
                        // For Trinity Cambridge, convert to smaller size for faster downloads
                        // Convert from /full/full/ to /full/1000,/ (1000px wide, loads in ~1.4s vs 45s)
                        if (imageUrl && typeof imageUrl === 'string' && imageUrl.includes('/full/full/')) {
                            imageUrl = imageUrl.replace('/full/full/', '/full/1000,/');
                        }
                        
                        return imageUrl;
                    }).filter((link: string) => link);
                    
                    if (pageLinks?.length === 0) {
                        throw new Error('No pages found in Trinity Cambridge manifest');
                    }
                    
                    return {
                        pageLinks,
                        totalPages: pageLinks?.length,
                        library: 'trinity_cam',
                        displayName: `TrinityC_${manuscriptId}`,
                        originalUrl: trinityUrl,
                    };
                    
                } catch (fetchError: unknown) {
                    if ((fetchError as any)?.name === 'AbortError') {
                        throw new Error('Trinity Cambridge server request timed out. The server may be temporarily unavailable.');
                    }
                    throw fetchError;
                } finally {
                    (progressMonitor as any)['complete']();
                }
                
            } catch (error: any) {
                throw new Error(`Failed to load Trinity College Cambridge manuscript: ${(error as Error).message}`);
            }
        }
}