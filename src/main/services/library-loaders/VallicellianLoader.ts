import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class VallicellianLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'vallicelliana';
    }
    
    async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
            try {
                let manifestUrl: string;
                let displayName: string;
                
                if (originalUrl.includes('dam.iccu.sbn.it')) {
                    // DAM system - direct manifest access
                    if (originalUrl.includes('/manifest')) {
                        manifestUrl = originalUrl;
                    } else {
                        const containerMatch = originalUrl.match(/containers\/([^/?]+)/);
                        if (!containerMatch) {
                            throw new Error('Cannot extract container ID from DAM URL');
                        }
                        manifestUrl = `https://dam.iccu.sbn.it/mol_46/containers/${containerMatch[1]}/manifest`;
                    }
                    displayName = `Vallicelliana_DAM_${originalUrl.match(/containers\/([^/?]+)/)?.[1] || 'unknown'}`;
                    
                } else if (originalUrl.includes('jmms.iccu.sbn.it')) {
                    // JMMS system - complex encoded URLs
                    if (originalUrl.includes('/manifest.json')) {
                        manifestUrl = originalUrl;
                    } else {
                        throw new Error('JMMS URLs must be direct manifest URLs');
                    }
                    displayName = `Vallicelliana_JMMS_${Date.now()}`;
                    
                } else {
                    throw new Error('Unsupported Vallicelliana URL format - must be DAM or JMMS URL');
                }
                
                // Fetch and parse IIIF manifest
                const response = await this.deps.fetchDirect(manifestUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch manifest: HTTP ${response.status}`);
                }
                
                const manifestData = await response.json();
                
                // Handle both IIIF v2 and v3 structures
                let canvases: Record<string, unknown>[] = [];
                if (manifestData.sequences && manifestData.sequences[0] && manifestData.sequences[0].canvases) {
                    // IIIF v2
                    canvases = manifestData.sequences[0].canvases;
                } else if (manifestData.items) {
                    // IIIF v3
                    canvases = manifestData.items;
                } else {
                    throw new Error('Invalid IIIF manifest structure - no canvases found');
                }
                
                // Extract page URLs
                const pageLinks = canvases.map((canvas: Record<string, unknown>) => {
                    // IIIF v2 structure
                    if (canvas.images && canvas.images[0]) {
                        const resource = canvas.images[0].resource;
                        if (resource.service && resource.service['@id']) {
                            return `${resource.service['@id']}/full/full/0/default.jpg`;
                        } else if (resource['@id']) {
                            return resource['@id'];
                        }
                    }
                    
                    // IIIF v3 structure
                    if (canvas.items && canvas.items[0] && canvas.items[0].items && canvas.items[0].items[0]) {
                        const annotation = canvas.items[0].items[0];
                        if (annotation.body && annotation.body.service && annotation.body.service[0]) {
                            const serviceId = annotation.body.service[0].id || annotation.body.service[0]['@id'];
                            return `${serviceId}/full/full/0/default.jpg`;
                        } else if (annotation.body && annotation.body.id) {
                            return annotation.body.id;
                        }
                    }
                    
                    return null;
                }).filter((link: string) => link);
                
                if (pageLinks.length === 0) {
                    throw new Error('No pages found in manifest');
                }
                
                // Basic validation: log warning if manifest might be incomplete
                console.log(`Vallicelliana manifest loaded: ${pageLinks.length} pages found`);
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'vallicelliana',
                    displayName: displayName,
                    originalUrl: originalUrl,
                };
                
            } catch (error: unknown) {
                throw new Error(`Failed to load Vallicelliana manuscript: ${(error as Error).message}`);
            }
        }
}