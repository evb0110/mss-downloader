import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class GamsLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'gams';
    }
    
    async loadManifest(gamsUrl: string): Promise<ManuscriptManifest> {
            const startTime = Date.now();
            console.log('[GAMS] Starting to load manuscript from:', gamsUrl);
            
            try {
                // Extract context ID from URL (e.g., context:rbas.ms.P0008s11)
                const contextMatch = gamsUrl.match(/context:([a-zA-Z0-9._-]+)/);
                if (!contextMatch) {
                    throw new Error('Could not extract context ID from GAMS URL');
                }
                
                const contextId = contextMatch[1];
                console.log('[GAMS] Extracted context ID:', contextId);
                
                // GAMS uses IIIF manifests - construct the manifest URL
                // Pattern: https://gams.uni-graz.at/iiif/[contextId]/manifest.json
                const manifestUrl = `https://gams.uni-graz.at/iiif/context:${contextId}/manifest`;
                console.log('[GAMS] Constructed manifest URL:', manifestUrl);
                
                // Fetch the IIIF manifest with timeout protection
                const manifestResponse = await this.deps.fetchDirect(manifestUrl, {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    }
                });
                
                if (!manifestResponse.ok) {
                    throw new Error(`Failed to fetch GAMS manifest: ${manifestResponse.status} ${manifestResponse.statusText}`);
                }
                
                const manifest = await manifestResponse.json();
                console.log('[GAMS] Received manifest:', { 
                    '@context': manifest['@context'],
                    '@id': manifest['@id'],
                    label: manifest.label 
                });
                
                // Extract pages from IIIF manifest
                const pageLinks: string[] = [];
                const displayName = manifest.label || `GAMS Manuscript ${contextId}`;
                
                if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                    const canvases = manifest.sequences[0].canvases;
                    console.log(`[GAMS] Found ${canvases?.length} canvases in manifest`);
                    
                    for (const canvas of canvases) {
                        if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                            const resource = canvas.images[0].resource;
                            const service = resource.service || (canvas.images[0]['@id'] && { '@id': canvas.images[0]['@id'].replace(/\/full\/.*$/, '') });
                            
                            let imageUrl = resource['@id'] || resource.id;
                            
                            // If we have a IIIF service, construct high-resolution URL
                            if (service && service['@id']) {
                                const serviceUrl = service['@id'].replace(/\/$/, '');
                                // Use max resolution
                                imageUrl = `${serviceUrl}/full/max/0/default.jpg`;
                            }
                            
                            pageLinks.push(imageUrl);
                        }
                    }
                } else {
                    throw new Error('Invalid GAMS IIIF manifest structure');
                }
                
                if (pageLinks?.length === 0) {
                    throw new Error('No images found in GAMS manifest');
                }
                
                console.log(`[GAMS] Successfully extracted ${pageLinks?.length} pages in ${Date.now() - startTime}ms`);
                
                return {
                    displayName,
                    totalPages: pageLinks?.length,
                    library: 'gams',
                    pageLinks,
                    originalUrl: gamsUrl
                };
                
            } catch (error: any) {
                const duration = Date.now() - startTime;
                console.error(`[GAMS] Failed to load manifest after ${duration}ms:`, {
                    url: gamsUrl,
                    error: error instanceof Error ? error.message : String(error)
                });
                
                if (error instanceof Error ? error.message : String(error).includes('timeout')) {
                    throw new Error(`GAMS manifest loading timed out. The server may be slow or unresponsive.`);
                } else if (error instanceof Error ? error.message : String(error).includes('Could not extract context ID')) {
                    throw new Error(`Invalid GAMS URL format. Expected format: https://gams.uni-graz.at/context:ID`);
                } else {
                    throw new Error(`Failed to load GAMS manuscript: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
}