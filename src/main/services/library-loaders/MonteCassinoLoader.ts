import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class MonteCassinoLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'montecassino';
    }
    
    async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
            try {
                let manuscriptId: string;
                
                // Handle different Monte-Cassino URL patterns
                if (originalUrl.includes('manus.iccu.sbn.it')) {
                    // Extract catalog ID and find corresponding IIIF manifest
                    const catalogMatch = originalUrl.match(/cnmd\/([^/?]+)/);
                    if (!catalogMatch) {
                        throw new Error('Cannot extract catalog ID from Manus URL');
                    }
                    
                    // Catalog ID to IIIF manuscript mapping based on OMNES platform
                    const catalogId = catalogMatch[1];
                    const catalogMappings: { [key: string]: string } = {
                        // Existing mappings (verified)
                        '0000313047': 'IT-FR0084_0339',
                        '0000313194': 'IT-FR0084_0271', 
                        '0000396781': 'IT-FR0084_0023',
                        
                        // Additional mappings discovered from OMNES catalog
                        '0000313037': 'IT-FR0084_0003',
                        '0000313038': 'IT-FR0084_0001',
                        '0000313039': 'IT-FR0084_0002',
                        '0000313048': 'IT-FR0084_0006',
                        '0000313049': 'IT-FR0084_0015',
                        '0000313053': 'IT-FR0084_0007',
                        '0000313054': 'IT-FR0084_0008',
                        '0000313055': 'IT-FR0084_0009',
                        '0000313056': 'IT-FR0084_0010',
                        '0000313057': 'IT-FR0084_0011',
                        '0000313058': 'IT-FR0084_0012',
                        '0000396666': 'IT-FR0084_0016',
                        '0000396667': 'IT-FR0084_0017',
                        '0000401004': 'IT-FR0084_0018'
                    };
                    
                    if (catalogMappings[catalogId]) {
                        manuscriptId = catalogMappings[catalogId];
                    } else {
                        // Special handling for catalog 0000313041 which is cataloged but not digitized
                        if (catalogId === '0000313041') {
                            throw new Error(
                                `Monte-Cassino catalog ID 0000313041 exists but is not digitized. ` +
                                `This manuscript is cataloged in ICCU but not available in the OMNES digital collection. ` +
                                `Available nearby manuscripts: 0000313047, 0000313048, 0000313049. ` +
                                `You can also browse all available manuscripts at https://omnes.dbseret.com/montecassino/`
                            );
                        }
                        
                        // Find nearby available alternatives for better user guidance
                        const catalogNum = parseInt(catalogId);
                        const availableIds = Object.keys(catalogMappings);
                        const nearest = availableIds
                            .map(id => ({ id, distance: Math.abs(parseInt(id) - catalogNum) }))
                            .sort((a, b) => a.distance - b.distance)
                            .slice(0, 3);
                        
                        const suggestions = nearest.map(n => `${n.id} (distance: ${n.distance})`).join(', ');
                        
                        throw new Error(
                            `Monte-Cassino catalog ID ${catalogId} is not available in the digital collection. ` +
                            `This manuscript may not be digitized. ` +
                            `Nearest available catalog IDs: ${suggestions}. ` +
                            `You can also use direct IIIF manifest URLs from https://omnes.dbseret.com/montecassino/`
                        );
                    }
                } else if (originalUrl.includes('omnes.dbseret.com/montecassino/iiif/')) {
                    // Direct IIIF manifest URL
                    const iiifMatch = originalUrl.match(/montecassino\/iiif\/([^/]+)/);
                    if (!iiifMatch) {
                        throw new Error('Cannot extract manuscript ID from OMNES URL');
                    }
                    manuscriptId = iiifMatch[1];
                } else {
                    throw new Error('Unsupported Monte-Cassino URL format');
                }
                
                // Construct IIIF manifest URL
                const manifestUrl = `https://omnes.dbseret.com/montecassino/iiif/${manuscriptId}/manifest`;
                
                // Fetch and parse IIIF manifest
                const response = await this.deps.fetchDirect(manifestUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch manifest: HTTP ${response.status}`);
                }
                
                const manifestData = await response.json();
                
                // Validate IIIF manifest structure
                if (!manifestData.sequences || !manifestData.sequences[0] || !manifestData.sequences[0].canvases) {
                    throw new Error('Invalid IIIF manifest structure');
                }
                
                // Extract page URLs
                const pageLinks = manifestData.sequences[0].canvases.map((canvas: any) => {
                    const resource = canvas.images[0].resource;
                    if (resource.service && resource.service['@id']) {
                        return `${resource.service['@id']}/full/full/0/default.jpg`;
                    } else if (resource['@id']) {
                        return resource['@id'];
                    }
                    return null;
                }).filter((link: string) => link);
                
                if (pageLinks.length === 0) {
                    throw new Error('No pages found in manifest');
                }
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'monte_cassino',
                    displayName: `Monte_Cassino_${manuscriptId}`,
                    originalUrl: originalUrl,
                };
                
            } catch (error: any) {
                throw new Error(`Failed to load Monte-Cassino manuscript: ${(error as Error).message}`);
            }
        }
}