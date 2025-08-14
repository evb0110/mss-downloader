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
                    if (canvas['images'] && (canvas['images'] as unknown[])[0]) {
                        const resource = ((canvas['images'] as unknown[])[0] as Record<string, unknown>)['resource'] as Record<string, unknown>;
                        if (resource && resource['service'] && (resource['service'] as Record<string, unknown>)['@id']) {
                            return `${(resource['service'] as Record<string, unknown>)['@id']}/full/full/0/default.jpg`;
                        } else if (resource && resource['@id']) {
                            return resource['@id'];
                        }
                    }
                    
                    // IIIF v3 structure
                    if (canvas['items'] && (canvas['items'] as unknown[])[0] && ((canvas['items'] as unknown[])[0] as Record<string, unknown>)['items'] && (((canvas['items'] as unknown[])[0] as Record<string, unknown>)['items'] as unknown[])[0]) {
                        const annotation = (((canvas['items'] as unknown[])[0] as Record<string, unknown>)['items'] as unknown[])[0] as Record<string, unknown>;
                        if (annotation['body'] && (annotation['body'] as Record<string, unknown>)['service'] && ((annotation['body'] as Record<string, unknown>)['service'] as unknown[])[0]) {
                            const serviceArray = (annotation['body'] as Record<string, unknown>)['service'] as Record<string, unknown>[];
                            const serviceId = serviceArray[0]?.['id'] || serviceArray[0]?.['@id'];
                            return `${serviceId}/full/full/0/default.jpg`;
                        } else if (annotation['body'] && (annotation['body'] as Record<string, unknown>)['id']) {
                            return (annotation['body'] as Record<string, unknown>)['id'];
                        }
                    }
                    
                    return null;
                }).filter((link: unknown): link is string => typeof link === 'string' && link !== null);
                
                if (pageLinks?.length === 0) {
                    throw new Error('No pages found in manifest');
                }
                
                // Basic validation: log warning if manifest might be incomplete
                console.log(`Vallicelliana manifest loaded: ${pageLinks?.length} pages found`);
                
                return {
                    pageLinks,
                    totalPages: pageLinks?.length,
                    library: 'vallicelliana',
                    displayName: displayName,
                    originalUrl: originalUrl,
                };
                
            } catch (error: any) {
                throw new Error(`Failed to load Vallicelliana manuscript: ${(error as Error).message}`);
            }
        }
}